import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
  ],
  controllers: [AppController, MetricsController],
  providers: [
    AppService,
    AuthGuard,
    MetricsService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpMetricsMiddleware).forRoutes('*');
  }
}
