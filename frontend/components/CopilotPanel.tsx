import { formatUsd } from "../lib/finance";

type Props = {
  weeklySpend: number;
  topMemo: string;
  topMemoAmount: number;
};

export function CopilotPanel({ weeklySpend, topMemo, topMemoAmount }: Props) {
  return (
    <section className="panel copilot-panel">
      <div className="section-title-row">
        <h2>AI finance copilot</h2>
        <span className="chip chip-accent">Optional track booster</span>
      </div>
      <p className="copilot-question">How much did I spend last week?</p>
      <div className="copilot-answer">
        <p>
          You spent <strong>{formatUsd(weeklySpend)}</strong> in the last 7 days.
        </p>
        <p>
          Biggest expense: <strong>{topMemo}</strong> ({formatUsd(topMemoAmount)}).
        </p>
      </div>
      <p className="copilot-note">Generated from transfer history + memo parsing.</p>
    </section>
  );
}
