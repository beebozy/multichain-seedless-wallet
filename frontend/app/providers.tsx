"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { defineChain } from "viem";

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "REPLACE_WITH_PRIVY_APP_ID";
  const tempoRpc = process.env.NEXT_PUBLIC_TEMPO_RPC_URL || "https://rpc.moderato.tempo.xyz";
  const tempoChain = defineChain({
    id: 42431,
    name: "Tempo Moderato",
    nativeCurrency: {
      name: "TEMPO",
      symbol: "TPO",
      decimals: 18
    },
    rpcUrls: {
      default: { http: [tempoRpc] },
      public: { http: [tempoRpc] }
    }
  });

  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: tempoChain,
        supportedChains: [tempoChain],
        loginMethods: ["email", "sms"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users"
          },
          showWalletUIs: true
        },
        appearance: {
          theme: "light",
          accentColor: "#275efe"
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}
