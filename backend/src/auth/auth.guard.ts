import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { AuthUser, RequestWithAuth } from './auth.types';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly allowInsecureDev = (process.env.AUTH_ALLOW_INSECURE_DEV ?? 'false') === 'true';
  private readonly issuer = process.env.AUTH_ISSUER?.trim();
  private readonly audience = process.env.AUTH_AUDIENCE?.trim();
  private readonly jwksUrl = process.env.AUTH_JWKS_URL?.trim();
  private readonly jwks = this.jwksUrl ? createRemoteJWKSet(new URL(this.jwksUrl)) : null;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithAuth>();

    if (this.allowInsecureDev) {
      const devUserId = this.header(req, 'x-dev-user-id');
      if (devUserId) {
        req.authUser = {
          sub: devUserId,
          email: this.header(req, 'x-dev-email') ?? undefined,
          phone: this.header(req, 'x-dev-phone') ?? undefined,
          walletAddress: this.header(req, 'x-dev-wallet') ?? undefined,
          role: this.header(req, 'x-dev-role') ?? undefined,
        };
        return true;
      }
    }

    const token = this.bearer(req);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    if (!this.jwks) {
      throw new UnauthorizedException('AUTH_JWKS_URL is not configured');
    }

    const verifyResult = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
    });

    req.authUser = this.toAuthUser(verifyResult.payload);
    if (!req.authUser.sub) {
      throw new UnauthorizedException('Invalid token subject');
    }

    return true;
  }

  private bearer(req: RequestWithAuth): string | null {
    const header = this.header(req, 'authorization');
    if (!header) {
      return null;
    }
    if (!header.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    const token = header.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  private toAuthUser(payload: JWTPayload): AuthUser {
    const walletAddress =
      this.stringValue(payload, 'walletAddress') ||
      this.stringValue(payload, 'wallet_address') ||
      this.stringValue(payload, 'address');

    return {
      sub: payload.sub ?? '',
      email: this.stringValue(payload, 'email'),
      phone: this.stringValue(payload, 'phone_number') || this.stringValue(payload, 'phone'),
      walletAddress,
      role: this.stringValue(payload, 'role'),
    };
  }

  private stringValue(payload: JWTPayload, key: string): string | undefined {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
  }

  private header(req: RequestWithAuth, name: string): string | null {
    const headers = (req as unknown as { headers?: Record<string, string | string[] | undefined> }).headers;
    const value = headers?.[name] ?? headers?.[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return value ?? null;
  }
}
