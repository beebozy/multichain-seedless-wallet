# Backend Thread Brief: Invisible Wallet (Tempo + Privy)

Use this as the prompt/context for the backend implementation thread.

## Goal
Implement backend services that make frontend UX real:
- Send to email/phone
- Social ledger reconciliation
- Multi-chain stablecoin aggregation
- Optional AI spend summary

## Suggested Build Order (and Why)
1. Identity + contact mapping service
Reason: every other flow depends on reliable recipient resolution.
Tradeoff: need strict privacy boundaries for contact data.

2. Transfer orchestration service (Tempo rails + fee sponsorship)
Reason: core value is instant, invisible payment execution.
Tradeoff: orchestration complexity increases with multi-chain failover.

3. Ledger aggregation engine
Reason: powers social dashboard and settlement states.
Tradeoff: eventual consistency vs expensive synchronous recompute.

4. Stablecoin valuation + normalization
Reason: unified USD balance is key UX promise.
Tradeoff: requires robust pricing source/fallback strategy.

5. AI analytics endpoint (optional)
Reason: strong demo differentiator once core reliability exists.
Tradeoff: latency/cost and hallucination risk; must be grounded in ledger data.

## API Surface (MVP)
- `POST /v1/auth/resolve-recipient`
  - Input: `{ handle: string }` (email/phone)
  - Output: recipient wallet metadata + safety flags

- `POST /v1/payments/send`
  - Input: `{ senderUserId, recipientHandle, amountUsd, stablecoin, memo, idempotencyKey }`
  - Output: `{ paymentId, status, chain, txHash?, sponsoredFee: boolean }`

- `GET /v1/contacts/ledger?userId=...`
  - Output: net balances per contact (`owes_you`, `you_owe`, `settled`)

- `GET /v1/wallet/balances?userId=...`
  - Output: per-token balances + normalized USD total

- `GET /v1/transfers?userId=...&cursor=...`
  - Output: paginated transfer feed with memo + counterparty context

- `GET /v1/insights/weekly-spend?userId=...` (optional)
  - Output: computed spend summary + top categories/memos

## Data Model (MVP)
- `users` (id, privy_user_id, primary_handle, created_at)
- `contact_methods` (user_id, email?, phone?, verified)
- `wallet_accounts` (user_id, chain, wallet_address, custody_type)
- `payments` (id, sender_user_id, recipient_user_id, amount_usd, stablecoin, memo, status, idempotency_key)
- `payment_events` (payment_id, event_type, payload, created_at)
- `price_snapshots` (asset, usd_price, source, captured_at)

## Critical Technical Choices + Tradeoffs
Decision: Event-driven payment state machine (`initiated -> submitted -> settled/failed`).
Reason: gives observability and retries.
Tradeoff: more operational complexity than request/response writes.

Decision: Idempotency required for send endpoint.
Reason: prevents double charge on retries.
Tradeoff: additional storage/indexing and expiration policy management.

Decision: Server-side ledger aggregation endpoint.
Reason: consistent accounting across web/mobile clients.
Tradeoff: compute load; may need incremental materialized views.

Decision: Store memo and normalized category fields.
Reason: required for social reconciliation + AI summaries.
Tradeoff: introduces moderation and abuse-filter responsibilities.

## Non-Functional Requirements
- P95 send endpoint < 700ms before chain submission acknowledgment
- Full audit trail for each payment attempt
- Replay-safe webhooks and on-chain event handlers
- Rate limiting + anomaly detection on recipient resolution and send

## Backend Thread Acceptance Criteria
- Frontend can replace mock data with live endpoints without changing UI contracts.
- Send flow supports idempotent retries and returns stable payment IDs.
- Ledger endpoint returns deterministic contact net balances.
- Balance endpoint returns both token-level and normalized USD totals.
