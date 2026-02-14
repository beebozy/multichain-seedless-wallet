import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateRuntimeConfig() {
  const isProduction = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const allowInsecure = (process.env.AUTH_ALLOW_INSECURE_DEV ?? 'false') === 'true';

  if (isProduction && allowInsecure) {
    throw new Error('AUTH_ALLOW_INSECURE_DEV must be false in production');
  }

  if (!allowInsecure) {
    requiredEnv('AUTH_JWKS_URL');
    requiredEnv('AUTH_ISSUER');
    requiredEnv('AUTH_AUDIENCE');
  }
}

async function bootstrap() {
  validateRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-dev-user-id',
      'x-dev-email',
      'x-dev-phone',
      'x-dev-wallet',
      'x-dev-role',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`Invisible Wallet backend running on http://localhost:${port}`);
}

void bootstrap();
