"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PaymentComposer } from "../../../components/PaymentComposer";
import { InlineNotice } from "../../../components/app/InlineNotice";
import { confirmSignedPayment, fetchDashboard, prepareSignedPayment } from "../../../lib/backend-api";
import { toFriendlyError } from "../../../lib/error-format";
import { useSession } from "../../../components/app/session-context";

export default function SendPage() {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { backendSession, appUserId, backendError, bootstrapping } = useSession();
  const [stablecoins, setStablecoins] = useState<string[]>(["pathUSD"]);
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null);
  const backendFriendly = backendError ? toFriendlyError(backendError) : null;
  const defaultChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 42431);
  const fallbackGasLimit = 350000n;
  const embeddedWallet = useMemo(
    () => wallets.find((wallet) => wallet.type === "ethereum" && wallet.walletClientType === "privy"),
    [wallets]
  );

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

  const applyPaymentResultMessage = (result: {
    status: "initiated" | "pending_claim" | "submitted" | "settled" | "failed" | "expired";
    txHash?: string;
    recipientHandle: string;
    expiresAt?: string;
    failureMessage?: string;
  }) => {
    const txHash = result.txHash;
    if (result.status === "pending_claim") {
      const expiry = result.expiresAt ? new Date(result.expiresAt).toLocaleString() : "the claim window";
      const body = `Invite created for ${result.recipientHandle}. Funds release automatically after signup before ${expiry}.`;
      setMessage({ title: "Pending claim created", body });
      return { successMessage: body };
    }
    if (result.status === "settled") {
      const body = txHash ? `Payment settled onchain: ${txHash}` : "Payment settled successfully.";
      setMessage({ title: "Payment settled", body });
      return { successMessage: body };
    }
    if (result.status === "submitted" || result.status === "initiated") {
      const body = txHash ? `Payment submitted: ${txHash}` : "Payment submitted for settlement.";
      setMessage({ title: "Payment submitted", body });
      return { successMessage: body };
    }
    if (result.status === "expired") {
      const body = "Claim window expired before recipient signup. Please resend.";
      setMessage({ title: "Claim expired", body });
      return { successMessage: body };
    }
    const failure = result.failureMessage ?? "Payment failed.";
    throw new Error(failure);
  };

  const quantityHex = (value: string | bigint): `0x${string}` => {
    const parsed = typeof value === "bigint" ? value : BigInt(value);
    return `0x${parsed.toString(16)}`;
  };

  return (
    <section className="page-grid single-col">
      <div className="stack">
        <section className="panel">
          <h2>Send payment</h2>
          <p className="meta-text">Frontend signs directly with the embedded Privy wallet, then backend confirms the payment intent.</p>
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
                  const freshToken = await getAccessToken();
                  const session = {
                    ...backendSession,
                    bearerToken: freshToken || backendSession.bearerToken
                  };
                  // Disabled for now: backend-authorized sendPayment() flow.
                  const prepared = await prepareSignedPayment(session, input);
                  let gasLimit = fallbackGasLimit;
                  try {
                    if (prepared.txRequest.gasLimit) {
                      gasLimit = BigInt(prepared.txRequest.gasLimit);
                    }
                  } catch {
                    gasLimit = fallbackGasLimit;
                  }
                  if (!embeddedWallet?.address) {
                    throw new Error("No Privy embedded wallet connected for frontend signing.");
                  }
                  await embeddedWallet.switchChain(prepared.txRequest.chainId ?? defaultChainId);
                  const provider = await embeddedWallet.getEthereumProvider();
                  const txHash = await provider.request({
                    method: "eth_sendTransaction",
                    params: [
                      {
                        from: embeddedWallet.address,
                        to: prepared.txRequest.to,
                        data: prepared.txRequest.data,
                        value: prepared.txRequest.value,
                        gas: quantityHex(gasLimit)
                      }
                    ]
                  });
                  const confirmed = await confirmSignedPayment(session, {
                    paymentId: prepared.paymentId,
                    txHash: String(txHash)
                  });
                  return applyPaymentResultMessage(confirmed);
                }
              : undefined
          }
        />
        {message ? <InlineNotice title={message.title} message={message.body} variant="success" /> : null}
      </div>
    </section>
  );
}
