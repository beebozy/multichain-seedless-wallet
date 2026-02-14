import { AuthGate } from "../../components/app/auth-gate";
import { AppShell } from "../../components/app/app-shell";
import { SessionProvider } from "../../components/app/session-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <SessionProvider>
        <AppShell>{children}</AppShell>
      </SessionProvider>
    </AuthGate>
  );
}
