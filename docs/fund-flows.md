# 资金流转设计

## 账本双分录原则

每笔资金操作都生成一个 `LedgerJournal` + 两条 `LedgerEntry`（一借一贷）。  
- 借方（DEBIT）：资金流出的账户  
- 贷方（CREDIT）：资金流入的账户  

`WalletAccount.availableBalance` / `frozenBalance` 是**缓存字段**，由账本驱动更新，真实来源以 `LedgerEntry` 为准。

---

## 一、注册 / 登录

```mermaid
sequenceDiagram
    participant FE as 前端 (Mini App)
    participant API as NestJS API
    participant TG as Telegram 服务端
    participant DB as PostgreSQL

    FE->>API: POST /auth/telegram/login { initData }
    API->>API: HMAC-SHA256 验签 initData
    API->>API: 校验 auth_date 时效
    API->>DB: UPSERT users (telegramUserId 唯一)
    API->>DB: CREATE wallet_accounts（每种支持资产各一条）
    API->>DB: CREATE auth_sessions (expiresAt = now + 7d)
    API->>API: 签发 JWT (sub=userId, sessionId, role, telegramUserId)
    API-->>FE: { accessToken, user }
```

> 首次登录即注册，无需额外注册流程。  
> 若 `telegramUserId` 在 `ADMIN_TELEGRAM_IDS` 中，自动授予 ADMIN 角色。

---

## 二、充值（Deposit）

### 2.1 地址分配

```mermaid
sequenceDiagram
    participant ADM as 管理员
    participant API as NestJS API
    participant DB as PostgreSQL

    ADM->>API: POST /admin/deposits/addresses
    Note right of ADM: { telegramUserId, assetCode,\n network, address, memo? }
    API->>DB: 查找 user + wallet_account
    API->>DB: 清除旧 isPrimary 标记
    API->>DB: UPSERT wallet_addresses (address 唯一, isPrimary=true)
    API->>DB: INSERT audit_logs
    API-->>ADM: WalletAddress 对象
```

用户查询充值地址：
```
GET /wallet/deposit-address?assetCode=TON&network=TON
→ { assetCode, network, address: "地址字符串 or null", memo }
```

### 2.2 充值入账（管理员手动确认，V1 替代链监听）

```mermaid
sequenceDiagram
    participant ADM as 管理员
    participant API as NestJS API
    participant DB as PostgreSQL

    Note over ADM,API: 链上确认到账后，管理员操作
    ADM->>API: POST /admin/deposits/credit
    Note right of ADM: { telegramUserId, assetCode,\n network, amount, txHash? }

    API->>DB: 验证 user + wallet_account（必须 ACTIVE）
    DB-->>API: walletAccount

    rect rgb(230, 245, 230)
        Note over API,DB: 数据库事务
        API->>DB: UPDATE wallet_accounts SET availableBalance += amount
        API->>DB: INSERT deposit_orders (status=CONFIRMED, creditedAt=now)
        API->>DB: INSERT ledger_journals (type=DEPOSIT)
        API->>DB: INSERT ledger_entries × 2
        Note right of DB: DEBIT  PLATFORM_RESERVE\n CREDIT USER_AVAILABLE:{accountId}
        API->>DB: UPDATE deposit_orders SET journalId
        API->>DB: INSERT audit_logs
    end

    API-->>ADM: DepositOrder + journalId
```

**账本分录（DEPOSIT）：**

| 方向 | 账户代码 | 金额 |
|---|---|---|
| DEBIT | `PLATFORM_RESERVE` | amount |
| CREDIT | `USER_AVAILABLE:{walletAccountId}` | amount |

---

## 三、站内转账（Transfer）

```mermaid
sequenceDiagram
    participant UA as 用户 A
    participant API as NestJS API
    participant DB as PostgreSQL
    participant UB as 用户 B

    UA->>API: POST /transfers
    Note right of UA: { recipientTelegramUserId,\n assetCode, network,\n amount, bizNo }

    API->>DB: 检查 (fromUserId, bizNo) 是否已存在
    Note over API: 已存在 → 幂等返回旧记录

    API->>DB: 查找接收方 user（不存在 → 404）
    API->>API: 校验不能转给自己

    API->>DB: 查找发送方 wallet_account（必须 ACTIVE）
    API->>DB: 查找接收方 wallet_account（必须 ACTIVE）

    rect rgb(230, 245, 230)
        Note over API,DB: 数据库事务
        API->>DB: UPDATE sender_account SET availableBalance -= amount
        Note right of DB: WHERE availableBalance >= amount（不足则回滚）
        API->>DB: UPDATE recipient_account SET availableBalance += amount
        API->>DB: INSERT transfer_orders (status=SUCCESS)
        API->>DB: INSERT ledger_journals (type=TRANSFER)
        API->>DB: INSERT ledger_entries × 2
        Note right of DB: DEBIT  USER_AVAILABLE:{senderAccountId}\n CREDIT USER_AVAILABLE:{recipientAccountId}
        API->>DB: UPDATE transfer_orders SET journalId
    end

    API-->>UA: TransferOrder（含双方用户信息）
```

**账本分录（TRANSFER）：**

| 方向 | 账户代码 | 金额 |
|---|---|---|
| DEBIT | `USER_AVAILABLE:{senderAccountId}` | amount |
| CREDIT | `USER_AVAILABLE:{recipientAccountId}` | amount |

**幂等机制：** 客户端每次转账请求使用唯一 `bizNo`，网络重试时若服务端已处理则直接返回原订单，不重复扣款。

---

## 四、提现（Withdrawal）

### 4.1 提现状态机

```mermaid
stateDiagram-v2
    [*] --> PENDING_REVIEW : 大额（> threshold）
    [*] --> READY_FOR_SIGNING : 小额（≤ threshold）

    PENDING_REVIEW --> READY_FOR_SIGNING : 管理员审核通过\n(approve)
    PENDING_REVIEW --> REJECTED : 管理员审核拒绝\n(reject) ← 解冻
    PENDING_REVIEW --> CANCELED : 用户主动取消\n(cancel) ← 解冻

    READY_FOR_SIGNING --> SIGNED : 管理员签名广播\n(sign + txHash)
    READY_FOR_SIGNING --> FAILED : 签名/广播失败\n(fail) ← 解冻

    SIGNED --> CONFIRMED : 链上确认\n(confirm) ← 永久扣账
    SIGNED --> FAILED : 链上失败\n(fail) ← 解冻
```

### 4.2 创建提现（冻结余额）

```mermaid
sequenceDiagram
    participant U as 用户
    participant API as NestJS API
    participant DB as PostgreSQL

    U->>API: POST /withdrawals
    Note right of U: { assetCode, network,\n amount, toAddress }

    API->>API: fee = supportedAssets[asset].withdrawFee
    API->>API: totalAmount = amount + fee
    API->>API: requiresManualReview = (amount > THRESHOLD)

    API->>DB: 查找 wallet_account（必须 ACTIVE）

    rect rgb(230, 245, 230)
        Note over API,DB: 数据库事务
        API->>DB: UPDATE wallet_accounts\n SET availableBalance -= totalAmount,\n frozenBalance += totalAmount
        Note right of DB: WHERE availableBalance >= totalAmount
        API->>DB: INSERT withdraw_orders\n (status = PENDING_REVIEW or READY_FOR_SIGNING)
        API->>DB: INSERT ledger_journals (type=WITHDRAWAL_FREEZE)
        API->>DB: INSERT ledger_entries × 2
        Note right of DB: DEBIT  USER_AVAILABLE:{accountId}\n CREDIT USER_FROZEN:{accountId}
        API->>DB: UPDATE withdraw_orders SET freezeJournalId
    end

    API-->>U: WithdrawOrder
```

**账本分录（WITHDRAWAL_FREEZE）：**

| 方向 | 账户代码 | 金额 |
|---|---|---|
| DEBIT | `USER_AVAILABLE:{walletAccountId}` | totalAmount |
| CREDIT | `USER_FROZEN:{walletAccountId}` | totalAmount |

### 4.3 审核阶段（大额提现）

```mermaid
sequenceDiagram
    participant ADM as 管理员
    participant API as NestJS API
    participant DB as PostgreSQL

    Note over ADM,API: 审核通过
    ADM->>API: POST /admin/withdrawals/:id/approve { note? }
    API->>DB: 验证 status=PENDING_REVIEW + reviewStatus=PENDING
    API->>DB: UPDATE status=READY_FOR_SIGNING, reviewStatus=APPROVED
    API->>DB: INSERT audit_logs (action=withdraw.approve_review)
    API-->>ADM: 更新后的 WithdrawOrder

    Note over ADM,API: 审核拒绝（解冻余额）
    ADM->>API: POST /admin/withdrawals/:id/reject { note? }
    API->>DB: 验证 status=PENDING_REVIEW + reviewStatus=PENDING
    rect rgb(255, 235, 235)
        Note over API,DB: 数据库事务（释放冻结）
        API->>DB: UPDATE wallet_accounts\n SET frozenBalance -= totalAmount,\n availableBalance += totalAmount
        API->>DB: INSERT ledger_journals (type=WITHDRAWAL_RELEASE)
        API->>DB: INSERT ledger_entries × 2
        Note right of DB: DEBIT  USER_FROZEN:{accountId}\n CREDIT USER_AVAILABLE:{accountId}
        API->>DB: UPDATE status=REJECTED, reviewStatus=REJECTED
        API->>DB: INSERT audit_logs
    end
```

### 4.4 签名与确认

```mermaid
sequenceDiagram
    participant ADM as 管理员/签名服务
    participant API as NestJS API
    participant DB as PostgreSQL

    Note over ADM,API: 第一步：签名广播
    ADM->>API: POST /admin/withdrawals/:id/sign { txHash }
    API->>DB: 验证 status=READY_FOR_SIGNING
    API->>DB: UPDATE status=SIGNED, txHash=txHash
    API->>DB: INSERT audit_logs (action=withdraw.sign)
    API-->>ADM: 更新后的 WithdrawOrder

    Note over ADM,API: 第二步：链上确认（永久扣账）
    ADM->>API: POST /admin/withdrawals/:id/confirm
    API->>DB: 验证 status=SIGNED
    rect rgb(255, 245, 220)
        Note over API,DB: 数据库事务（最终扣账）
        API->>DB: UPDATE wallet_accounts SET frozenBalance -= totalAmount
        Note right of DB: WHERE frozenBalance >= totalAmount
        API->>DB: INSERT ledger_journals (type=WITHDRAWAL_CONFIRM)
        API->>DB: INSERT ledger_entries × 2
        Note right of DB: DEBIT  USER_FROZEN:{accountId}\n CREDIT PLATFORM_CLEARING
        API->>DB: UPDATE status=CONFIRMED, confirmJournalId
        API->>DB: INSERT audit_logs (action=withdraw.confirm)
    end

    Note over ADM,API: 链上失败（解冻退回）
    ADM->>API: POST /admin/withdrawals/:id/fail { note? }
    API->>DB: 验证 status ∈ {READY_FOR_SIGNING, SIGNED}
    rect rgb(255, 235, 235)
        Note over API,DB: 数据库事务（释放冻结）
        API->>DB: UPDATE wallet_accounts\n SET frozenBalance -= totalAmount,\n availableBalance += totalAmount
        API->>DB: INSERT ledger_journals (type=WITHDRAWAL_RELEASE)
        API->>DB: INSERT ledger_entries × 2
        API->>DB: UPDATE status=FAILED
        API->>DB: INSERT audit_logs
    end
```

**账本分录（WITHDRAWAL_CONFIRM）：**

| 方向 | 账户代码 | 金额 |
|---|---|---|
| DEBIT | `USER_FROZEN:{walletAccountId}` | totalAmount |
| CREDIT | `PLATFORM_CLEARING` | totalAmount |

**账本分录（WITHDRAWAL_RELEASE，拒绝/失败/取消）：**

| 方向 | 账户代码 | 金额 |
|---|---|---|
| DEBIT | `USER_FROZEN:{walletAccountId}` | totalAmount |
| CREDIT | `USER_AVAILABLE:{walletAccountId}` | totalAmount |

### 4.5 用户取消

```mermaid
sequenceDiagram
    participant U as 用户
    participant API as NestJS API
    participant DB as PostgreSQL

    U->>API: POST /withdrawals/orders/:id/cancel
    API->>DB: 验证订单属于该用户 + status=PENDING_REVIEW
    rect rgb(255, 235, 235)
        Note over API,DB: 数据库事务（释放冻结）
        API->>DB: UPDATE frozenBalance -= totalAmount,\n availableBalance += totalAmount
        API->>DB: INSERT ledger_journals (type=WITHDRAWAL_RELEASE)
        API->>DB: INSERT ledger_entries × 2
        API->>DB: UPDATE status=CANCELED
    end
    API-->>U: 更新后的 WithdrawOrder
```

---

## 五、管理员余额调整（Adjustment）

用于人工补账、修正余额等运营操作。

```mermaid
sequenceDiagram
    participant ADM as 管理员
    participant API as NestJS API
    participant DB as PostgreSQL

    ADM->>API: POST /admin/wallet/adjustments
    Note right of ADM: { telegramUserId, assetCode,\n network, delta, note? }
    Note right of ADM: delta > 0: 增加余额\n delta < 0: 扣减余额

    API->>DB: 查找 user + wallet_account

    rect rgb(230, 245, 230)
        Note over API,DB: 数据库事务
        alt delta > 0（增加）
            API->>DB: UPDATE availableBalance += |delta|
            API->>DB: INSERT entries: DEBIT PLATFORM_ADJUSTMENT\n CREDIT USER_AVAILABLE:{accountId}
        else delta < 0（扣减）
            API->>DB: UPDATE availableBalance -= |delta|\n WHERE availableBalance >= |delta|
            API->>DB: INSERT entries: DEBIT USER_AVAILABLE:{accountId}\n CREDIT PLATFORM_ADJUSTMENT
        end
        API->>DB: INSERT ledger_journals (type=ADJUSTMENT)
        API->>DB: INSERT audit_logs (action=wallet.adjustment)
    end

    API-->>ADM: { journalId, delta, assetCode, network }
```

---

## 六、余额变动汇总

| 操作 | `availableBalance` | `frozenBalance` | JournalType |
|---|---|---|---|
| 充值入账 | ＋amount | 不变 | `DEPOSIT` |
| 站内转账（出） | −amount | 不变 | `TRANSFER` |
| 站内转账（入） | ＋amount | 不变 | `TRANSFER` |
| 创建提现 | −totalAmount | ＋totalAmount | `WITHDRAWAL_FREEZE` |
| 提现审核通过 | 不变 | 不变 | — |
| 提现拒绝/取消/失败 | ＋totalAmount | −totalAmount | `WITHDRAWAL_RELEASE` |
| 提现链上确认 | 不变 | −totalAmount | `WITHDRAWAL_CONFIRM` |
| 管理员增加余额 | ＋\|delta\| | 不变 | `ADJUSTMENT` |
| 管理员扣减余额 | −\|delta\| | 不变 | `ADJUSTMENT` |

> `totalAmount = amount + withdrawFee`
