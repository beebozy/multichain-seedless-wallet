import type { Contact, Transfer } from "../lib/types";
import { formatDateLabel, formatUsd } from "../lib/finance";

type Props = {
  history: Transfer[];
  contacts: Contact[];
};

const byNewest = (a: Transfer, b: Transfer) => {
  return new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf();
};

export function TransactionTimeline({ history, contacts }: Props) {
  const sorted = [...history].sort(byNewest);

  const lookup = new Map(contacts.map((c) => [c.id, c]));

  return (
    <section className="panel">
      <div className="section-title-row">
        <h2>Activity feed</h2>
        <span className="chip">Chat-like timeline</span>
      </div>
      <div className="timeline-list">
        {sorted.map((item) => {
          const contact = lookup.get(item.contactId);
          const isIncoming = item.direction === "received";
          return (
            <article key={item.id} className="timeline-item">
              <div className="timeline-main">
                <p className="timeline-name">{contact?.name ?? "Unknown contact"}</p>
                <p className="timeline-memo">{item.memo}</p>
                <p className="timeline-meta">
                  {item.stablecoin} on {item.chainLabel} · {formatDateLabel(item.createdAt)}
                </p>
              </div>
              <p className={isIncoming ? "amount-positive" : "amount-negative"}>
                {isIncoming ? "+" : "-"}
                {formatUsd(item.amountUsd)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
