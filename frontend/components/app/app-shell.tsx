"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { toFriendlyError } from "../../lib/error-format";
import { InlineNotice } from "./InlineNotice";
import { useSession } from "./session-context";

const navItems = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/send", label: "Send" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout, appUserId, backendError } = useSession();
  const friendly = backendError ? toFriendlyError(backendError) : null;

  return (
    <main className="app-shell">
      <aside className="sidebar panel">
        <p className="brand-mark">
          <span className="brand-script">Temvy</span>
          <span className="brand-sans">Wallet</span>
        </p>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "nav-link active" : "nav-link"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="meta-text">User: {appUserId ?? "unknown"}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
            Logout
          </button>
        </div>
      </aside>
      <section className="app-main">
        <header className="app-topbar panel">
          <p className="meta-text">Authenticated with Privy</p>
          <ThemeSwitcher />
        </header>
        {friendly ? <InlineNotice title={friendly.title} message={friendly.message} variant="error" /> : null}
        {children}
      </section>
    </main>
  );
}
