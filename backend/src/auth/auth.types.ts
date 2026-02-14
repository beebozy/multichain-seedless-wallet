import { Request } from 'express';

export type AuthUser = {
  sub: string;
  email?: string;
  phone?: string;
  walletAddress?: string;
  role?: string;
};

export type RequestWithAuth = Request & {
  authUser?: AuthUser;
};
