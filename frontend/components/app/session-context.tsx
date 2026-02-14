"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { privyUpsert, type BackendSession } from "../../lib/backend-api";
import { extractEmail, extractPhone, extractPrivyUserId, extractWallet, extractWalletId } from "../../lib/user-extractors";

type SessionState = {
  ready: boolean;
  authenticated: boolean;
  bootstrapping: boolean;
  backendSession: BackendSession | null;
  appUserId: string | null;
  backendError: string | null;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:3001";
const allowDevHeaders = (process.env.NEXT_PUBLIC_USE_DEV_HEADERS ?? "true") === "true";
const forcedDevRole = process.env.NEXT_PUBLIC_DEV_ROLE;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const { wallets } = useWallets();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [backendSession, setBackendSession] = useState<BackendSession | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!ready || !authenticated) {
        setAppUserId(null);
        setBackendSession(null);
        setBackendError(null);
        return;
      }

      setBootstrapping(true);
      setBackendError(null);

      try {
        const token = await getAccessToken();
        const privyUserId = extractPrivyUserId(user);
        const embeddedEthereumWallet = wallets.find(
          (wallet) => wallet.type === "ethereum" && wallet.walletClientType === "privy"
        );
        const walletAddress = embeddedEthereumWallet?.address ?? extractWallet(user);
        const email = extractEmail(user);
        const phone = extractPhone(user);
        if (!privyUserId || !walletAddress) {
          throw new Error("Unable to extract Privy user id or wallet address.");
        }
        const walletId = extractWalletId(user, walletAddress);

        const session: BackendSession = {
          baseUrl: backendBaseUrl,
          bearerToken: token || undefined,
          devHeaders: allowDevHeaders
            ? {
                userId: privyUserId,
                email,
                phone,
                wallet: walletAddress,
                walletId,
                role: forcedDevRole
              }
            : undefined
        };

        if (!session.bearerToken && !session.devHeaders?.userId) {
          throw new Error("Missing auth headers: no bearer token and no dev header fallback.");
        }

        const upsert = await privyUpsert(session, {
          privyUserId,
          walletAddress,
          walletId,
          email,
          phone
        });

        if (!cancelled) {
          setBackendSession(session);
          setAppUserId(upsert.userId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Session bootstrap failed.";
        if (!cancelled) {
          setBackendError(message);
          setBackendSession(null);
          setAppUserId(null);
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, ready, user, wallets]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      authenticated,
      bootstrapping,
      backendSession,
      appUserId,
      backendError,
      logout
    }),
    [appUserId, authenticated, backendError, backendSession, bootstrapping, logout, ready]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
