# Spool Tracker — 部署指南

**适用环境**: 公网 VPS + Docker + Nginx

---

## 1. 前置条件

- Docker >= 20.x
- docker compose >= 2.x
- Nginx（反向代理 + SSL 终止）
- Let's Encrypt 证书（扫码场景需要 HTTPS）

---

## 2. 环境变量配置

在项目根目录创建 `.env`：

```env
# 访问密码（必填）
APP_PASSWORD=your_secret_password_here

# 站点域名（用于二维码跳转链接）
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# 数据库路径（与 Volume 对应）
DATABASE_URL=file:/app/data/spool_tracker.db

# Token 签名密钥（可选；不设置则回退 APP_PASSWORD）
TOKEN_SECRET=your_strong_signing_secret
```

> `.env` 已在 `.gitignore`，不要提交仓库。

---

## 3. 本地开发

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

访问 `http://localhost:3000`。

说明：扫码依赖 HTTPS 或 localhost。若需在非 localhost 环境测试摄像头扫码，可使用隧道工具创建 HTTPS 地址。

---

## 4. Docker 部署

### 4.1 首次部署

```bash
cp .env.example .env
mkdir -p data/logos
docker compose up -d --build
```

### 4.2 查看运行状态

```bash
docker compose ps
docker compose logs -f app
```

### 4.3 更新版本

```bash
git pull
docker compose up -d --build
```

容器启动命令会自动执行：

```bash
npx prisma migrate deploy && node server.js
```

---

## 5. 反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:7743;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. 数据备份与恢复

### 6.1 备份

```bash
tar -czf spool-tracker-backup-$(date +%Y%m%d).tar.gz ./data
```

`data/` 包含：

- `spool_tracker.db`
- `logos/`

### 6.2 恢复

```bash
docker compose down
tar -xzf spool-tracker-backup-YYYYMMDD.tar.gz
docker compose up -d
```

---

## 7. 常见问题

### Q1: 容器启动后 502

```bash
docker compose ps
docker compose logs app
```

常见原因：数据库目录不存在或权限问题。

### Q2: 扫码无法调用摄像头

检查：

1. 是否 HTTPS（或 localhost）
2. 浏览器是否授予摄像头权限

### Q3: Logo 上传成功但不显示

```bash
ls -la data/logos/
```

必要时修复权限：

```bash
sudo chown -R 1001:1001 data/logos/
```

### Q4: 重启容器后是否会掉登录

一般不会。Token 为签名校验，不依赖内存会话。以下情况会失效：

1. Token 超过 7 天有效期
2. 修改了 `APP_PASSWORD`（且未单独设置 `TOKEN_SECRET`）
3. 修改了 `TOKEN_SECRET`

### Q5: 修改访问密码后需要做什么

1. 修改 `.env` 中 `APP_PASSWORD`
2. 重启服务：`docker compose restart app`
3. 现有登录可能失效，需重新登录

