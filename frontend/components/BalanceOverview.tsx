import type { TokenBalance } from "../lib/types";
import { formatUsd } from "../lib/finance";

type Props = {
  totalBalance: number;
  balances: TokenBalance[];
};

export function BalanceOverview({ totalBalance, balances }: Props) {
  return (
    <section className="panel panel-elevated">
      <p className="panel-kicker">Total purchasing power</p>
      <div className="balance-row">
        <h1>{formatUsd(totalBalance)}</h1>
        <span className="chip chip-success">Instant settlement</span>
      </div>
      <div className="token-grid">
        {balances.map((token) => (
          <article key={token.stablecoin} className="token-card">
            <p className="token-symbol">{token.stablecoin}</p>
            <p className="token-amount">{token.amount.toFixed(2)}</p>
            <p className="token-meta">{formatUsd(token.usdValue)} · {token.chainLabel}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
