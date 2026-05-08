# Telegram Wallet Hub

A custodial crypto wallet built as a **Telegram Mini App** — users open it directly inside Telegram without installing anything. Supports TON and USDT (Jetton on TON network) with on-chain deposits, withdrawals, and instant in-app transfers.

Live demo: https://telegram-hug-wallet.lovable.app

---

## Features

| Feature | Status |
|---------|--------|
| Telegram Mini App login (HMAC auth) | ✅ |
| TON native transfers (in-app, instant) | ✅ |
| USDT/TON Jetton transfers (in-app, instant) | ✅ |
| On-chain TON deposit detection (auto, 30s polling) | ✅ |
| On-chain USDT Jetton deposit detection (auto, 30s) | ✅ |
| On-chain withdrawal broadcast (hot wallet, auto) | ✅ |
| On-chain withdrawal confirmation (auto, 5 min) | ✅ |
| Telegram Bot push notifications (Chinese) | ✅ |
| TON address format validation (API layer) | ✅ |
| Double-entry ledger (all fund movements audited) | ✅ |
| Admin withdrawal review (manual approval above threshold) | ✅ |
| KYC status tracking | ✅ |

---

## Tech Stack

**Frontend**
- React 18, Vite + SWC, TypeScript
- Tailwind CSS, shadcn/ui
- @tanstack/react-query, react-router-dom

**Backend**
- NestJS (Node.js), TypeScript
- PostgreSQL + Prisma ORM
- JWT authentication, global auth guard
- @nestjs/schedule (cron jobs)
- @ton/ton + @ton/crypto (TON blockchain SDK)

---

## Supported Assets

| Asset | Network | Decimals | Withdraw Fee |
|-------|---------|----------|-------------|
| TON | TON | 9 | 0.05 TON |
| USDT | TON (Jetton) | 6 | 1 USDT |

---

## Architecture

### Frontend (`src/`)

Single-page React app. Main components: `WalletHeader`, `BalanceCard`, `ActionButtons`, `TokenList`, `TransactionList`, `BottomNav`. Pages: `WalletPage`, `HistoryPage`, `MarketPage`, `ProfilePage`.

### Backend (`backend/src/`)

NestJS monolith. All routes are JWT-protected by default; use `@Public()` to exempt a route.

| Module | Responsibility |
|--------|---------------|
| `auth` | Telegram `initData` HMAC verification, user upsert, JWT session |
| `users` | User profile, KYC, account status |
| `wallet` | Wallet accounts per user per asset/network, deposit addresses |
| `ledger` | Double-entry bookkeeping — all fund movements |
| `transfers` | In-app transfers (atomic, instant, `bizNo` idempotency) |
| `deposits` | Deposit management, admin manual credit, auto on-chain credit |
| `withdrawals` | Withdraw lifecycle: create → freeze → review → sign → confirm |
| `ton` | TON chain: deposit scanner (30s), hot wallet broadcaster (1min/5min) |
| `common/telegram` | Telegram Bot push notifications (global, fire-and-forget) |
| `common/validators` | `@IsTonAddress()` — TON address format validation |

### Ledger Model

Double-entry. Every fund movement creates a `LedgerJournal` with two `LedgerEntry` rows (DEBIT + CREDIT). `WalletAccount.availableBalance` / `frozenBalance` are denormalized cache fields driven by the ledger.

### On-Chain Deposit Flow

```
TonCenter API (30s poll)
  → DepositScannerService.scan()
  → TonService.getNewDeposits(address, lastLt, expectedJettonWallet)
  → DepositsService.creditDepositBySystem()   [idempotent via txHash unique]
  → LedgerService.recordDeposit()
  → TelegramNotificationService.sendMessage()
  → WalletAddress.lastScannedLt updated
```

### On-Chain Withdrawal Flow

```
WithdrawOrder (READY_FOR_SIGNING)
  → WithdrawalBroadcasterService (every 1 min)
  → HotWalletService.broadcastTonTransfer / broadcastUsdtTransfer()
  → WithdrawalsService.signWithdrawalBySystem()  [status → SIGNED]

WithdrawOrder (SIGNED)
  → WithdrawalBroadcasterService (every 5 min)
  → isTransactionConfirmed() via TonCenter
  → WithdrawalsService.confirmWithdrawalBySystem()  [status → CONFIRMED]
  → TelegramNotificationService.sendMessage()
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Telegram Bot Token ([BotFather](https://t.me/BotFather))

### Frontend

```bash
npm install
npm run dev        # Vite dev server (default port 5173)
npm run build      # Production build
```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in required values
npm run prisma:migrate
npm run start:dev      # hot reload dev server (port 3001)
```

### Backend Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/wallet
JWT_SECRET=<min 32 chars>
TELEGRAM_BOT_TOKEN=<from BotFather>

# Optional
PORT=3001
JWT_EXPIRES_IN=2h
TELEGRAM_INIT_DATA_MAX_AGE_SECONDS=86400
ADMIN_TELEGRAM_IDS=123456789,987654321
WITHDRAW_MANUAL_REVIEW_THRESHOLD=1000

# TON chain integration
TONCENTER_API_URL=https://toncenter.com/api/v2
TONCENTER_API_KEY=<from toncenter.com>
USDT_JETTON_MASTER_ADDRESS=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs

# On-chain withdrawals (leave empty to disable auto-broadcast)
TON_HOT_WALLET_MNEMONIC=word1 word2 ... word24
```

### Backend Commands

```bash
npm run start:dev          # tsx watch (hot reload)
npm run build              # tsc compile to dist/
npm run lint               # TypeScript type check
npm run prisma:generate    # Regenerate Prisma client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open Prisma Studio (DB browser)
```

---

## Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token
2. Set up a Mini App (Web App) pointing to your frontend URL
3. Set `TELEGRAM_BOT_TOKEN` in `.env`
4. Users must send `/start` to the bot at least once to receive push notifications

Push notifications are sent in Chinese for the following events:
- Transfer sent / received
- Deposit credited (on-chain auto or admin manual)
- Withdrawal submitted / approved / rejected / confirmed on-chain

---

## Key Design Decisions

- **Custodial model** — private keys and balances are server-controlled; users trust the operator
- **In-app transfers preferred** over on-chain (instant, zero fee, no gas)
- **Withdrawals ≥ `WITHDRAW_MANUAL_REVIEW_THRESHOLD`** require manual admin approval before broadcast
- **`bizNo` idempotency** on transfers — duplicate `(fromUserId, bizNo)` returns the existing order
- **`txHash` uniqueness** on deposits — prevents double-credit on retry/restart
- **Notifications are fire-and-forget** — a failed Telegram API call never fails a business transaction
- **Auth flow**: Telegram `initData` → HMAC verify → upsert user → create `AuthSession` → sign JWT

---

## Project Structure

```
telegram-wallet-hub/
├── src/                        # React frontend
│   ├── components/             # UI components
│   ├── pages/                  # Route pages
│   ├── contexts/               # React contexts
│   ├── hooks/                  # Custom hooks
│   └── lib/                    # API client
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── migrations/         # Migration history
│   └── src/
│       ├── config/             # env.ts, supported-assets.ts
│       ├── common/
│       │   ├── prisma/         # PrismaService (global)
│       │   ├── telegram/       # TelegramNotificationService (global)
│       │   ├── validators/     # @IsTonAddress()
│       │   ├── guards/         # JwtAuthGuard
│       │   ├── decorators/     # @CurrentUser(), @Public()
│       │   └── utils/          # decimal.util, telegram.util
│       └── modules/
│           ├── auth/
│           ├── users/
│           ├── wallet/
│           ├── ledger/
│           ├── deposits/
│           ├── transfers/
│           ├── withdrawals/
│           └── ton/            # DepositScannerService, HotWalletService, WithdrawalBroadcasterService
└── docs/
    └── superpowers/plans/      # Implementation plans
```
