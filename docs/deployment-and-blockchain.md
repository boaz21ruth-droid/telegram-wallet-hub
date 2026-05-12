# 部署方案与区块链说明

## 部署在哪里

推荐 **VPS + Docker Compose**，不建议用 PaaS（Railway/Render），原因是钱包涉及资金安全，需要完全控制服务器环境、防火墙和密钥存储。

**推荐选项（按性价比排）：**

| 服务商 | 入门配置 | 价格 | 备注 |
|---|---|---|---|
| **Hetzner** | CX22：2 核 4G 40G SSD | €4/月 | 首选，性价比最高，欧洲/美国节点 |
| **DigitalOcean** | Basic：1 核 2G | $6/月 | 文档好，入门友好 |
| **Vultr** | 1 核 2G | $6/月 | 节点多，亚洲延迟低 |

4G 内存足够跑 NestJS + PostgreSQL + Nginx，等日活上千再考虑分离数据库。

---

## 本地开发

```bash
# 后端（backend/ 目录）
cp .env.example .env          # 配置必填项（见下方环境变量表）
npm run prisma:migrate        # 应用数据库迁移
npm run start:dev             # 热重载，监听 :7001

# 前端（repo 根目录，另开终端）
npm run dev                   # Vite dev server，监听 :8080
```

默认代理：Vite 将 `/api/*` 代理到 `http://localhost:7001`（见 `vite.config.ts`）。

- 用户站点：`http://localhost:8080/`
- 管理站点：`http://localhost:8080/admin-app/`

开发环境 bootstrap 管理员账号默认为 `admin` / `admin123456`，服务启动时自动创建。

---

## 生产构建与部署

### 前端构建

```bash
# repo 根目录
npm run build
```

产物在 `dist/`，包含两个独立入口：
- `dist/index.html` — 用户站点
- `dist/admin-app/index.html` — 管理站点

### 后端构建

```bash
cd backend
npm run build
node dist/main.js
```

### Nginx 参考配置

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL 证书（Certbot 自动管理）
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    root /path/to/dist;

    # 管理站点：/admin-app/ 前缀，回落到 admin-app/index.html
    location /admin-app/ {
        alias /path/to/dist/admin-app/;
        try_files $uri $uri/ /admin-app/index.html;
    }

    # API 反向代理到 NestJS
    location /api/ {
        proxy_pass         http://127.0.0.1:7001/;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 用户站点：其余所有请求回落到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# HTTP → HTTPS 跳转
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

### Docker Compose 示例

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: walletdb
      POSTGRES_USER: wallet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "7001:7001"
    depends_on:
      - db
    command: sh -c "npx prisma migrate deploy && node dist/main.js"

volumes:
  pgdata:
```

---

## 管理员账号初始化

生产环境首次部署在 `backend/.env` 中设置：

```env
ADMIN_BOOTSTRAP_USERNAME=youradmin
ADMIN_BOOTSTRAP_PASSWORD=YourStrongPassword123!
ADMIN_BOOTSTRAP_DISPLAY_NAME=Super Admin
ADMIN_BOOTSTRAP_ROLE=SUPER_ADMIN

# 管理员 JWT 建议使用独立密钥
ADMIN_JWT_SECRET=another-random-64-char-string-different-from-jwt-secret
ADMIN_JWT_EXPIRES_IN=8h
```

服务启动时若该用户名不存在则自动创建，已存在则更新密码和角色。初始化完成后可在数据库中创建更多 `AdminAccount` 记录，分配 `OPS_REVIEWER` 或 `FINANCE_OPERATOR` 角色。

---

## 需要部署合约吗？

**不需要。** 托管钱包 + 站内账本，业务逻辑全在后端数据库里，链上只调用已有合约。

**TON（原生代币）**
- 不需要合约
- 生成 TON 钱包地址（一对公私钥），用户往这个地址转 TON 即为充值
- 提现时签名服务从热钱包地址往外广播

**USDT on TON（Jetton）**
- Tether 已在 TON 链部署 Jetton 合约，直接调用
- 充值：扫链发现有人转入你的 Jetton 地址
- 提现：调用 Jetton transfer 方法从热钱包打出

**USDT on TRC20**
- USDT 合约已在 Tron 主网部署（`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`）
- 热钱包 index 0 用于广播提现；index 1+ 用于生成用户充值地址

---

## 当前最小可运行架构

```
用户 ──> Telegram Mini App (/)
管理员 ──> 管理后台 (/admin-app/)
              │
              ▼
         NestJS API（VPS :7001）
              │
         PostgreSQL（账本、订单）
              │
    ┌─────────┴──────────┐
    │                    │
链监听服务           签名服务
（扫 TON/TRC20 链，   （持有热钱包私钥，
 发现充值后调用        提现审批后广播交易）
 /admin/deposits/credit）
```

链监听和签名服务 V1 可先用管理员手动操作代替（`POST /admin/deposits/credit` 和 `POST /admin/withdrawals/:id/sign`），等业务跑通再自动化。
