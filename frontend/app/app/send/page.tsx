"use client";

import { useEffect, useMemo, useState } from "react";
import { getEmbeddedConnectedWallet, useCreateWallet, useWallets } from "@privy-io/react-auth";
import { PaymentComposer } from "../../../components/PaymentComposer";
import { InlineNotice } from "../../../components/app/InlineNotice";
import { confirmSignedPayment, fetchDashboard, prepareSignedPayment, resolveRecipient } from "../../../lib/backend-api";
import { toFriendlyError } from "../../../lib/error-format";
import { useSession } from "../../../components/app/session-context";

export default function SendPage() {
  const { backendSession, appUserId, backendError, bootstrapping } = useSession();
  const { createWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const [stablecoins, setStablecoins] = useState<string[]>(["pathUSD"]);
  const [message, setMessage] = useState<string | null>(null);
  const backendFriendly = backendError ? toFriendlyError(backendError) : null;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!backendSession || !appUserId) return;

      try {
        const data = await fetchDashboard(backendSession, appUserId);
        const assets = data.balances.balances.map((entry) => entry.asset);
        if (!cancelled) {
          setStablecoins(assets.length > 0 ? assets : ["pathUSD"]);
        }
      } catch {
        if (!cancelled) {
          setStablecoins(["pathUSD"]);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [appUserId, backendSession]);

  const canSend = useMemo(() => Boolean(backendSession && appUserId && !backendError), [appUserId, backendError, backendSession]);

  return (
    <section className="page-grid single-col">
      <div className="stack">
        <section className="panel">
          <h2>Send payment</h2>
          <p className="meta-text">This uses Privy embedded wallet signing (prepare -&gt; sign/send -&gt; confirm).</p>
        </section>
        {bootstrapping ? (
          <InlineNotice title="Preparing session" message="Verifying your Privy identity and backend account..." variant="info" />
        ) : null}
        {backendFriendly ? <InlineNotice title={backendFriendly.title} message={backendFriendly.message} variant="error" /> : null}
        <PaymentComposer
          stablecoinOptions={stablecoins}
          onSend={
            canSend
              ? async (input) => {
                  if (!backendSession) throw new Error("Backend session missing");
                  let embeddedWallet = getEmbeddedConnectedWallet(wallets);
                  if (!embeddedWallet?.address) {
                    throw new Error("No Privy embedded wallet available. Re-login and ensure embedded wallet is enabled.");
                  }

                  const sendOnce = async (walletAddress: string) => {
                    const wallet = getEmbeddedConnectedWallet(wallets);
                    const provider = await wallet?.getEthereumProvider();
                    if (!provider) {
                      throw new Error("No embedded wallet signer available. Re-login and unlock embedded wallet.");
                    }

                    await resolveRecipient(backendSession, input.recipientHandle);
                    const prepared = await prepareSignedPayment(backendSession, input);
                    const txHash = await provider.request({
                      method: "eth_sendTransaction",
                      params: [
                        {
                          from: walletAddress,
                          to: prepared.txRequest.to,
                          data: prepared.txRequest.data,
                          value: "0x0",
                          gas: prepared.txRequest.gasLimit
                            ? `0x${BigInt(prepared.txRequest.gasLimit).toString(16)}`
                            : undefined
                        }
                      ]
                    });
                    if (!txHash || typeof txHash !== "string") {
                      throw new Error("Failed to broadcast transaction from embedded wallet.");
                    }
                    await confirmSignedPayment(backendSession, { paymentId: prepared.paymentId, txHash });
                    setMessage(`Payment submitted onchain: ${txHash}`);
                  };

                  try {
                    await sendOnce(embeddedWallet.address);
                  } catch (error) {
                    const text = error instanceof Error ? error.message : String(error);
                    const repairable =
                      text.includes("No valid authorization keys or user signing keys available") ||
                      text.includes("Recovery method not supported");
                    if (!repairable) {
                      throw error;
                    }

                    await createWallet();
                    embeddedWallet = getEmbeddedConnectedWallet(wallets);
                    if (!embeddedWallet?.address) {
                      throw new Error("Embedded wallet could not be recovered. Log out and log in again.");
                    }
                    await sendOnce(embeddedWallet.address);
                  }
                }
            : undefined
        }
        />
        {message ? <InlineNotice title="Payment submitted" message={message} variant="success" /> : null}
      </div>
    </section>
  );
}
