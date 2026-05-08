# Telegram 钱包后端设计

## 结论

需要后端。

你当前仓库是纯静态前端页面，适合展示 UI，不适合直接承接真实钱包业务。只要要做下面任意一种能力，就必须有后端：

- 注册 / 登录
- 充值到账
- 提现审核与出款
- 用户之间转账
- 余额、账单、订单状态
- 风控、限额、审计

但一开始不需要做成很多独立服务。对你当前阶段，建议先做 **一个单体后端**，把业务模块拆清楚，后面流量上来再拆分。

## 适用前提

本文按 **Telegram Mini App + 加密钱包** 场景设计。

- 前端：你当前 React 页面
- 登录：优先用 Telegram `initData` 验签
- 充值：默认指链上充值
- 提现：默认指链上提现
- 转账：优先做站内转账，速度快、手续费低

如果你说的“充值”是法币入金，还要额外接支付网关、实名/KYC、合规能力，这会比当前方案再重一层。

## 推荐架构

### 第一阶段架构

```text
Telegram Mini App (React)
        |
        v
API Backend (NestJS / Fastify)
        |
        +-- PostgreSQL
        +-- Redis
        +-- Queue(BullMQ / Redis Stream)
        +-- Chain Listener
        +-- Wallet Signer
```

### 技术建议

为了和你当前前端 TypeScript 技术栈一致，推荐：

- 后端框架：NestJS
- 数据库：PostgreSQL
- ORM：Prisma 或 Drizzle
- 缓存/队列：Redis + BullMQ
- API：REST 先行，后续需要实时通知再加 WebSocket
- 部署：Docker Compose 起步，后续再上 K8s

不建议第一版就做微服务。钱包业务真正难的是账本一致性、风控和链上回调，不是服务数量。

## 业务模块划分

建议一个后端项目内拆 8 个模块。

### 1. `auth` 认证模块

职责：

- 校验 Telegram `initData`
- 首次登录自动注册
- 签发 session / JWT
- 设备、IP、风控基础信息记录

说明：

- Telegram Mini App 里通常不需要传统“用户名+密码注册”
- 更合理的是“打开小程序即登录，首次进入即注册”

### 2. `user` 用户模块

职责：

- 用户基础资料
- 邀请关系
- 账号状态
- 风控等级
- KYC 状态

### 3. `wallet` 钱包账户模块

职责：

- 为每个用户建立钱包账户
- 管理链、币种、地址
- 托管钱包 / 非托管钱包模式切换

建议你先明确模式：

- 如果你做 **托管钱包**：私钥和签名在服务端控制，提现需要后端签名
- 如果你做 **非托管钱包**：用户自己签名，后端主要管业务记录和风控

你提到“充值、提现、转账”，大多数业务场景实际上更适合先做 **托管钱包 + 站内账本**。

### 4. `ledger` 账本模块

这是核心，优先级最高。

职责：

- 记录每一笔资金变动
- 支持可用余额、冻结余额
- 保证借贷平衡
- 所有充值、提现、转账都落到账本

原则：

- 不直接改余额字段作为真实依据
- 余额应由账本汇总得出，或由账本驱动缓存余额
- 所有资金操作必须幂等

建议采用双分录模型：

- 用户资产账户
- 平台清算账户
- 提现冻结账户
- 手续费收入账户
- 链上归集账户

### 5. `deposit` 充值模块

职责：

- 分配充值地址或充值 memo/tag
- 监听链上入账
- 根据确认数入账
- 处理重复回调、孤块、延迟确认

标准流程：

1. 用户进入充值页
2. 后端返回充值地址 / memo
3. 链监听服务发现链上入账
4. 达到确认数
5. `ledger` 入账
6. 通知前端到账

### 6. `withdraw` 提现模块

职责：

- 创建提现申请
- 校验余额、限额、风控规则
- 冻结用户余额
- 审核后签名广播
- 广播成功后更新状态

标准流程：

1. 用户提交提现请求
2. 后端校验余额和风控
3. 先冻结资产
4. 审核通过后调用 signer 签名
5. 广播链上交易
6. 根据链上状态更新订单
7. 最终扣账或失败解冻

### 7. `transfer` 站内转账模块

职责：

- 用户 A 向用户 B 转账
- 站内实时到账
- 不走链上
- 走内部账本

这是你最值得优先做的功能，因为：

- 用户体验好
- 手续费低
- 实现复杂度远低于链上转账
- 很适合 Telegram 社交关系链

### 8. `admin` 管理后台模块

职责：

- 提现审核
- 黑名单
- 限额配置
- 订单查询
- 人工补账
- 审计日志

钱包项目没有后台会非常难运维。

## 数据模型建议

第一版至少要有下面这些表。

### 用户相关

- `users`
- `user_profiles`
- `auth_sessions`
- `user_devices`

### 钱包相关

- `wallet_accounts`
- `wallet_addresses`
- `assets`
- `asset_networks`

### 资金与账本

- `ledger_accounts`
- `ledger_journals`
- `ledger_entries`
- `balance_snapshots`

### 订单

- `deposit_orders`
- `withdraw_orders`
- `transfer_orders`

### 链上交易

- `chain_transactions`
- `blockchain_callbacks`

### 风控与审计

- `risk_events`
- `kyc_records`
- `audit_logs`
- `idempotency_keys`

## 关键字段设计

### `users`

- `id`
- `telegram_user_id`
- `username`
- `status`
- `kyc_status`
- `created_at`

### `wallet_accounts`

- `id`
- `user_id`
- `asset_code`
- `network`
- `available_balance`
- `frozen_balance`
- `status`

说明：

- 第一版可以保留 `available_balance` / `frozen_balance` 作为查询缓存
- 真实来源仍然应以 `ledger_entries` 为准

### `deposit_orders`

- `id`
- `user_id`
- `asset_code`
- `network`
- `deposit_address`
- `tx_hash`
- `amount`
- `confirmations`
- `status`
- `credited_at`

### `withdraw_orders`

- `id`
- `user_id`
- `asset_code`
- `network`
- `to_address`
- `amount`
- `fee`
- `status`
- `review_status`
- `tx_hash`
- `submitted_at`

### `transfer_orders`

- `id`
- `from_user_id`
- `to_user_id`
- `asset_code`
- `amount`
- `fee`
- `status`
- `biz_no`

`biz_no` 用于幂等，避免重复点击转账造成重复扣款。

## API 设计

### 认证

- `POST /api/auth/telegram/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 用户与资产

- `GET /api/user/profile`
- `GET /api/wallet/accounts`
- `GET /api/wallet/assets`
- `GET /api/wallet/transactions`

### 充值

- `POST /api/deposits/address`
- `GET /api/deposits/orders`
- `GET /api/deposits/orders/:id`

### 提现

- `POST /api/withdrawals`
- `GET /api/withdrawals/orders`
- `GET /api/withdrawals/orders/:id`
- `POST /api/withdrawals/orders/:id/cancel`

### 转账

- `POST /api/transfers`
- `GET /api/transfers/orders`
- `GET /api/transfers/orders/:id`

### 管理后台

- `GET /api/admin/withdrawals`
- `POST /api/admin/withdrawals/:id/approve`
- `POST /api/admin/withdrawals/:id/reject`
- `GET /api/admin/risk-events`

## 四个核心流程

### 注册 / 登录

```text
Telegram 打开小程序
  -> 前端获取 initData
  -> 后端验签
  -> 若用户不存在则创建 users / wallet_accounts
  -> 返回 access token
  -> 前端拉取 profile / accounts / transactions
```

### 充值

```text
用户申请充值地址
  -> 后端返回地址
  -> 用户链上转入
  -> Chain Listener 监听到 tx
  -> 达到确认数
  -> ledger 记账
  -> 更新 deposit_order 为 success
  -> 前端刷新余额
```

### 提现

```text
用户提交提现
  -> 校验可用余额
  -> 冻结余额
  -> 风控/审核
  -> signer 签名并广播
  -> 链上确认
  -> 正式扣账
```

### 站内转账

```text
用户 A 发起转账给用户 B
  -> 校验 A 余额
  -> 单数据库事务中写 transfer_order
  -> 写两边 ledger_entries
  -> A 扣减，B 增加
  -> 实时返回成功
```

## 安全设计

钱包项目不要把安全当成“后面再补”。

第一版至少做这些：

- Telegram `initData` 服务端验签
- JWT 短期有效 + refresh token
- 提现二次确认
- 金额、频率、设备、IP 风控
- 敏感操作限流
- 所有资金操作幂等
- 提现先冻结再出款
- 签名服务与业务服务隔离
- 审计日志不可随意删除
- 管理后台必须做 RBAC

如果你做托管钱包，再加：

- 热钱包 / 冷钱包分离
- 大额提现人工审核
- 私钥不直接放业务容器
- 优先使用 HSM / MPC / 专门 signer

## 为什么不能只靠前端

下面这些事情前端做不了，或者做了也不可信：

- 验证 Telegram 身份真伪
- 保存用户资金账本
- 监听链上充值
- 控制提现审核和签名
- 避免重复提交和并发扣款
- 风控、黑名单、限额
- 审计和对账

所以答案不是“要不要加后端”，而是“后端至少要做到什么程度”。

## 最小可落地版本

如果你要尽快从静态页面走到可用版本，建议按这个顺序做：

### V1

- Telegram 登录
- 用户自动注册
- 用户资产页接真实接口
- 站内转账
- 充值地址展示
- 充值到账回写
- 提现申请 + 人工审核
- 交易记录列表

### V2

- 多币种
- 多链支持
- 自动风控
- WebSocket 实时余额变更
- 管理后台
- 消息通知

### V3

- 归集钱包
- 热冷分离
- 批量出款
- 多签 / MPC
- 完整 KYC / AML

## 针对你当前项目的直接建议

你现在这个仓库可以继续保留为前端应用，但建议新增一个独立目录或独立仓库做后端，例如：

```text
telegram-wallet-hub/
  frontend/   <- 当前 React 页面
  backend/    <- NestJS API
  admin/      <- 可选，管理后台
```

如果你暂时不想拆仓库，也可以先这样：

```text
telegram-wallet-hub/
  src/        <- 前端
  server/     <- 后端
```

但从长期维护看，前后端分离仓库通常更清楚。

## 推荐实施顺序

1. 先定钱包模式：托管 / 非托管
2. 先实现 Telegram 登录，不做传统注册页
3. 先做账本，再做余额
4. 先做站内转账，再做链上提现
5. 先做人工审核提现，再做自动出款
6. 先做单体后端，再考虑拆服务

## 一句判断

对你这个项目，**需要后端，但不需要一开始就做复杂分布式系统**。最合理的路线是：`React 前端 + 单体钱包后端 + PostgreSQL + Redis + 链监听 + 签名服务`。
