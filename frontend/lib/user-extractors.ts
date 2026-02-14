const isEthereumAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);

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
    wallet?: { address?: string; id?: string };
    linkedAccounts?: Array<{ id?: string; address?: string; type?: string }>;
  };

  if (isEthereumAddress(anyUser?.wallet?.address)) return anyUser.wallet.address;

  const linked = anyUser?.linkedAccounts ?? [];
  const walletEntry = linked.find((item) => isEthereumAddress(item?.address));
  return walletEntry?.address;
}

export function extractWalletId(user: unknown, preferredAddress?: string): string | undefined {
  const anyUser = user as {
    wallet?: { id?: string; address?: string };
    linkedAccounts?: Array<{ id?: string; address?: string; type?: string }>;
  };

  if (anyUser?.wallet?.id && isEthereumAddress(anyUser?.wallet?.address)) return anyUser.wallet.id;
  const linked = anyUser?.linkedAccounts ?? [];
  if (preferredAddress) {
    const match = linked.find(
      (item) =>
        typeof item?.id === "string" &&
        item.id.length > 0 &&
        typeof item?.address === "string" &&
        item.address.toLowerCase() === preferredAddress.toLowerCase()
    );
    if (match?.id) return match.id;
  }
  const walletEntry = linked.find(
    (item) => typeof item?.id === "string" && item.id.length > 0 && isEthereumAddress(item?.address)
  );
  return walletEntry?.id;
}
