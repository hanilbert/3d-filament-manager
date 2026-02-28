# Docker 部署指南

本文档说明如何使用 Docker 部署 3D Filament Manager 应用。

## 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 512MB 可用内存
- 至少 1GB 可用磁盘空间

## 快速开始

### 1. 配置环境变量

复制示例配置文件并修改：

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少需要配置以下必填项：

```env
# 设置强密码（建议至少 16 位）
APP_PASSWORD=your_strong_password_here

# 设置站点域名（用于生成二维码）
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 2. 构建并启动服务

```bash
# 构建镜像并启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

### 3. 访问应用

打开浏览器访问：`http://localhost:3000`

使用 `.env` 中配置的 `APP_PASSWORD` 登录。

## 生产环境部署建议

### 安全配置

1. **使用强密码**
   ```env
   # 生成随机密码
   APP_PASSWORD=$(openssl rand -base64 32)

   # 生成独立的 Token 密钥
   TOKEN_SECRET=$(openssl rand -base64 32)
   ```

2. **配置 HTTPS**
   - 使用 Nginx 或 Traefik 作为反向代理
   - 配置 SSL/TLS 证书（推荐使用 Let's Encrypt）
   - 示例 Nginx 配置：
     ```nginx
     server {
         listen 443 ssl http2;
         server_name your-domain.com;

         ssl_certificate /path/to/cert.pem;
         ssl_certificate_key /path/to/key.pem;

         location / {
             proxy_pass http://localhost:3000;
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
             proxy_set_header X-Forwarded-Proto $scheme;
         }
     }
     ```

3. **限制端口暴露**
   ```yaml
   # docker-compose.yml
   ports:
     - "127.0.0.1:3000:3000"  # 仅本地访问
   ```

### 数据持久化

数据存储在 `./data` 目录中，包括：
- SQLite 数据库文件
- 上传的品牌 logo 图片

**重要**：定期备份此目录！

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf backup-20260228.tar.gz
```

### 资源限制

根据实际负载调整 `docker-compose.yml` 中的资源限制：

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # 最多使用 2 个 CPU 核心
      memory: 1G       # 最多使用 1GB 内存
    reservations:
      cpus: '0.5'      # 保留 0.5 个 CPU 核心
      memory: 512M     # 保留 512MB 内存
```

### 监控和日志

1. **查看容器状态**
   ```bash
   docker-compose ps
   ```

2. **查看实时日志**
   ```bash
   docker-compose logs -f app
   ```

3. **健康检查**
   ```bash
   docker inspect --format='{{.State.Health.Status}}' spool-tracker
   ```

## 常见问题

### 容器无法启动

1. 检查端口是否被占用：
   ```bash
   lsof -i :3000
   ```

2. 查看容器日志：
   ```bash
   docker-compose logs app
   ```

### 数据库迁移失败

如果数据库迁移失败，可以手动运行：

```bash
docker-compose exec app node node_modules/prisma/build/index.js migrate deploy
```

### 重置数据库

**警告**：此操作会删除所有数据！

```bash
# 停止容器
docker-compose down

# 删除数据目录
rm -rf data/

# 重新启动（会自动创建新数据库）
docker-compose up -d
```

## 更新应用

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 查看日志确认更新成功
docker-compose logs -f app
```

## 卸载

```bash
# 停止并删除容器
docker-compose down

# 删除镜像
docker rmi spool-tracker:latest

# 删除数据（可选）
rm -rf data/
```

## 高级配置

### 使用外部数据库

虽然默认使用 SQLite，但如果需要更高性能，可以考虑使用 PostgreSQL：

1. 修改 `prisma/schema.prisma`：
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. 更新 `.env`：
   ```env
   DATABASE_URL=postgresql://user:password@postgres:5432/filament_db
   ```

3. 在 `docker-compose.yml` 中添加 PostgreSQL 服务：
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: user
         POSTGRES_PASSWORD: password
         POSTGRES_DB: filament_db
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: unless-stopped

   volumes:
     postgres_data:
   ```

### 自定义端口

修改 `docker-compose.yml`：

```yaml
ports:
  - "8080:3000"  # 将容器的 3000 端口映射到主机的 8080 端口
```

同时更新 `.env` 中的 `NEXT_PUBLIC_BASE_URL`：

```env
NEXT_PUBLIC_BASE_URL=http://your-domain.com:8080
```

## 技术支持

如遇问题，请查看：
- 项目 README.md
- GitHub Issues
- 容器日志：`docker-compose logs -f app`
