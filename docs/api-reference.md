# API 接口文档

**Base URL：** `http://localhost:3001/api`  
**认证方式：** `Authorization: Bearer <accessToken>`（除标注 Public 外均需要）

---

## 目录

- [健康检查](#健康检查)
- [认证模块](#认证模块-auth)
- [用户模块](#用户模块-user)
- [钱包模块](#钱包模块-wallet)
- [充值模块](#充值模块-deposits)
- [站内转账模块](#站内转账模块-transfers)
- [提现模块](#提现模块-withdrawals)
- [管理员 - 用户管理](#管理员---用户管理)
- [管理员 - 充值管理](#管理员---充值管理)
- [管理员 - 提现审核与操作](#管理员---提现审核与操作)
- [管理员 - 钱包操作](#管理员---钱包操作)

---

## 健康检查

### `GET /health`
**权限：** Public

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

## 认证模块（Auth）

### `POST /auth/telegram/login`
**权限：** Public  
**说明：** 使用 Telegram `initData` 登录。首次登录自动注册用户并创建所有资产的钱包账户。

**请求体：**
```json
{
  "initData": "query_id=AAH...&user=...&auth_date=...&hash=..."
}
```

**响应：**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "clxxx",
    "telegramUserId": "123456789",
    "username": "alice",
    "firstName": "Alice",
    "lastName": "Smith",
    "photoUrl": "https://...",
    "role": "USER",
    "status": "ACTIVE",
    "kycStatus": "UNVERIFIED",
    "walletAccounts": [
      {
        "id": "clyyy",
        "assetCode": "TON",
        "network": "TON",
        "availableBalance": "0",
        "frozenBalance": "0",
        "status": "ACTIVE"
      },
      {
        "id": "clzzz",
        "assetCode": "USDT",
        "network": "TON",
        "availableBalance": "0",
        "frozenBalance": "0",
        "status": "ACTIVE"
      }
    ],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**错误：**
- `401 Unauthorized` - initData 签名不合法或已过期

---

### `GET /auth/me`
**权限：** JWT  
**说明：** 获取当前登录用户信息（含钱包账户）。

**响应：** 同登录响应中的 `user` 对象。

---

### `POST /auth/logout`
**权限：** JWT  
**说明：** 吊销当前会话。

**响应：**
```json
{ "success": true }
```

---

## 用户模块（User）

### `GET /user/profile`
**权限：** JWT  
**说明：** 获取当前用户资料（不含钱包账户）。

**响应：**
```json
{
  "id": "clxxx",
  "telegramUserId": "123456789",
  "username": "alice",
  "firstName": "Alice",
  "lastName": "Smith",
  "photoUrl": null,
  "role": "USER",
  "status": "ACTIVE",
  "kycStatus": "UNVERIFIED",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

---

## 钱包模块（Wallet）

### `GET /wallet/accounts`
**权限：** JWT  
**说明：** 获取当前用户所有钱包账户及余额。

**响应：**
```json
[
  {
    "id": "clyyy",
    "userId": "clxxx",
    "assetCode": "TON",
    "network": "TON",
    "availableBalance": "10.5",
    "frozenBalance": "2.0",
    "status": "ACTIVE",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `GET /wallet/assets`
**权限：** JWT  
**说明：** 获取系统支持的资产列表（含提现手续费）。

**响应：**
```json
[
  { "assetCode": "TON",  "network": "TON", "decimals": 9, "withdrawFee": "0.05" },
  { "assetCode": "USDT", "network": "TON", "decimals": 6, "withdrawFee": "1"    }
]
```

---

### `GET /wallet/transactions`
**权限：** JWT  
**说明：** 获取当前用户的账本流水记录（所有涉及自己钱包账户的 Journal）。

**Query 参数：**

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `limit` | integer | 20 | 每页条数（1-100） |
| `offset` | integer | 0 | 偏移量 |

**响应：**
```json
[
  {
    "id": "journal_id",
    "type": "TRANSFER",
    "referenceType": "transfer_order",
    "referenceId": "transfer_order_id",
    "description": "转账给 bob",
    "status": "POSTED",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "entries": [
      {
        "id": "entry_id",
        "walletAccountId": "clyyy",
        "assetCode": "TON",
        "network": "TON",
        "direction": "DEBIT",
        "amount": "5.0",
        "ledgerAccountCode": "USER_AVAILABLE:clyyy",
        "accountStatus": "ACTIVE"
      }
    ]
  }
]
```

`type` 枚举值：`DEPOSIT` | `TRANSFER` | `WITHDRAWAL_FREEZE` | `WITHDRAWAL_RELEASE` | `WITHDRAWAL_CONFIRM` | `ADJUSTMENT`

---

### `GET /wallet/deposit-address`
**权限：** JWT  
**说明：** 获取指定资产的充值地址。地址由管理员分配，若未分配则返回 `null`。

**Query 参数：**

| 参数 | 必填 | 说明 |
|---|---|---|
| `assetCode` | ✅ | 资产代码，如 `TON` |
| `network` | ✅ | 网络，如 `TON` |

**响应：**
```json
{
  "assetCode": "TON",
  "network": "TON",
  "address": "EQD...abc",
  "memo": null
}
```

---

## 充值模块（Deposits）

### `GET /deposits/orders`
**权限：** JWT  
**说明：** 获取当前用户的充值记录。

**Query 参数：**

| 参数 | 类型 | 默认值 |
|---|---|---|
| `limit` | integer | 20 |
| `offset` | integer | 0 |

**响应：**
```json
[
  {
    "id": "dep_id",
    "userId": "clxxx",
    "assetCode": "TON",
    "network": "TON",
    "fromAddress": "EQD...from",
    "amount": "10.0",
    "txHash": "abc123...",
    "note": null,
    "status": "CONFIRMED",
    "journalId": "journal_id",
    "creditedAt": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

## 站内转账模块（Transfers）

### `POST /transfers`
**权限：** JWT  
**说明：** 向其他用户发起站内转账。**实时到账，不走链上。**

**请求体：**
```json
{
  "recipientTelegramUserId": "987654321",
  "assetCode": "TON",
  "network": "TON",
  "amount": "5.0",
  "bizNo": "order-20250101-001",
  "note": "还你的"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `recipientTelegramUserId` | ✅ | 接收方的 Telegram 用户 ID |
| `assetCode` | ✅ | 资产代码 |
| `network` | ✅ | 网络 |
| `amount` | ✅ | 转账金额（正数字符串） |
| `bizNo` | ✅ | 幂等键，同一 `bizNo` 重复请求返回原订单 |
| `note` | — | 备注（最长 255 字符） |

**响应：**
```json
{
  "id": "transfer_id",
  "fromUserId": "clxxx",
  "toUserId": "clbbb",
  "assetCode": "TON",
  "network": "TON",
  "amount": "5.0",
  "fee": "0",
  "bizNo": "order-20250101-001",
  "status": "SUCCESS",
  "note": "还你的",
  "journalId": "journal_id",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**错误：**
- `404` - 接收方用户不存在
- `400` - 转给自己 / 余额不足 / 钱包账户不可用

---

### `GET /transfers/orders`
**权限：** JWT  
**说明：** 获取当前用户的转账记录（发出 + 收到）。

**响应：** TransferOrder 数组，包含 `fromUser` 和 `toUser` 详情，按 `createdAt` 倒序。

---

### `GET /transfers/orders/:id`
**权限：** JWT  
**说明：** 获取单笔转账详情（只能查询自己参与的转账）。

---

## 提现模块（Withdrawals）

### `POST /withdrawals`
**权限：** JWT  
**说明：** 发起提现申请。提现金额超过审核阈值时进入人工审核队列；低于阈值时直接进入待签名状态。

**请求体：**
```json
{
  "assetCode": "TON",
  "network": "TON",
  "amount": "5.0",
  "toAddress": "EQD...abc",
  "note": "取出备用"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `assetCode` | ✅ | 资产代码 |
| `network` | ✅ | 网络 |
| `amount` | ✅ | 提现金额（不含手续费） |
| `toAddress` | ✅ | 目标链上地址（最长 255 字符） |
| `note` | — | 备注（最长 255 字符） |

**响应：**
```json
{
  "id": "wd_id",
  "userId": "clxxx",
  "assetCode": "TON",
  "network": "TON",
  "toAddress": "EQD...abc",
  "amount": "5.0",
  "fee": "0.05",
  "totalAmount": "5.05",
  "note": "取出备用",
  "requiresManualReview": false,
  "reviewStatus": "NOT_REQUIRED",
  "status": "READY_FOR_SIGNING",
  "txHash": null,
  "freezeJournalId": "journal_id",
  "releaseJournalId": null,
  "confirmJournalId": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**错误：**
- `400` - 余额不足 / 钱包账户不可用 / 不支持的资产
- `404` - 钱包账户不存在

---

### `GET /withdrawals/orders`
**权限：** JWT  
**说明：** 获取当前用户的提现记录。

**响应：** WithdrawOrder 数组，按 `createdAt` 倒序。

---

### `GET /withdrawals/orders/:id`
**权限：** JWT  
**说明：** 获取单笔提现详情（只能查询自己的）。

---

### `POST /withdrawals/orders/:id/cancel`
**权限：** JWT  
**说明：** 取消提现申请（仅限 `PENDING_REVIEW` 状态）。取消后冻结余额立即归还。

**响应：** 更新后的 WithdrawOrder（`status: "CANCELED"`）

**错误：**
- `403` - 状态不是 `PENDING_REVIEW`
- `404` - 订单不存在或不属于当前用户

---

## 管理员 - 用户管理

所有 `/admin/*` 接口需要 **Admin 权限**（JWT + role=ADMIN）。

### `GET /admin/users`
**说明：** 分页获取所有用户列表。

**Query 参数：**

| 参数 | 类型 | 默认值 |
|---|---|---|
| `limit` | integer | 20 |
| `offset` | integer | 0 |

**响应：**
```json
{
  "total": 100,
  "limit": 20,
  "offset": 0,
  "data": [
    {
      "id": "clxxx",
      "telegramUserId": "123456789",
      "username": "alice",
      "firstName": "Alice",
      "lastName": "Smith",
      "role": "USER",
      "status": "ACTIVE",
      "kycStatus": "UNVERIFIED",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "_count": { "walletAccounts": 2 }
    }
  ]
}
```

---

### `GET /admin/users/:id`
**说明：** 获取指定用户详情，含所有钱包账户余额。

**响应：** 用户对象 + `walletAccounts` 数组（含余额）。

---

### `PATCH /admin/users/:id/status`
**说明：** 修改用户状态（启用/暂停/禁用）。操作会写入审计日志。

**请求体：**
```json
{ "status": "SUSPENDED" }
```

`status` 枚举：`ACTIVE` | `SUSPENDED` | `DISABLED`

**响应：** 更新后的用户对象。

---

## 管理员 - 充值管理

### `GET /admin/deposits`
**说明：** 分页获取所有用户的充值记录。

**Query 参数：** `limit`（默认 20）、`offset`（默认 0）

**响应：** DepositOrder 数组，每条含 `user` 信息。

---

### `POST /admin/deposits/credit`
**说明：** 手动为用户入账（模拟链上充值确认，V1 代替链监听服务）。操作原子性：余额增加 + 创建充值订单 + 写账本 + 写审计日志。

**请求体：**
```json
{
  "telegramUserId": "123456789",
  "assetCode": "TON",
  "network": "TON",
  "amount": "10.0",
  "fromAddress": "EQD...from",
  "txHash": "abc123...",
  "note": "链上入账"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `telegramUserId` | ✅ | 接收方的 Telegram 用户 ID |
| `assetCode` | ✅ | 资产代码 |
| `network` | ✅ | 网络 |
| `amount` | ✅ | 入账金额（正数字符串） |
| `fromAddress` | — | 来源链上地址（最长 255 字符） |
| `txHash` | — | 交易哈希（最长 255 字符） |
| `note` | — | 备注（最长 255 字符） |

**响应：** DepositOrder + `journalId`

---

### `POST /admin/deposits/addresses`
**说明：** 为用户的钱包账户分配充值地址。若该地址已存在则更新，旧主地址的 `isPrimary` 标记会被清除。

**请求体：**
```json
{
  "telegramUserId": "123456789",
  "assetCode": "TON",
  "network": "TON",
  "address": "EQD...abc",
  "memo": null
}
```

**响应：** WalletAddress 对象。

---

## 管理员 - 提现审核与操作

### `GET /admin/withdrawals`
**说明：** 获取所有提现订单，可按状态过滤。

**Query 参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `status` | enum | 可选，过滤状态（见 WithdrawStatus 枚举） |

**响应：** WithdrawOrder 数组，含 `user` 信息，按 `createdAt` 倒序。

常用查询：
- 审核队列：`?status=PENDING_REVIEW`
- 待签名：`?status=READY_FOR_SIGNING`
- 待确认：`?status=SIGNED`

---

### `POST /admin/withdrawals/:id/approve`
**说明：** 审核通过大额提现（`PENDING_REVIEW` → `READY_FOR_SIGNING`）。

**请求体：**
```json
{ "note": "审核通过" }
```

**响应：** 更新后的 WithdrawOrder。  
**错误：** `400` - 当前状态不是 `PENDING_REVIEW`

---

### `POST /admin/withdrawals/:id/reject`
**说明：** 审核拒绝提现（`PENDING_REVIEW` → `REJECTED`），冻结余额立即归还用户。

**请求体：**
```json
{ "note": "地址疑似违规" }
```

**响应：** 更新后的 WithdrawOrder（`status: "REJECTED"`）。

---

### `POST /admin/withdrawals/:id/sign`
**说明：** 标记提现已签名广播（`READY_FOR_SIGNING` → `SIGNED`）。

**请求体：**
```json
{ "txHash": "0xabc123..." }
```

**响应：** 更新后的 WithdrawOrder（`status: "SIGNED"`, `txHash` 已设置）。

---

### `POST /admin/withdrawals/:id/confirm`
**说明：** 确认链上到账（`SIGNED` → `CONFIRMED`）。此步骤永久扣减冻结余额并写入 `WITHDRAWAL_CONFIRM` 账本分录。

**请求体：** 空

**响应：** 更新后的 WithdrawOrder（`status: "CONFIRMED"`, `confirmJournalId` 已设置）。

---

### `POST /admin/withdrawals/:id/fail`
**说明：** 标记提现失败（`READY_FOR_SIGNING` | `SIGNED` → `FAILED`），冻结余额归还用户。

**请求体：**
```json
{ "note": "广播失败，gas 不足" }
```

**响应：** 更新后的 WithdrawOrder（`status: "FAILED"`）。

---

## 管理员 - 钱包操作

### `POST /admin/wallet/adjustments`
**说明：** 手工调整用户余额。正 `delta` 为增加，负 `delta` 为扣减。操作写入账本和审计日志。

**请求体：**
```json
{
  "telegramUserId": "123456789",
  "assetCode": "TON",
  "network": "TON",
  "delta": "5.0",
  "note": "活动奖励"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `telegramUserId` | ✅ | 目标用户的 Telegram 用户 ID |
| `assetCode` | ✅ | 资产代码 |
| `network` | ✅ | 网络 |
| `delta` | ✅ | 调整量，正数增加，负数扣减 |
| `note` | — | 备注（最长 255 字符） |

**响应：**
```json
{
  "journalId": "journal_id",
  "delta": "5.0",
  "assetCode": "TON",
  "network": "TON"
}
```

**错误：**
- `400` - delta 为零 / 扣减时余额不足

---

### `GET /admin/wallet/audit-logs`
**说明：** 分页获取审计日志，可按资源类型过滤。

**Query 参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `limit` | integer | 每页条数（默认 20，最大 100） |
| `offset` | integer | 偏移量（默认 0） |
| `resourceType` | string | 可选过滤，如 `withdraw_order`、`wallet_account`、`deposit_order` |

**响应：** AuditLog 数组，按 `createdAt` 倒序。

```json
[
  {
    "id": "log_id",
    "actorType": "ADMIN",
    "actorUserId": "clxxx",
    "action": "withdraw.confirm",
    "resourceType": "withdraw_order",
    "resourceId": "wd_id",
    "metadata": { "txHash": "0xabc..." },
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**`action` 常见值：**

| action | 触发场景 |
|---|---|
| `deposit.credit` | 管理员手动入账 |
| `deposit.assign_address` | 分配充值地址 |
| `wallet.adjustment` | 手工余额调整 |
| `withdraw.approve_review` | 审核通过提现 |
| `withdraw.reject_review` | 审核拒绝提现 |
| `withdraw.sign` | 签名广播 |
| `withdraw.confirm` | 链上确认 |
| `withdraw.fail` | 提现失败 |
| `user.set_status.suspended` | 暂停用户 |
| `user.set_status.active` | 恢复用户 |
