import type { ContactBalance } from "../lib/finance";
import { formatUsd } from "../lib/finance";

type Props = {
  rows: ContactBalance[];
};

const renderAmountClass = (amount: number) => {
  if (amount > 0.009) return "amount-positive";
  if (amount < -0.009) return "amount-negative";
  return "amount-neutral";
};

export function ContactBalances({ rows }: Props) {
  return (
    <section className="panel">
      <div className="section-title-row">
        <h2>Contacts ledger</h2>
        <span className="chip">Memo-aware reconciliation</span>
      </div>
      <div className="contact-table">
        <div className="table-head">Contact</div>
        <div className="table-head">Net</div>
        <div className="table-head">Status</div>

        {rows.map((row) => (
          <div className="contact-row" key={row.contact.id}>
            <div className="contact-cell">
              <span className="avatar" style={{ backgroundColor: row.contact.avatarColor }}>
                {row.contact.name.charAt(0)}
              </span>
              <div>
                <p className="contact-name">{row.contact.name}</p>
                <p className="contact-handle">{row.contact.handle}</p>
              </div>
            </div>
            <div className={renderAmountClass(row.netUsd)}>
              {row.netUsd > 0 ? "+" : ""}
              {formatUsd(row.netUsd)}
            </div>
            <div className="status-cell">
              {row.statusLabel}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
