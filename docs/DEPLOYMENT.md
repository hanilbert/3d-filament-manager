# Spool Tracker — 部署指南

本指南涵盖两种部署场景，选择适合你的方案即可。

| 场景 | 方案 | 适用环境 |
|------|------|---------|
| [方案 A](#方案-a局域网-http-直连) | 局域网 HTTP 直连 | NAS、家用 PC、内网服务器 |
| [方案 B](#方案-b公网-https-反代) | 公网 HTTPS + 反代 | VPS、云服务器 + 域名 |

---

## 前置条件

- Docker >= 20.x
- docker compose >= 2.x（Docker Desktop 已内置）
- 镜像：`hanilbert/3d-filament-manager:latest`（支持 amd64 / arm64）

---

## 方案 A：局域网 HTTP 直连

> 适用于 NAS（群晖/威联通/Unraid）、家用 PC、内网服务器等无公网域名的环境。

### A.1 获取局域网 IP

在部署设备上查看局域网 IP：

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux / NAS SSH
hostname -I | awk '{print $1}'

# Windows
ipconfig
# 查找「IPv4 地址」，通常为 192.168.x.x
```

> 记住这个 IP（例如 `192.168.1.100`），后续配置需要用到。

### A.2 配置环境变量

```bash
# 使用局域网专用模板
cp .env.local.example .env
```

编辑 `.env`，修改以下两项：

```env
# 替换为你的实际密码
APP_PASSWORD=你的密码

# 替换为你的局域网 IP（保留端口号）
NEXT_PUBLIC_BASE_URL=http://192.168.1.100:7743
```

> **关键配置说明**：
> - `COOKIE_SECURE=false` 已在模板中预设，HTTP 环境必须保留此项，否则登录 Cookie 无法写入
> - `NEXT_PUBLIC_BASE_URL` 决定二维码内容，必须填写手机能访问到的地址

### A.3 启动服务

```bash
# 创建数据目录
mkdir -p data/logos

# 启动容器
docker compose up -d

# 查看运行状态
docker compose ps

# 查看日志（首次启动时建议查看）
docker compose logs -f app
```

### A.4 验证部署

1. **电脑浏览器**：访问 `http://192.168.1.100:7743`，应看到登录页面
2. **手机浏览器**（连接同一 WiFi）：访问同一地址，确认可以登录
3. **二维码测试**：进入任意料卷详情页，查看二维码是否包含正确的局域网地址

### A.5 摄像头扫码说明

浏览器调用摄像头（`getUserMedia`）要求**安全上下文**，即：

| 访问方式 | 能否扫码 | 说明 |
|---------|---------|------|
| `http://localhost:*` | ✅ | localhost 始终被视为安全上下文 |
| `http://192.168.x.x:*` | ⚠️ 部分可用 | Chrome/Edge 支持，Safari 可能限制 |
| `https://...` | ✅ | HTTPS 始终可用 |

**如果你的手机浏览器不支持 HTTP 下扫码**，有以下解决方案：

#### 方案 1：Chrome Flags（推荐，零成本）

在 Android Chrome 中访问 `chrome://flags`，搜索 `Insecure origins treated as secure`，添加你的地址（如 `http://192.168.1.100:7743`），重启浏览器。

#### 方案 2：Tailscale 零配置 HTTPS

[Tailscale](https://tailscale.com/) 可以为内网设备分配 HTTPS 域名，无需公网 IP 或端口映射：

1. 在部署设备和手机上安装 Tailscale 并登录同一账号
2. 开启 [MagicDNS](https://tailscale.com/kb/1081/magicdns) 和 [HTTPS 证书](https://tailscale.com/kb/1153/enabling-https)
3. 将 `NEXT_PUBLIC_BASE_URL` 改为 Tailscale 分配的 HTTPS 地址
4. 将 `COOKIE_SECURE` 改回 `true`（或删除该行）

#### 方案 3：自签名证书 + 反代

适合有一定运维基础的用户，使用 `mkcert` 生成本地信任证书 + Nginx/Caddy 反代。

---

## 方案 B：公网 HTTPS + 反代

> 适用于有公网 VPS + 域名的环境，通过 Nginx + Let's Encrypt 实现 HTTPS。

### B.1 前置条件

在方案 A 的基础上，额外需要：

- 一个域名（如 `spool.example.com`）并解析到服务器 IP
- Nginx（反向代理 + SSL 终止）
- Let's Encrypt 证书（推荐使用 certbot 自动续签）

### B.2 配置环境变量

```bash
# 使用公网部署模板
cp .env.example .env
```

编辑 `.env`：

```env
# 替换为你的实际密码
APP_PASSWORD=你的密码

# 替换为你的域名
NEXT_PUBLIC_BASE_URL=https://spool.example.com

# 建议公网部署时单独设置签名密钥
TOKEN_SECRET=一个随机的强密钥
```

> 公网部署无需设置 `COOKIE_SECURE`，默认即为 `true`（Cookie 仅通过 HTTPS 传输）。

### B.3 启动服务

```bash
mkdir -p data/logos
docker compose up -d
```

### B.4 配置 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/spool.example.com

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name spool.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name spool.example.com;

    ssl_certificate /etc/letsencrypt/live/spool.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spool.example.com/privkey.pem;

    # 限制上传大小（Logo 上传）
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

启用站点并测试：

```bash
sudo ln -s /etc/nginx/sites-available/spool.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### B.5 申请 SSL 证书（Let's Encrypt）

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 自动申请并配置证书
sudo certbot --nginx -d spool.example.com

# 验证自动续签
sudo certbot renew --dry-run
```

### B.6 验证部署

1. 访问 `https://spool.example.com`，应看到登录页面
2. 浏览器地址栏应显示 🔒 安全连接标识
3. 手机扫描二维码，确认跳转到 HTTPS 地址

---

## 环境变量速查

| 变量 | 说明 | 局域网示例 | 公网示例 |
|------|------|-----------|---------|
| `APP_PASSWORD` | 访问密码（必填） | `mypassword` | `mypassword` |
| `NEXT_PUBLIC_BASE_URL` | 二维码跳转基地址 | `http://192.168.1.100:7743` | `https://spool.example.com` |
| `DATABASE_URL` | 数据库路径 | `file:/app/data/spool_tracker.db` | `file:/app/data/spool_tracker.db` |
| `TOKEN_SECRET` | 签名密钥（可选） | —（回退 APP_PASSWORD） | `随机强密钥` |
| `PORT` | 宿主机端口（默认 7743） | `7743` | `7743` |
| `COOKIE_SECURE` | Cookie Secure 标记 | `false`（必须） | 留空（默认 true） |

---

## 数据备份与恢复

### 备份

```bash
tar -czf spool-tracker-backup-$(date +%Y%m%d).tar.gz ./data
```

`data/` 目录包含：
- `spool_tracker.db` — SQLite 数据库
- `logos/` — 品牌 Logo 文件

### 恢复

```bash
docker compose down
tar -xzf spool-tracker-backup-YYYYMMDD.tar.gz
docker compose up -d
```

---

## 版本更新

```bash
# 拉取最新镜像
docker compose pull

# 重新创建容器
docker compose up -d

# 查看日志确认迁移成功
docker compose logs -f app
```

容器启动时会自动执行 `prisma migrate deploy` 应用数据库迁移。

---

## 常见问题

### Q1: 容器启动后 502 / 无法访问

```bash
docker compose ps      # 检查容器状态
docker compose logs app # 查看错误日志
```

常见原因：
- 数据目录权限问题 → 容器启动时会自动修复，通常无需手动处理
- 端口被占用 → 修改 `.env` 中的 `PORT`

### Q2: 手机扫码无法调用摄像头

1. 确认是 HTTPS 或 localhost 访问（参见[方案 A.5 摄像头扫码说明](#a5-摄像头扫码说明)）
2. 确认浏览器已授予摄像头权限

### Q3: 二维码扫出来的地址不对

确认 `NEXT_PUBLIC_BASE_URL` 是否设置正确：
- 局域网：`http://你的IP:7743`（手机和电脑在同一网段）
- 公网：`https://你的域名`

修改后需重启容器：`docker compose restart app`

### Q4: 登录后刷新页面被踢出

检查 `COOKIE_SECURE` 配置：
- HTTP 部署必须设为 `false`
- HTTPS 部署留空或 `true`

### Q5: Logo 上传成功但不显示

```bash
ls -la data/logos/
```

必要时修复权限：
```bash
sudo chown -R 1001:1001 data/
docker compose restart app
```

### Q6: 重启容器后是否会掉登录

一般不会。Token 为签名校验，不依赖内存会话。以下情况会失效：

1. Token 超过 7 天有效期
2. 修改了 `APP_PASSWORD`（且未单独设置 `TOKEN_SECRET`）
3. 修改了 `TOKEN_SECRET`

### Q7: NAS 上如何部署

大多数 NAS 系统（群晖 DSM、威联通 QTS、Unraid）都支持 Docker：

1. 通过 NAS 的 Docker 管理界面拉取 `hanilbert/3d-filament-manager:latest`
2. 按方案 A 配置环境变量（特别注意 `COOKIE_SECURE=false`）
3. 端口映射：宿主机 `7743` → 容器 `3000`
4. 文件夹映射：选择一个 NAS 共享文件夹映射到容器 `/app/data`
5. `NEXT_PUBLIC_BASE_URL` 填写 NAS 的局域网 IP
