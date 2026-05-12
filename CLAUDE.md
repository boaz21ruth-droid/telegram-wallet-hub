# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Telegram Mini App crypto wallet — React frontend + NestJS backend. Supports TON and USDT (on TON network) with on-chain deposits, withdrawals, and instant in-app transfers between users.

Live demo: https://telegram-hug-wallet.lovable.app

## Commands

### Frontend (repo root)
```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
```

### Backend (`backend/`)
```bash
npm run start:dev          # tsx watch (hot reload)
npm run build              # tsc compile to dist/
npm run start              # Run compiled dist/main.js
npm run lint               # TypeScript type check only
npm run prisma:generate    # Regenerate Prisma client
npm run prisma:migrate     # Run migrations (dev)
npm run prisma:studio      # Open Prisma Studio
```

### Running a single frontend test
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

### Frontend (`src/`)
- Single-page React 18 app, Vite + SWC, TypeScript, Tailwind CSS, shadcn/ui
- `@tanstack/react-query` for server state, `react-router-dom` for routing
- Path alias `@/` resolves to `src/`
- Currently one route (`/`) — the wallet home page assembled from isolated components: `WalletHeader`, `BalanceCard`, `ActionButtons`, `TokenList`, `TransactionList`, `BottomNav`
- Tests live in `src/test/` with jsdom environment; setup file at `src/test/setup.ts`

### Backend (`backend/`)
NestJS monolith with a global JWT auth guard (all routes are protected by default; use `@Public()` decorator to exempt a route).

**Modules:**
| Module | Responsibility |
|---|---|
| `auth` | Telegram `initData` verification, user upsert on first login, JWT session creation |
| `users` | User profile, KYC status, account status |
| `wallet` | Wallet accounts per user per asset/network, deposit addresses |
| `ledger` | Double-entry bookkeeping — all fund movements recorded as journals + entries |
| `transfers` | In-app transfers (atomic, instant, no chain) with `bizNo` idempotency key |
| `withdrawals` | Withdraw requests with balance freeze, manual review above threshold, status lifecycle |
| `health` | Health check endpoint |

**Supported assets** are defined in `backend/src/config/supported-assets.ts` (TON and USDT/TON). Adding a new asset/network requires updating this file — wallet accounts are auto-created per asset on first login.

**Ledger model:** Double-entry. Every fund movement (transfer, withdrawal freeze/release) creates a `LedgerJournal` with two `LedgerEntry` rows (DEBIT + CREDIT). `WalletAccount.availableBalance` / `frozenBalance` are denormalized cache fields driven by the ledger.

**Database:** PostgreSQL via Prisma (`backend/prisma/schema.prisma`). Schema includes: `User`, `AuthSession`, `WalletAccount`, `WalletAddress`, `LedgerJournal`, `LedgerEntry`, `TransferOrder`, `WithdrawOrder`, `AuditLog`.

## Backend Environment Variables

Required in `backend/.env`:
```
DATABASE_URL=postgresql://...
JWT_SECRET=<min 32 chars>
ADMIN_JWT_SECRET=<min 32 chars, must differ from JWT_SECRET>
TELEGRAM_BOT_TOKEN=<bot token>
```

Optional:
```
PORT=7001
JWT_EXPIRES_IN=2h
ADMIN_JWT_EXPIRES_IN=8h
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=86400
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=<min 8 chars>
ADMIN_BOOTSTRAP_ROLE=SUPER_ADMIN
WITHDRAW_MANUAL_REVIEW_THRESHOLD=1000
```

## Key Design Decisions

- **Custodial wallet model** — balances and signing are server-controlled
- **In-app transfers are preferred** over on-chain transfers (instant, zero fee, simpler)
- **Withdrawals ≥ `WITHDRAW_MANUAL_REVIEW_THRESHOLD`** require manual admin approval before signing
- **`bizNo` idempotency** on transfers: duplicate `(fromUserId, bizNo)` returns the existing order instead of creating a new one
- Authentication flow: Telegram `initData` → verify HMAC → upsert user → create `AuthSession` → sign JWT with `sessionId` — the guard re-validates the session on every request
