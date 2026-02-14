import type { Contact, TokenBalance, Transfer } from "./types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const formatUsd = (value: number): string => usd.format(value);

export const formatDateLabel = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

export const getTotalBalance = (balances: TokenBalance[]): number => {
  return balances.reduce((sum, token) => sum + token.usdValue, 0);
};

export type ContactBalance = {
  contact: Contact;
  netUsd: number;
  statusLabel: "Owes you" | "You owe" | "Settled";
};

export const computeContactBalances = (contacts: Contact[], history: Transfer[]): ContactBalance[] => {
  return contacts
    .map((contact) => {
      const contactTransfers = history.filter((transfer) => transfer.contactId === contact.id);
      const netUsd = contactTransfers.reduce((sum, transfer) => {
        return transfer.direction === "received" ? sum + transfer.amountUsd : sum - transfer.amountUsd;
      }, 0);

      let statusLabel: ContactBalance["statusLabel"] = "Settled";
      if (netUsd > 0.009) {
        statusLabel = "Owes you";
      }
      if (netUsd < -0.009) {
        statusLabel = "You owe";
      }

      return {
        contact,
        netUsd,
        statusLabel
      };
    })
    .sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd));
};

export const buildNetFlow = (history: Transfer[]): { incoming: number; outgoing: number } => {
  return history.reduce(
    (acc, transfer) => {
      if (transfer.direction === "received") {
        acc.incoming += transfer.amountUsd;
      } else {
        acc.outgoing += transfer.amountUsd;
      }
      return acc;
    },
    { incoming: 0, outgoing: 0 }
  );
};
