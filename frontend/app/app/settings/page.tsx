"use client";

import { usePrivy } from "@privy-io/react-auth";

export default function SettingsPage() {
  const { user } = usePrivy();
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3001";
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "REPLACE_WITH_PRIVY_APP_ID";

  return (
    <section className="page-grid single-col">
      <section className="panel">
        <h2>Settings</h2>
        <p className="meta-text">Environment + identity diagnostics.</p>
      </section>
      <section className="panel settings-list">
        <p>
          <strong>Privy App ID:</strong> {appId}
        </p>
        <p>
          <strong>Backend URL:</strong> {backend}
        </p>
        <p>
          <strong>Privy User:</strong> {(user as { id?: string } | undefined)?.id ?? "Not available"}
        </p>
      </section>
    </section>
  );
}
