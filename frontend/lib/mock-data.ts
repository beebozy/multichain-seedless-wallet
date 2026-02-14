import type { Contact, TokenBalance, Transfer } from "./types";

export const currentUser = {
  name: "You",
  handle: "you@tempo.app"
};

export const contacts: Contact[] = [
  {
    id: "john",
    name: "John Rivera",
    handle: "john@gmail.com",
    avatarColor: "#12766e",
    status: "online"
  },
  {
    id: "sarah",
    name: "Sarah Kim",
    handle: "sarah@icloud.com",
    avatarColor: "#f0623a",
    status: "away"
  },
  {
    id: "mike",
    name: "Mike Johnson",
    handle: "+1 (415) 555-1931",
    avatarColor: "#314efb",
    status: "offline"
  },
  {
    id: "nina",
    name: "Nina Patel",
    handle: "nina@startup.com",
    avatarColor: "#701d85",
    status: "online"
  }
];

export const tokenBalances: TokenBalance[] = [
  { stablecoin: "pathUSD", amount: 300, usdValue: 300, chainLabel: "Tempo Mainnet" },
  { stablecoin: "USDC", amount: 142.1, usdValue: 142.1, chainLabel: "Base" },
  { stablecoin: "AlphaUSD", amount: 100, usdValue: 100, chainLabel: "Optimism" },
  { stablecoin: "USDT", amount: 48.75, usdValue: 48.75, chainLabel: "Arbitrum" }
];

export const transfers: Transfer[] = [
  {
    id: "tx_1",
    contactId: "john",
    direction: "sent",
    amountUsd: 24.5,
    stablecoin: "pathUSD",
    memo: "Dinner split",
    chainLabel: "Tempo Mainnet",
    createdAt: "2026-02-12T18:22:00.000Z"
  },
  {
    id: "tx_2",
    contactId: "john",
    direction: "received",
    amountUsd: 37,
    stablecoin: "USDC",
    memo: "Concert tickets",
    chainLabel: "Base",
    createdAt: "2026-02-10T15:05:00.000Z"
  },
  {
    id: "tx_3",
    contactId: "sarah",
    direction: "sent",
    amountUsd: 16,
    stablecoin: "pathUSD",
    memo: "Taxi",
    chainLabel: "Tempo Mainnet",
    createdAt: "2026-02-11T04:42:00.000Z"
  },
  {
    id: "tx_4",
    contactId: "sarah",
    direction: "sent",
    amountUsd: 9,
    stablecoin: "USDT",
    memo: "Coffee",
    chainLabel: "Arbitrum",
    createdAt: "2026-02-08T10:18:00.000Z"
  },
  {
    id: "tx_5",
    contactId: "mike",
    direction: "received",
    amountUsd: 42,
    stablecoin: "AlphaUSD",
    memo: "Weekend groceries",
    chainLabel: "Optimism",
    createdAt: "2026-02-05T13:55:00.000Z"
  },
  {
    id: "tx_6",
    contactId: "mike",
    direction: "sent",
    amountUsd: 42,
    stablecoin: "pathUSD",
    memo: "Groceries settled",
    chainLabel: "Tempo Mainnet",
    createdAt: "2026-02-06T13:12:00.000Z"
  },
  {
    id: "tx_7",
    contactId: "nina",
    direction: "received",
    amountUsd: 120,
    stablecoin: "USDC",
    memo: "Design sprint retainer",
    chainLabel: "Base",
    createdAt: "2026-02-09T09:34:00.000Z"
  },
  {
    id: "tx_8",
    contactId: "nina",
    direction: "sent",
    amountUsd: 40,
    stablecoin: "USDC",
    memo: "Lunch team split",
    chainLabel: "Base",
    createdAt: "2026-02-12T07:20:00.000Z"
  }
];
