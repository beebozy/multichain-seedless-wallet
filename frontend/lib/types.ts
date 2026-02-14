export type StablecoinSymbol = string;

export type Contact = {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  status: "online" | "away" | "offline";
};

export type TransferDirection = "sent" | "received";

export type Transfer = {
  id: string;
  contactId: string;
  direction: TransferDirection;
  amountUsd: number;
  stablecoin: StablecoinSymbol;
  memo: string;
  chainLabel: string;
  createdAt: string;
};

export type TokenBalance = {
  stablecoin: StablecoinSymbol;
  amount: number;
  usdValue: number;
  chainLabel: string;
};
