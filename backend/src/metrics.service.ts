import { Injectable } from '@nestjs/common';
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
} from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  readonly httpRequestDurationMs: Histogram<'method' | 'route' | 'status'>;
  readonly paymentsTotal: Counter<'status' | 'stablecoin' | 'mode'>;
  readonly notificationsTotal: Counter<'status' | 'channel' | 'provider'>;
  readonly indexerLagBlocks: Gauge<'chain'>;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpRequestsTotal = new Counter({
      name: 'backend_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'backend_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    this.paymentsTotal = new Counter({
      name: 'backend_payments_total',
      help: 'Total payment attempts by status',
      labelNames: ['status', 'stablecoin', 'mode'],
      registers: [this.registry],
    });

    this.notificationsTotal = new Counter({
      name: 'backend_notifications_total',
      help: 'Total notification deliveries by status',
      labelNames: ['status', 'channel', 'provider'],
      registers: [this.registry],
    });

    this.indexerLagBlocks = new Gauge({
      name: 'backend_indexer_lag_blocks',
      help: 'Current indexer lag in blocks',
      labelNames: ['chain'],
      registers: [this.registry],
    });
  }

  observeHttp(method: string, route: string, status: number, durationMs: number) {
    const labels = { method, route, status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }

  incPayment(status: 'settled' | 'failed' | 'submitted', stablecoin: string, mode: string) {
    this.paymentsTotal.inc({ status, stablecoin, mode });
  }

  incNotification(status: 'sent' | 'failed', channel: string, provider: string) {
    this.notificationsTotal.inc({ status, channel, provider });
  }

  setIndexerLag(chain: string, lagBlocks: number) {
    this.indexerLagBlocks.set({ chain }, lagBlocks);
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
