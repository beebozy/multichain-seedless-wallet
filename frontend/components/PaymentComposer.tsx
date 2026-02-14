import { useState } from "react";
import { toFriendlyError } from "../lib/error-format";
import { InlineNotice } from "./app/InlineNotice";

type Props = {
  stablecoinOptions?: string[];
  onSend?: (input: { recipientHandle: string; amountUsd: number; stablecoin: string; memo?: string }) => Promise<void>;
};

const defaultTokens = ["pathUSD", "USDC", "USDT", "AlphaUSD"];

export function PaymentComposer({ stablecoinOptions, onSend }: Props) {
  const tokens = stablecoinOptions && stablecoinOptions.length > 0 ? stablecoinOptions : defaultTokens;
  const [recipientHandle, setRecipientHandle] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [stablecoin, setStablecoin] = useState(tokens[0] ?? "pathUSD");
  const [memo, setMemo] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const handleSend = async () => {
    if (!onSend) {
      setStatus({ type: "error", message: "Connect backend first to send." });
      return;
    }
    if (!recipientHandle || !amountUsd || Number(amountUsd) <= 0) {
      setStatus({ type: "error", message: "Enter recipient and valid amount." });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await onSend({
        recipientHandle: recipientHandle.trim(),
        amountUsd: Number(amountUsd),
        stablecoin,
        memo: memo.trim() || undefined
      });
      setStatus({ type: "success", message: "Payment submitted and awaiting settlement." });
      setMemo("");
      setAmountUsd("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      const friendly = toFriendlyError(message);
      setStatus({ type: "error", message: `${friendly.title}: ${friendly.message}` });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="panel composer-panel">
      <div className="section-title-row">
        <h2>Send money</h2>
        <span className="chip">No wallet address required</span>
      </div>
      <form
        className="composer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <label>
          Send to (email / phone)
          <input
            type="text"
            placeholder="john@gmail.com"
            aria-label="Recipient"
            value={recipientHandle}
            onChange={(e) => setRecipientHandle(e.target.value)}
          />
        </label>
        <label>
          Amount (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="25.00"
            aria-label="Amount"
            value={amountUsd}
            onChange={(e) => setAmountUsd(e.target.value)}
          />
        </label>
        <label>
          Stablecoin route
          <select
            aria-label="Stablecoin"
            value={stablecoin}
            onChange={(e) => setStablecoin(e.target.value)}
          >
            {tokens.map((token) => (
              <option value={token} key={token}>
                {token}
              </option>
            ))}
          </select>
        </label>
        <label>
          Memo
          <input
            type="text"
            placeholder="Dinner split"
            aria-label="Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>
        <div className="composer-actions">
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Sending..." : "Pay now"}
          </button>
          <button type="button" className="btn btn-secondary">
            Request instead
          </button>
        </div>
        {status ? (
          <InlineNotice
            title={status.type === "success" ? "Success" : "Payment failed"}
            message={status.message}
            variant={status.type === "success" ? "success" : "error"}
          />
        ) : null}
      </form>
      <div className="quick-actions">
        <button type="button" className="ghost-chip">
          Split bill
        </button>
        <button type="button" className="ghost-chip">
          Batch payout
        </button>
        <button type="button" className="ghost-chip">
          QR checkout
        </button>
      </div>
    </section>
  );
}
