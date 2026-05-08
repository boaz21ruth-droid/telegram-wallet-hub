# 系统架构文档

## 技术栈

| 层次 | 技术 |
|---|---|
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| 后端框架 | NestJS 10 (TypeScript) |
| 数据库 | PostgreSQL（Prisma ORM） |
| 认证 | Telegram Web App `initData` 验签 + JWT |
| 运行时 | Node.js（开发用 tsx watch） |

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
│   ├── auth/                    # JWT Payload 接口
│   ├── decorators/              # @Public() / @CurrentUser()
│   ├── filters/                 # HttpExceptionFilter（统一错误格式）
│   ├── guards/                  # JwtAuthGuard / AdminGuard
│   ├── prisma/                  # PrismaService（全局）
│   ├── types/                   # AuthenticatedUser 类型
│   └── utils/                   # decimal.util / telegram.util
└── modules/
    ├── health/                  # GET /api/health（公开）
    ├── auth/                    # 登录 / 登出 / 当前用户
    ├── users/                   # 用户资料 / 管理员用户管理
    ├── wallet/                  # 钱包账户 / 交易记录 / 充值地址 / 余额调整 / 审计日志
    ├── deposits/                # 充值订单 / 管理员入账 / 充值地址分配
    ├── ledger/                  # 双分录账本服务（内部，无 HTTP 端点）
    ├── transfers/               # 站内转账
    └── withdrawals/             # 提现申请 + 完整审核/签名/确认流程
```

---

## 认证与鉴权

### 认证流程

```
前端（Telegram Mini App）
  └─> 获取 Telegram.WebApp.initData
  └─> POST /api/auth/telegram/login { initData }
        └─> 后端验证 HMAC-SHA256 签名
        └─> 验证 auth_date 不超过 TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
        └─> upsert User + 创建 WalletAccount（所有支持资产）
        └─> 创建 AuthSession（7 天有效期）
        └─> 签发 JWT（2h 默认，含 sessionId）
  └─> 响应：{ accessToken, user }
```

### 请求鉴权

所有接口默认受 `JwtAuthGuard` 保护。每次请求：

1. 提取 `Authorization: Bearer <token>` 头
2. 验证 JWT 签名
3. 从 `AuthSession` 表查询 session（未吊销、未过期）
4. 验证 `User.status === ACTIVE`
5. 将 `AuthenticatedUser` 注入 `request.user`

标记 `@Public()` 的端点跳过此检查。

### 管理员权限

`AdminGuard` 在 JWT 鉴权后检查 `user.role === ADMIN`。  
用户首次登录时，若其 `telegramUserId` 在环境变量 `ADMIN_TELEGRAM_IDS` 中，则自动赋予 ADMIN 角色。

---

## 数据模型

### 枚举

| 枚举 | 值 |
|---|---|
| `UserRole` | USER / ADMIN |
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
User ──< WithdrawOrder
User ──< DepositOrder
LedgerJournal ──< LedgerEntry
```

### 核心表说明

**`WalletAccount`**  
每个用户每种 `(assetCode, network)` 组合一条记录。  
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
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL 连接字符串 |
| `JWT_SECRET` | ✅ | — | JWT 签名密钥（≥32 字符） |
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Telegram Bot Token |
| `PORT` | — | 3001 | 监听端口 |
| `JWT_EXPIRES_IN` | — | 2h | JWT 有效期 |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | — | 86400 | initData 最大时效（秒） |
| `ADMIN_TELEGRAM_IDS` | — | 空 | 管理员 Telegram 用户 ID，逗号分隔 |
| `WITHDRAW_MANUAL_REVIEW_THRESHOLD` | — | 1000 | 大额提现人工审核阈值 |
