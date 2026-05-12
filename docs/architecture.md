# 系统架构文档

## 技术栈

| 层次 | 技术 |
|---|---|
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| 后端框架 | NestJS 10 (TypeScript) |
| 数据库 | PostgreSQL（Prisma ORM） |
| 用户认证 | Telegram Web App `initData` 验签 + JWT |
| 管理员认证 | 用户名 + bcrypt 密码 + 独立 AdminSession + JWT |
| 运行时 | Node.js（开发用 tsx watch） |

---

## 整体架构

```
┌───────────────────────────────────────────────────────────┐
│  浏览器 / Telegram WebApp                                  │
│                                                           │
│  ┌─────────────────────┐   ┌──────────────────────────┐  │
│  │  用户前端             │   │  管理前端                  │  │
│  │  index.html  (/)    │   │  admin-app/index.html    │  │
│  │  src/user-main.tsx  │   │  src/admin-main.tsx      │  │
│  │  AuthContext        │   │  AdminAuthContext         │  │
│  │  access_token       │   │  admin_access_token       │  │
│  └──────────┬──────────┘   └────────────┬─────────────┘  │
│             │ /api/*                    │ /api/admin*     │
└─────────────┼────────────────────────────┼────────────────┘
              │                            │
              ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│  NestJS Backend  (port 7001)                                │
│                                                             │
│  JwtAuthGuard (全局)           AdminGuard (手动挂载)          │
│  /api/auth/*                  /api/admin-auth/*             │
│  /api/wallet/*                /api/admin/users/*            │
│  /api/transfers/*             /api/admin/deposits/*         │
│  /api/withdrawals/*           /api/admin/withdrawals/*      │
│  /api/deposits/*              /api/admin/wallet/*           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                   PostgreSQL (Prisma)
```

---

## 两个独立前端入口

Vite 通过 `rollupOptions.input` 同时构建两个入口：

```ts
// vite.config.ts
input: {
  main:  "index.html",           // 用户站点
  admin: "admin-app/index.html", // 管理站点
}
```

| 入口 | HTML 文件 | 主文件 | Router basename | Token key |
|---|---|---|---|---|
| 用户站点 | `index.html` | `src/user-main.tsx` → `App.tsx` | `/` | `access_token` |
| 管理站点 | `admin-app/index.html` | `src/admin-main.tsx` → `AdminApp.tsx` | `/admin-app` | `admin_access_token` |

两个入口共享同一 `src/` 源码目录，但各自拥有独立的 Context、localStorage key 和 API 请求函数（`userRequest` vs `adminRequest`），彼此完全隔离。

### 用户端路由

```
/        → Index（钱包主页）
/*       → NotFound
```

### 管理端路由

| 路径 | 页面 | 所需权限 |
|---|---|---|
| `/login` | 登录页 | 公开 |
| `/dashboard` | 数据概览 | `dashboard:view` |
| `/users` | 用户列表 | `users:view` |
| `/users/:id` | 用户详情 | `users:view` |
| `/deposits` | 充值记录 | `deposits:view` |
| `/withdrawals` | 提现队列 | `withdrawals:view` |
| `/withdrawals/:id` | 提现详情 | `withdrawals:view` |
| `/adjustments` | 余额调整 | `adjustments:view` |
| `/audit-logs` | 操作审计 | `audit:view` |

---

## 模块结构

```
backend/src/
├── main.ts                      # 启动入口，注册全局管道 / 过滤器
├── app.module.ts                # 根模块，注册所有子模块 + 全局 JWT Guard
├── config/
│   ├── env.ts                   # 环境变量 Zod schema + 缓存 getter
│   └── supported-assets.ts     # 支持的资产/网络配置
├── common/
│   ├── auth/                    # JWT Payload 接口（用户 + 管理员）
│   ├── decorators/              # @Public() / @CurrentUser() / @CurrentAdmin()
│   ├── filters/                 # HttpExceptionFilter（统一错误格式）
│   ├── guards/                  # JwtAuthGuard（全局） / AdminGuard（手动挂载）
│   ├── prisma/                  # PrismaService（全局）
│   ├── types/                   # AuthenticatedUser / AuthenticatedAdmin 类型
│   └── utils/                   # decimal.util / telegram.util / password.util
└── modules/
    ├── health/                  # GET /health（公开）
    ├── auth/                    # 用户登录 / 登出 / 当前用户
    ├── admin-auth/              # 管理员登录 / 登出 / 当前管理员 / bootstrap 账号
    ├── users/                   # 用户资料 / 管理员用户管理
    ├── wallet/                  # 钱包账户 / 交易记录 / 充值地址 / 余额调整 / 审计日志
    ├── deposits/                # 充值订单 / 管理员入账 / 充值地址分配
    ├── ledger/                  # 双分录账本服务（内部，无 HTTP 端点）
    ├── transfers/               # 站内转账
    ├── withdrawals/             # 提现申请 + 完整审核/签名/确认流程
    ├── ton/                     # TON 链扫块、入账检测、热钱包广播
    └── trc20/                   # TRC20 链扫块、入账检测、热钱包广播
```

---

## 认证与鉴权

### 用户认证流程

```
前端（Telegram Mini App）
  └─> 获取 Telegram.WebApp.initData
  └─> POST /api/auth/telegram/login { initData }
        └─> 后端验证 HMAC-SHA256 签名
        └─> 验证 auth_date 不超过 TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
        └─> upsert User + 创建 WalletAccount（所有支持资产）
        └─> 创建 AuthSession（7 天有效期）
        └─> 签发 JWT（JWT_EXPIRES_IN，默认 2h，含 sessionId）
  └─> 响应：{ accessToken, user }
```

**用户请求鉴权（JwtAuthGuard 全局）：**

1. 提取 `Authorization: Bearer <token>` 头
2. 验证 JWT 签名（`JWT_SECRET`）
3. 从 `AuthSession` 表查询 session（未吊销、未过期）
4. 验证 `User.status === ACTIVE`
5. 将 `AuthenticatedUser` 注入 `request.user`

标记 `@Public()` 的端点跳过此检查。

### 管理员认证流程

```
管理员前端
  └─> 输入 username + password
  └─> POST /api/admin-auth/login { username, password }
        └─> 查找 AdminAccount（必须 isActive=true）
        └─> bcrypt 校验密码
        └─> 创建 AdminSession（7 天有效期）
        └─> 签发 JWT（ADMIN_JWT_SECRET，ADMIN_JWT_EXPIRES_IN 默认 8h）
  └─> 响应：{ accessToken, admin }
```

**管理员请求鉴权（AdminGuard，手动 @UseGuards）：**

1. 提取 `Authorization: Bearer <token>` 头
2. 验证 JWT 签名（`ADMIN_JWT_SECRET` 或回退到 `JWT_SECRET`）
3. 从 `AdminSession` 表查询 session（未吊销、未过期）
4. 验证 `admin.isActive === true`
5. 将 `AuthenticatedAdmin` 注入 `request.admin`

管理员路由全部以 `@UseGuards(AdminGuard)` 显式保护，与全局 `JwtAuthGuard` 完全独立。

### 用户/管理员认证隔离对照

| 维度 | 用户 | 管理员 |
|---|---|---|
| 身份来源 | Telegram initData | 独立 `AdminAccount` 表 |
| 登录凭证 | Telegram HMAC | username + bcrypt 密码 |
| JWT secret | `JWT_SECRET` | `ADMIN_JWT_SECRET`（可选，回退到 `JWT_SECRET`） |
| JWT 有效期 | `JWT_EXPIRES_IN`（默认 2h） | `ADMIN_JWT_EXPIRES_IN`（默认 8h） |
| 会话表 | `AuthSession` | `AdminSession` |
| localStorage key | `access_token` | `admin_access_token` |
| 守卫 | `JwtAuthGuard`（全局） | `AdminGuard`（路由手动挂载） |
| 前端 Context | `AuthContext` | `AdminAuthContext` |

### Bootstrap 管理员账号

`AdminAuthService.onModuleInit()` 启动时自动 upsert：

- **生产环境**：读取 `ADMIN_BOOTSTRAP_USERNAME` + `ADMIN_BOOTSTRAP_PASSWORD`
- **开发环境**：默认 `admin` / `admin123456`（仅当 `NODE_ENV !== production`）
- 若两者均未提供，则跳过，不创建

### 管理员角色与权限

**角色：**

| 角色 | 说明 |
|---|---|
| `SUPER_ADMIN` | 全部权限 |
| `OPS_REVIEWER` | 用户管理、充值查看/地址分配、提现查看/审核 |
| `FINANCE_OPERATOR` | 充值入账、提现签名/确认/失败、余额调整 |

**权限矩阵：**

| 权限 | SUPER_ADMIN | OPS_REVIEWER | FINANCE_OPERATOR |
|---|:---:|:---:|:---:|
| `dashboard:view` | ✓ | ✓ | ✓ |
| `users:view` | ✓ | ✓ | — |
| `users:edit` | ✓ | ✓ | — |
| `deposits:view` | ✓ | ✓ | ✓ |
| `deposits:credit` | ✓ | — | ✓ |
| `deposits:assign_address` | ✓ | ✓ | — |
| `withdrawals:view` | ✓ | ✓ | ✓ |
| `withdrawals:review` | ✓ | ✓ | — |
| `withdrawals:sign` | ✓ | — | ✓ |
| `withdrawals:confirm` | ✓ | — | ✓ |
| `withdrawals:fail` | ✓ | — | ✓ |
| `adjustments:view` | ✓ | — | ✓ |
| `adjustments:create` | ✓ | — | ✓ |
| `audit:view` | ✓ | ✓ | ✓ |

---

## 数据模型

### 枚举

| 枚举 | 值 |
|---|---|
| `UserRole` | USER / ADMIN（遗留字段，管理权限已迁移至 AdminAccount） |
| `AdminRole` | SUPER_ADMIN / OPS_REVIEWER / FINANCE_OPERATOR |
| `UserStatus` | ACTIVE / SUSPENDED / DISABLED |
| `KycStatus` | UNVERIFIED / PENDING / VERIFIED / REJECTED |
| `WalletAccountStatus` | ACTIVE / FROZEN / CLOSED |
| `DepositStatus` | PENDING / CONFIRMED / FAILED |
| `TransferStatus` | SUCCESS / FAILED |
| `WithdrawStatus` | PENDING_REVIEW / READY_FOR_SIGNING / REJECTED / CANCELED / SIGNED / CONFIRMED / FAILED |
| `ReviewStatus` | NOT_REQUIRED / PENDING / APPROVED / REJECTED |
| `JournalType` | DEPOSIT / TRANSFER / WITHDRAWAL_FREEZE / WITHDRAWAL_RELEASE / WITHDRAWAL_CONFIRM / ADJUSTMENT |
| `JournalStatus` | POSTED / REVERSED |
| `LedgerEntryDirection` | DEBIT / CREDIT |
| `AuditActorType` | USER / ADMIN / SYSTEM |

### 实体关系

```
User ──< AuthSession
User ──< WalletAccount ──< WalletAddress
                       ──< LedgerEntry
User ──< TransferOrder (outgoing)
User ──< TransferOrder (incoming)
User ──< WithdrawOrder ──> AdminAccount (reviewer, nullable)
User ──< DepositOrder

AdminAccount ──< AdminSession
AdminAccount ──< WithdrawOrder (as reviewer)

LedgerJournal ──< LedgerEntry
```

### 核心表说明

**`User`**  
Telegram 用户，首次登录时通过 `initData` 自动创建（upsert）。

**`AdminAccount`**  
独立于 Telegram 用户的后台账号，存储 username + bcrypt 密码哈希。`isActive` 用于软停用。

**`AdminSession`**  
管理员登录会话，JWT payload 中的 `sessionId` 对应此表 id。`expiresAt` 为登录时 +7 天，`revokedAt` 在登出时填入。

**`WalletAccount`**  
每个用户每种 `(assetCode, network)` 组合一条记录，首次登录自动创建。  
- `availableBalance`：可用余额（可转账、可提现）  
- `frozenBalance`：冻结余额（提现中）  
- 约束：`UNIQUE(userId, assetCode, network)`

**`LedgerJournal` / `LedgerEntry`**  
双分录账本。每笔资金操作创建一个 Journal + 两条 Entry（一借一贷）。  
`walletAccountId` 可为 null，用于平台级账户（`PLATFORM_RESERVE` 等）。

**`WithdrawOrder`**  
包含完整状态机所需的三个 journalId：
- `freezeJournalId`：创建时冻结记录
- `releaseJournalId`：拒绝 / 失败 / 取消时解冻记录
- `confirmJournalId`：链上确认时永久扣账记录
- `reviewerId`：指向 `AdminAccount.id`（审核操作的管理员）

**`TransferOrder`**  
`bizNo` 配合 `fromUserId` 实现幂等性，客户端重试不会重复扣款。

---

## 账本账户编码

| 账户代码 | 类型 | 说明 |
|---|---|---|
| `USER_AVAILABLE:{walletAccountId}` | 用户账户 | 用户可用余额 |
| `USER_FROZEN:{walletAccountId}` | 用户账户 | 用户冻结余额 |
| `PLATFORM_RESERVE` | 平台账户 | 充值入账来源（平台储备） |
| `PLATFORM_CLEARING` | 平台账户 | 提现确认目标（平台出款） |
| `PLATFORM_ADJUSTMENT` | 平台账户 | 管理员手工调账对手方 |

---

## 支持资产

> 配置文件：`backend/src/config/supported-assets.ts`

| assetCode | network | decimals | withdrawFee |
|---|---|---|---|
| TON | TON | 9 | 0.05 TON |
| USDT | TON | 6 | 1 USDT |
| USDT | TRC20 | 6 | 1 USDT |

新增资产只需在此文件追加配置，用户下次登录时自动创建对应 WalletAccount。

---

## 错误响应格式

所有错误统一由 `HttpExceptionFilter` 处理：

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "message": "Insufficient available balance",
  "path": "/api/withdrawals",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

验证错误（`class-validator`）的 `message` 为字符串数组。

---

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|:---:|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL 连接字符串 |
| `JWT_SECRET` | ✓ | — | 用户 JWT 签名密钥（≥32 字符） |
| `JWT_EXPIRES_IN` | | 2h | 用户 token 有效期 |
| `ADMIN_JWT_SECRET` | ✓ | — | 管理员 JWT 独立密钥（≥32 字符，必须与 JWT_SECRET 不同） |
| `ADMIN_JWT_EXPIRES_IN` | | 8h | 管理员 token 有效期 |
| `TELEGRAM_BOT_TOKEN` | ✓ | — | Telegram Bot Token |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | | 86400 | initData 最大时效（秒） |
| `ADMIN_BOOTSTRAP_USERNAME` | | dev: `admin` | Bootstrap 管理员账号用户名 |
| `ADMIN_BOOTSTRAP_PASSWORD` | | dev: `admin123456` | Bootstrap 管理员密码 |
| `ADMIN_BOOTSTRAP_DISPLAY_NAME` | | `Local Admin` | Bootstrap 账号显示名 |
| `ADMIN_BOOTSTRAP_ROLE` | | `SUPER_ADMIN` | Bootstrap 账号角色 |
| `WITHDRAW_MANUAL_REVIEW_THRESHOLD` | | 1000 | 大额提现人工审核阈值 |
| `PORT` | | 3001 | 后端监听端口 |
| `TONCENTER_API_URL` | | `https://toncenter.com/api/v2` | TON 节点 API |
| `TONCENTER_API_KEY` | | — | TON API key（提高限速） |
| `USDT_JETTON_MASTER_ADDRESS` | | mainnet 地址 | USDT Jetton Master 合约地址 |
| `TON_HOT_WALLET_MNEMONIC` | | — | TON 热钱包 BIP39 助记词（24 词，空格分隔） |
| `TRONGRID_API_URL` | | `https://api.trongrid.io` | Tron 节点 API |
| `TRONGRID_API_KEY` | | — | Tron API key |
| `TRC20_USDT_CONTRACT` | | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | TRC20 USDT 合约地址 |
| `TRC20_HOT_WALLET_MNEMONIC` | | — | TRC20 热钱包 BIP44 助记词（index 0 = 热钱包，1+ = 充值地址） |
