"use client";

import { useEffect, useState } from "react";
import { TransactionTimeline } from "../../../components/TransactionTimeline";
import { InlineNotice } from "../../../components/app/InlineNotice";
import { fetchDashboard, fetchNotifications } from "../../../lib/backend-api";
import { toFriendlyError } from "../../../lib/error-format";
import { mapContacts, mapTransfers } from "../../../lib/ui-adapters";
import { useSession } from "../../../components/app/session-context";
import type { Contact, Transfer } from "../../../lib/types";

export default function ActivityPage() {
  const { backendSession, appUserId, backendError, bootstrapping } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [notificationCount, setNotificationCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!backendSession || !appUserId) return;
      setError(null);

      try {
        const [dashboard, notifications] = await Promise.all([
          fetchDashboard(backendSession, appUserId),
          fetchNotifications(backendSession, appUserId, 10)
        ]);

        if (!cancelled) {
          setTransfers(mapTransfers(dashboard.transfers.data));
          setContacts(mapContacts(dashboard.ledger, dashboard.transfers.data));
          setNotificationCount(notifications.total);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load activity");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [appUserId, backendSession]);

  if (bootstrapping) {
    return <InlineNotice title="Preparing session" message="Checking authenticated context..." variant="info" />;
  }
  if (backendError) {
    const friendly = toFriendlyError(backendError);
    return <InlineNotice title={friendly.title} message={friendly.message} variant="error" />;
  }
  if (error) {
    const friendly = toFriendlyError(error);
    return <InlineNotice title={friendly.title} message={friendly.message} variant="error" />;
  }

  return (
    <section className="page-grid single-col">
      <section className="panel">
        <h2>Activity</h2>
        <p className="meta-text">Recent transfers and notification pipeline status.</p>
        {notificationCount !== null ? <p className="meta-text">Total notifications: {notificationCount}</p> : null}
      </section>
      <TransactionTimeline history={transfers} contacts={contacts} />
    </section>
  );
}
