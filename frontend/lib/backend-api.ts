export type BackendSession = {
  baseUrl: string;
  bearerToken?: string;
  devHeaders?: {
    userId?: string;
    email?: string;
    phone?: string;
    wallet?: string;
    walletId?: string;
    role?: string;
  };
};

export type PrivyUpsertInput = {
  privyUserId: string;
  walletAddress: string;
  walletId?: string;
  email?: string;
  phone?: string;
};

export type PrivyUpsertResponse = {
  userId: string;
  handle: string;
  walletAddress: string;
  chain: string;
  privyUserId: string;
  custodial: boolean;
  provisioned: boolean;
};

export type LedgerRow = {
  contactId: string;
  contactHandle: string;
  netUsd: number;
  status: "owes_you" | "you_owe" | "settled";
};

export type WalletBalancesResponse = {
  userId: string;
  walletAddress: string;
  balances: Array<{
    asset: string;
    amount: number;
    usdValue: number;
    tokenAddress: string;
  }>;
  totalUsd: number;
};

export type TransferRecord = {
  paymentId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientHandle: string;
  amountUsd: number;
  stablecoin: string;
  memo?: string;
  memoHex: string;
  status: "settled";
  chain: string;
  txHash: string;
  sponsoredFee: boolean;
  createdAt: string;
  direction: "incoming" | "outgoing";
  counterpartyWallet: string;
  blockNumber: number;
  logIndex: number;
};

export type TransfersResponse = {
  data: TransferRecord[];
  nextCursor: string | null;
};

export type WeeklySpendResponse = {
  userId: string;
  walletAddress: string;
  weekStart: string;
  totalSpentUsd: number;
  transactionCount: number;
  biggestExpense: {
    amountUsd: number;
    memo: string;
    stablecoin: string;
    txHash: string;
  } | null;
  summary: string;
};

export type NotificationDelivery = {
  id: string;
  paymentId: string | null;
  userId: string;
  channel: "email" | "sms";
  destination: string;
  provider: string;
  template: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  providerMessageId: string | null;
  lastError: string | null;
  nextRetryAt: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
};

export type NotificationResponse = {
  userId: string;
  total: number;
  data: NotificationDelivery[];
  nextCursor: string | null;
};

export type PaymentResponse = {
  paymentId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientHandle: string;
  amountUsd: number;
  stablecoin: string;
  memo?: string;
  memoHex: string;
  status: "initiated" | "pending_claim" | "submitted" | "settled" | "failed" | "expired";
  chain: string;
  txHash?: string;
  sponsoredFee: boolean;
  createdAt: string;
  idempotencyKey: string;
  failureCode?: string;
  failureMessage?: string;
  expiresAt?: string;
  claimedAt?: string;
};

export type ResolveRecipientResponse = {
  found: boolean;
  provisioned: boolean;
  userId?: string;
  handle: string;
  walletAddress?: string;
  chain?: string;
  custodial?: boolean;
  privyUserId?: string;
  safetyFlags?: string[];
};

const headersFor = (session: BackendSession): HeadersInit => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (session.bearerToken) {
    headers.authorization = `Bearer ${session.bearerToken}`;
  }

  const dev = session.devHeaders;
  if (dev?.userId) headers["x-dev-user-id"] = dev.userId;
  if (dev?.email) headers["x-dev-email"] = dev.email;
  if (dev?.phone) headers["x-dev-phone"] = dev.phone;
  if (dev?.wallet) headers["x-dev-wallet"] = dev.wallet;
  if (dev?.walletId) headers["x-dev-wallet-id"] = dev.walletId;
  if (dev?.role) headers["x-dev-role"] = dev.role;

  return headers;
};

async function req<T>(session: BackendSession, path: string, init?: RequestInit): Promise<T> {
  const base = session.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...headersFor(session),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend ${res.status} ${path}: ${body || res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function privyUpsert(session: BackendSession, input: PrivyUpsertInput) {
  return req<PrivyUpsertResponse>(session, "/v1/auth/privy-upsert", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchDashboard(session: BackendSession, userId: string) {
  const id = encodeURIComponent(userId);
  const [ledger, balances, transfers, weekly] = await Promise.all([
    req<LedgerRow[]>(session, `/v1/contacts/ledger?userId=${id}`),
    req<WalletBalancesResponse>(session, `/v1/wallet/balances?userId=${id}`),
    req<TransfersResponse>(session, `/v1/transfers?userId=${id}`),
    req<WeeklySpendResponse>(session, `/v1/insights/weekly-spend?userId=${id}`)
  ]);

  return { ledger, balances, transfers, weekly };
}

export async function resolveRecipient(session: BackendSession, handle: string) {
  return req<ResolveRecipientResponse>(session, "/v1/auth/resolve-recipient", {
    method: "POST",
    body: JSON.stringify({ handle })
  });
}

export async function sendPayment(
  session: BackendSession,
  input: { recipientHandle: string; amountUsd: number; stablecoin: string; memo?: string }
) {
  const idempotencyKey = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return req<PaymentResponse>(session, "/v1/payments/send", {
    method: "POST",
    body: JSON.stringify({ ...input, idempotencyKey })
  });
}

export type PrepareSignedPaymentResponse = {
  paymentId: string;
  senderUserId: string;
  recipientUserId: string;
  status: "initiated" | "pending_claim" | "submitted" | "settled" | "failed" | "expired";
  txRequest: {
    to: string;
    data: string;
    value: `0x${string}` | string;
    chainId?: number;
    gasLimit?: string;
    tokenAddress: string;
    amountUnits: string;
    memoHex: string;
    stablecoin: string;
  };
};

export async function prepareSignedPayment(
  session: BackendSession,
  input: { recipientHandle: string; amountUsd: number; stablecoin: string; memo?: string }
) {
  const idempotencyKey = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return req<PrepareSignedPaymentResponse>(session, "/v1/payments/prepare", {
    method: "POST",
    body: JSON.stringify({ ...input, idempotencyKey })
  });
}

export async function confirmSignedPayment(
  session: BackendSession,
  input: { paymentId: string; txHash: string }
) {
  return req<PaymentResponse>(session, "/v1/payments/confirm-signed", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function fetchNotifications(session: BackendSession, userId: string, limit = 20) {
  const id = encodeURIComponent(userId);
  return req<NotificationResponse>(session, `/v1/notifications/deliveries?userId=${id}&limit=${limit}`);
}
