# Temvy Frontend: UI + Architecture Decisions

## 1) Product UX Direction
Decision: Contact-first payment UX (email/phone), not address-first.
Reason: Consumer mental model matches Venmo/Cash App.
Tradeoff: Requires reliable backend identity lookup and anti-fraud checks before send.

Decision: Unified USD balance at top + token/chain breakdown beneath.
Reason: Users care about spending power first, token internals second.
Tradeoff: Requires conversion/routing logic to keep USD view accurate and explainable.

Decision: Social ledger table ("Owes you" / "You owe" / "Settled") from transaction history.
Reason: Creates a sticky habit loop similar to Splitwise.
Tradeoff: Ledger quality depends on clean memos and consistent contact identity resolution.

## 2) Information Architecture
Decision: Two-column dashboard on desktop (left: overview/ledger/feed, right: send/copilot).
Reason: Keeps primary actions visible while preserving context.
Tradeoff: Higher density can feel busy; mobile collapses to single-column to maintain readability.

Decision: Chat-like transaction timeline instead of raw transaction table.
Reason: Reinforces consumer payment narrative over blockchain explorer feel.
Tradeoff: Harder to present advanced filtering compared with data-grid layouts.

## 3) Visual System
Decision: Warm-green + deep-blue gradient language with glass panels.
Reason: Signals "finance trust" without default fintech blandness.
Tradeoff: More custom styling effort and needs contrast checks for accessibility.

Decision: Expressive typography using Space Grotesk + Plus Jakarta Sans.
Reason: Better visual hierarchy and personality than default system fonts.
Tradeoff: External font load path adds small performance overhead.

## 4) Frontend Technical Architecture
Decision: Next.js App Router + TypeScript baseline.
Reason: Fast iteration, server/client composition flexibility, easy deployment.
Tradeoff: Slightly steeper architecture surface vs simple SPA.

Decision: Keep MVP state local with deterministic mock data utilities.
Reason: Demonstrates business logic now, swap API later with minimal UI rewrite.
Tradeoff: No realtime multi-user sync until backend integration lands.

Decision: Aggregate contact balances from transfer history in `lib/finance.ts`.
Reason: Makes balance logic explicit/testable, avoids hardcoded UI numbers.
Tradeoff: Need backend parity to avoid frontend/backend reconciliation drift.

## 5) Extensibility Choices
Decision: Stablecoin-aware types (`pathUSD`, `USDC`, `USDT`, `AlphaUSD`) in shared model.
Reason: Multi-chain support is first-class, not bolted on.
Tradeoff: More routing combinations and QA matrix as assets/chains grow.

Decision: Optional AI copilot panel is present but isolated.
Reason: Enables Track 3 demo moment without blocking core Track 1 flow.
Tradeoff: If shipped without quality grounding, AI output trust can drop quickly.

## 6) Security + Trust UX
Decision: UI language emphasizes "no keys, no gas, contact identities".
Reason: Reduces onboarding anxiety for non-crypto users.
Tradeoff: Must back this promise with clear backend guardrails and auditability.

## 7) What To Replace When Backend Is Ready
- Replace static contact list with `/contacts` API.
- Replace transfer history with paginated `/transfers` API.
- Replace local aggregation with backend-computed ledger endpoint.
- Add optimistic UI for send/request with idempotency keys.
- Add risk/fraud state banners before final send confirmation.

## 8) Imagery + Brand Atmosphere Decisions
Decision: Use high-resolution web imagery from Pexels in hero and proof cards.
Reason: Gives demo-grade polish and immediate trust/aspiration signals for judges and users.
Tradeoff: External image hosting can fail or load slowly; production should proxy or self-host optimized assets.

Decision: Pair cinematic imagery with translucent finance cards.
Reason: Feels modern and premium while preserving data legibility.
Tradeoff: More rendering complexity than flat UI, and needs careful contrast tuning on smaller screens.
