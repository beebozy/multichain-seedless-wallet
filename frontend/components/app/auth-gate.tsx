"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !authenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [authenticated, pathname, ready, router]);

  if (!ready || !authenticated) {
    return <div className="full-loader">Checking secure session...</div>;
  }

  return <>{children}</>;
}
