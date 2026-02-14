"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/app/dashboard");
    }
  }, [authenticated, ready, router]);

  return (
    <main className="login-wrap">
      <section className="login-card panel">
        <p className="brand-mark">
          <span className="brand-script">Temvy</span>
          <span className="brand-sans">Wallet</span>
        </p>
        <h1>Payments without crypto complexity</h1>
        <p className="meta-text">Authenticate with Privy to unlock your secure wallet experience.</p>
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={login}>
          Continue with Privy
        </button>
      </section>
    </main>
  );
}
