import { Request } from 'express';

export type AuthUser = {
  sub: string;
  email?: string;
  phone?: string;
  walletAddress?: string;
  walletId?: string;
  role?: string;
  rawJwt?: string;
};

export type RequestWithAuth = Request & {
  authUser?: AuthUser;
};
