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

function corsOrigins(): string[] {
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set([...defaults, ...fromEnv]));
}

async function bootstrap() {
  validateRuntimeConfig();
  const allowInsecure = (process.env.AUTH_ALLOW_INSECURE_DEV ?? 'false') === 'true';
  const isProduction = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const allowedOrigins = corsOrigins();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProduction && (origin.includes('.ngrok') || origin.includes('.loca.lt'))) {
        callback(null, true);
        return;
      }
      if (allowInsecure && origin.startsWith('http://')) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-dev-user-id',
      'x-dev-email',
      'x-dev-phone',
      'x-dev-wallet',
      'x-dev-wallet-id',
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
