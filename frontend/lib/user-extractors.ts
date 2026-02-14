export function extractPrivyUserId(user: unknown): string | undefined {
  const anyUser = user as { id?: string } | undefined;
  return anyUser?.id;
}

export function extractEmail(user: unknown): string | undefined {
  const anyUser = user as { email?: { address?: string } | string } | undefined;
  if (!anyUser?.email) return undefined;
  if (typeof anyUser.email === "string") return anyUser.email;
  return anyUser.email.address;
}

export function extractPhone(user: unknown): string | undefined {
  const anyUser = user as { phone?: { number?: string } | string } | undefined;
  if (!anyUser?.phone) return undefined;
  if (typeof anyUser.phone === "string") return anyUser.phone;
  return anyUser.phone.number;
}

export function extractWallet(user: unknown): string | undefined {
  const anyUser = user as {
    wallet?: { address?: string };
    linkedAccounts?: Array<{ address?: string; type?: string }>;
  };

  if (anyUser?.wallet?.address) return anyUser.wallet.address;

  const linked = anyUser?.linkedAccounts ?? [];
  const walletEntry = linked.find((item) => typeof item?.address === "string" && item.address.length > 0);
  return walletEntry?.address;
}
