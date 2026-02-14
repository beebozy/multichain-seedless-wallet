import { Controller, Get, Header, UnauthorizedException, Req } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metricsEndpoint(@Req() req: Request) {
    const requiredToken = process.env.METRICS_BEARER_TOKEN?.trim();
    if (requiredToken) {
      const authHeader =
        (req as unknown as { headers?: Record<string, string | string[] | undefined> }).headers?.authorization;
      const value = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      const token = value?.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
      if (token !== requiredToken) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    }

    return this.metrics.render();
  }
}
