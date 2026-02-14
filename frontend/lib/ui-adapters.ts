import type { LedgerRow, TransferRecord, WalletBalancesResponse } from "./backend-api";
import type { Contact, TokenBalance, Transfer } from "./types";

const colorFrom = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 62% 44%)`;
};

const labelFromHandle = (handle: string) => {
  if (handle.includes("@")) return handle.split("@")[0] ?? handle;
  return handle;
};

export function mapBalances(data: WalletBalancesResponse): TokenBalance[] {
  return data.balances.map((entry) => ({
    stablecoin: entry.asset,
    amount: entry.amount,
    usdValue: entry.usdValue,
    chainLabel: "Tempo"
  }));
}

export function mapContacts(ledger: LedgerRow[], transfers: TransferRecord[]): Contact[] {
  const map = new Map<string, Contact>();

  for (const row of ledger) {
    const base = labelFromHandle(row.contactHandle);
    map.set(row.contactId, {
      id: row.contactId,
      name: base.charAt(0).toUpperCase() + base.slice(1),
      handle: row.contactHandle,
      avatarColor: colorFrom(row.contactId),
      status: "online"
    });
  }

  for (const row of transfers) {
    const id = row.counterpartyWallet;
    if (!map.has(id)) {
      const handle = row.direction === "outgoing" ? row.recipientHandle : row.counterpartyWallet;
      const base = labelFromHandle(handle);
      map.set(id, {
        id,
        name: base.charAt(0).toUpperCase() + base.slice(1),
        handle,
        avatarColor: colorFrom(id),
        status: "online"
      });
    }
  }

  return Array.from(map.values());
}

export function mapTransfers(rows: TransferRecord[]): Transfer[] {
  return rows.map((row) => ({
    id: row.txHash,
    contactId: row.counterpartyWallet,
    direction: row.direction === "incoming" ? "received" : "sent",
    amountUsd: row.amountUsd,
    stablecoin: row.stablecoin,
    memo: row.memo ?? "No memo",
    chainLabel: row.chain,
    createdAt: row.createdAt
  }));
}

export function mapLedgerForUI(ledger: LedgerRow[], contacts: Contact[]) {
  const byId = new Map(contacts.map((contact) => [contact.id, contact]));

  return ledger.map((row) => {
    const contact = byId.get(row.contactId) ?? {
      id: row.contactId,
      name: row.contactHandle,
      handle: row.contactHandle,
      avatarColor: colorFrom(row.contactId),
      status: "online" as const
    };

    const statusLabel =
      row.status === "owes_you" ? ("Owes you" as const) : row.status === "you_owe" ? ("You owe" as const) : ("Settled" as const);

    return {
      contact,
      netUsd: row.netUsd,
      statusLabel
    };
  });
}
