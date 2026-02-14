import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.metrics.observeHttp(req.method, req.path, res.statusCode, durationMs);
    });

    next();
  }
}
