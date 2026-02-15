# Temvy Wallet

Temvy Wallet is a consumer payments app that makes stablecoin transfers feel like chat payments.
Users authenticate with Privy (email/phone), wallets are abstracted away, and Tempo rails handle settlement underneath.

## What It Solves
- Wallet UX friction for non-crypto users
- Sending to unreadable wallet addresses
- Manual tracking of who owes who
- Fragmented token/chain mental model

Temvy replaces this with:
- Contact-based sending (`email` / `phone`)
- Invisible wallet flow (no keys, no gas concepts in UX)
- Social finance dashboard with inflow/outflow visibility
- Fast settlement on Tempo

## Core Features
- Privy-authenticated onboarding from landing page
- Authenticated app routes (`/app/*`) with guarded access
- Send payments to recipient handles
- Pending claim flow for unregistered recipients
- Dashboard with balance, activity, and inflow/outflow chart
- Batch payout and split-bill flows
- Memo-aware transaction context

## Product Architecture
- Frontend: Next.js (App Router), custom responsive web3 UI
- Backend: NestJS APIs, Postgres-backed persistence
- Identity: Privy
- Settlement: Tempo-compatible onchain transfer flow


## Demo Flow (Judge-Friendly)
1. Open landing page and authenticate via Privy
2. Redirect into dashboard automatically
3. Send payment to email/phone handle
4. Show inflow/outflow graph and activity update
5. Trigger split or batch flow to show depth

## Local Setup

### Prerequisites
- Node.js 20+
- npm
- PostgreSQL 14+

### 1) Install dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure environment
- Backend env: `/backend/.env`
- Frontend env: `/frontend/.env.local`

Minimum backend note:
- Set `DATABASE_URL` (Postgres)
- Set Privy auth env (`AUTH_JWKS_URL`, `AUTH_ISSUER`, `AUTH_AUDIENCE`)
- Set chain env (`TEMPO_RPC_URL`, token config)

### 3) Run backend
```bash
cd backend
npm run start:dev
```

### 4) Run frontend
```bash
cd frontend
npm run dev
```

Open: `http://localhost:3000`


## Collaborators
- Tola — Product, Engineering, Backend Integration
-

## License
Project is for hackathon/demo use unless a separate license is added.
