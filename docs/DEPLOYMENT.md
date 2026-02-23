# Spool Tracker — 部署指南

**适用环境**: 公网 VPS + Docker + Nginx

---

## 目录

1. [前置条件](#1-前置条件)
2. [环境变量配置](#2-环境变量配置)
3. [本地开发](#3-本地开发)
4. [Docker 部署](#4-docker-部署)
5. [Nginx 反向代理配置](#5-nginx-反向代理配置)
6. [数据备份与恢复](#6-数据备份与恢复)
7. [常见问题](#7-常见问题)

---

## 1. 前置条件

**VPS 环境要求**：
- Docker >= 20.x
- docker-compose >= 2.x
- Nginx（用于反向代理和 SSL 终止）
- Let's Encrypt 证书（扫码功能强制要求 HTTPS）

---

## 2. 环境变量配置

在项目根目录（`docker-compose.yml` 同级）创建 `.env` 文件：

```env
# 访问密码（必填，建议使用强密码）
APP_PASSWORD=your_secret_password_here

# 站点域名（必填，用于生成二维码中的完整 URL）
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# 数据库路径（固定，与 Docker Volume 对应，请勿修改）
DATABASE_URL=file:/app/data/spool_tracker.db
```

> **安全提醒**：`.env` 文件已在 `.gitignore` 中排除，切勿提交到 Git。

参考模板见 `.env.example`。

---

## 3. 本地开发

### 3.1 安装依赖

```bash
npm install
```

### 3.2 配置本地环境变量

复制模板并修改：

```bash
cp .env.example .env
```

本地开发默认配置（`.env` 中已预设）：
```env
APP_PASSWORD=dev123
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DATABASE_URL=file:./data/dev.db
```

### 3.3 初始化数据库

```bash
npx prisma migrate dev
```

### 3.4 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000，使用密码 `dev123` 登录。

> **注意**：本地 HTTP 环境下，扫码功能（html5-qrcode）无法调用摄像头。如需测试扫码，请使用 `ngrok` 创建 HTTPS 隧道：
> ```bash
> ngrok http 3000
> ```

---

## 4. Docker 部署

### 4.1 构建镜像

```bash
docker compose build
```

### 4.2 首次启动

```bash
# 确保 data/ 目录存在
mkdir -p data/logos

# 启动容器（自动执行 prisma migrate deploy）
docker compose up -d
```

### 4.3 查看日志

```bash
docker compose logs -f app
```

### 4.4 更新部署

```bash
git pull
docker compose build
docker compose up -d
```

> 更新时数据库会自动执行新的 migration（Dockerfile 启动命令：`prisma migrate deploy && node server.js`）。

### 4.5 docker-compose.yml 说明

```yaml
services:
  app:
    image: spool-tracker:latest
    build: .
    ports:
      - "3000:3000"           # 仅本地/内网访问，公网通过 Nginx 代理
    volumes:
      - ./data:/app/data      # 持久化 SQLite 数据库和 Logo 图片
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/auth/login"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 5. Nginx 反向代理配置

> **重要**：HTML5 Camera API 要求 HTTPS，否则扫码功能无法使用。

### 5.1 安装 Certbot 获取 SSL 证书

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5.2 Nginx 配置示例

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

    # 支持 Logo 图片上传（最大 10MB）
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 证书自动续期

Certbot 安装后会自动配置 cron job 续期，可验证：

```bash
sudo certbot renew --dry-run
```

---

## 6. 数据备份与恢复

### 6.1 备份

只需备份 `data/` 目录即可完整恢复所有数据：

```bash
# 备份
tar -czf spool-tracker-backup-$(date +%Y%m%d).tar.gz ./data

# 或使用 rsync 同步到远程
rsync -avz ./data/ user@backup-server:/backups/spool-tracker/
```

`data/` 目录包含：
- `spool_tracker.db` — SQLite 数据库（所有耗材、位置数据）
- `logos/` — 所有上传的品牌 Logo 图片

### 6.2 恢复

```bash
docker compose down
tar -xzf spool-tracker-backup-20260221.tar.gz
docker compose up -d
```

### 6.3 建议：自动定期备份

在 VPS 上配置 crontab（每天凌晨 3 点备份，保留 30 天）：

```cron
0 3 * * * tar -czf /backups/spool-tracker-$(date +\%Y\%m\%d).tar.gz /path/to/3d-filament-manager/data && find /backups -name "spool-tracker-*.tar.gz" -mtime +30 -delete
```

---

## 7. 常见问题

### Q: 容器启动后访问显示 502 Bad Gateway

检查容器是否正常运行：
```bash
docker compose ps
docker compose logs app
```

常见原因：数据库初始化失败（检查 `data/` 目录权限）

### Q: 扫码功能显示"摄像头访问被拒绝"

原因：html5-qrcode 要求 HTTPS 环境。确认：
1. 已配置 SSL 证书
2. 通过 HTTPS 访问（非 HTTP）
3. 浏览器已授权摄像头权限

### Q: Logo 图片上传后不显示

检查 `data/logos/` 目录是否存在且有写入权限：
```bash
ls -la data/logos/
# 如需修复权限（Docker 容器内 nextjs 用户 UID 通常为 1001）
sudo chown -R 1001:1001 data/logos/
```

### Q: 重启容器后需要重新登录

这是已知限制：Token 存储在内存中，容器重启后失效。属于预期行为，重新输入密码即可。

### Q: 如何修改访问密码

1. 修改 `.env` 文件中的 `APP_PASSWORD`
2. 重启容器：`docker compose restart app`
3. 所有已登录 Token 失效，需要重新登录

### Q: 如何查看数据库内容（调试）

```bash
# 进入容器
docker compose exec app sh

# 使用 prisma studio（仅开发环境）
# 或直接访问 SQLite（需安装 sqlite3 工具）
sqlite3 /app/data/spool_tracker.db ".tables"
sqlite3 /app/data/spool_tracker.db "SELECT * FROM Spool LIMIT 10;"
```
