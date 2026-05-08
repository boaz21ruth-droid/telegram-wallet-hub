# 部署方案与区块链说明

## 部署在哪里

你这个阶段适合 **VPS + Docker Compose**，不建议用 PaaS（Railway/Render），原因是钱包涉及资金安全，需要你完全控制服务器环境、防火墙、密钥存储。

**推荐选项（按性价比排）：**

| 服务商 | 入门配置 | 价格 | 备注 |
|---|---|---|---|
| **Hetzner** | CX22：2 核 4G 40G SSD | €4/月 | 首选，性价比最高，欧洲/美国节点 |
| **DigitalOcean** | Basic：1 核 2G | $6/月 | 文档好，入门友好 |
| **Vultr** | 1 核 2G | $6/月 | 节点多，亚洲延迟低 |

4G 内存足够跑 NestJS + PostgreSQL + Nginx，等日活上千再考虑分离数据库。

**基本部署结构：**
```
Nginx (80/443, SSL via Certbot)
  └─> NestJS :3001
PostgreSQL (本机，或后期换 Managed DB)
```

Bot Webhook 和 Mini App 都是 Telegram 主动调你的后端，不存在地理延迟问题，选欧美节点即可。

---

## 需要部署合约吗？

**不需要。** 你做的是托管钱包 + 站内账本，业务逻辑全在你的后端数据库里，链上只用到已有合约。

具体来说：

**TON（原生代币）**
- 完全不需要合约
- 你只需要生成一个 TON 钱包地址（一对公私钥），用户往这个地址转 TON 就算充值
- 提现时你的签名服务从这个地址往外发

**USDT on TON（Jetton）**
- USDT 的 Jetton 合约已经由 Tether 部署在 TON 链上，你直接调用它即可
- 你只需要知道你的热钱包地址对应的 **Jetton Wallet 地址**（由合约派生，不需要你部署任何东西）
- 充值：扫链发现有人给你的 Jetton 地址转 USDT
- 提现：调用 Jetton transfer 方法，从你的热钱包往外打

**你实际需要的链上工具：**

```
1. 热钱包密钥对（tonweb / @ton/ton 库生成，不上链）
2. 链监听服务（扫块 or TON Center API webhook，发现充值就通知后端）
3. 签名服务（持有私钥，收到提现指令后签名广播）
   ↑ 这三个都是你自己的程序，不是合约
```

**什么时候才需要合约？**
- 做去中心化钱包（用户自己持有私钥）→ 需要
- 做 DeFi（借贷/兑换/流动性池）→ 需要
- 做多签冷钱包（TON 有现成的 multisig 合约可以直接用，不用自己写）
- 你现在这个模式 → **不需要**

---

## 当前最小可运行架构

```
用户 ──> Telegram Mini App
              │
              ▼
         你的 NestJS API（VPS）
              │
         PostgreSQL（账本、订单）
              │
    ┌─────────┴──────────┐
    │                    │
链监听服务           签名服务
（扫 TON 链，         （持有热钱包私钥
发现充值调            收到提现审批后
 /admin/deposits/credit）  广播交易）
```

链监听和签名服务 V1 可以先用管理员手动操作代替（后端已有 `/admin/deposits/credit` 和 `/admin/withdrawals/:id/sign`），等业务跑通再自动化这两块。
