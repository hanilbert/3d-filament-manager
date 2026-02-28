# 本地测试 vs Docker 部署说明

## 🤔 为什么 Docker 需要连接远程仓库？

虽然是"本地测试"，但 Docker 构建镜像时需要：

1. **基础镜像**：`FROM node:20-alpine` 需要从 Docker Hub 下载
2. **首次构建**：如果本地没有缓存，必须从远程拉取
3. **本地运行**：指的是容器在本地运行，但构建仍需基础镜像

## ✅ 两种测试方式对比

### 方式 1：本地开发模式（推荐用于开发测试）

**优点**：
- ✅ 无需 Docker
- ✅ 无需网络连接
- ✅ 启动快速
- ✅ 热重载支持

**步骤**：
```bash
# 1. 安装依赖（首次）
npm install

# 2. 生成 Prisma Client
npx prisma generate

# 3. 初始化数据库
npx prisma migrate deploy

# 4. 启动开发服务器
npm run dev

# 访问 http://localhost:3000
# 密码：dev123
```

**环境配置**（.env）：
```env
DATABASE_URL="file:./data/spool_tracker.db"
APP_PASSWORD="dev123"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

### 方式 2：Docker 容器模式（推荐用于生产部署）

**优点**：
- ✅ 环境一致性
- ✅ 易于部署
- ✅ 隔离性好
- ✅ 可移植性强

**前置要求**：
- Docker Hub 账户已验证邮箱
- 或使用国内镜像源

**步骤**：
```bash
# 方案 A：使用 Docker Hub（需要验证邮箱）
docker login
docker compose build
docker compose up -d

# 方案 B：使用国内镜像源
docker compose build --file Dockerfile.cn
docker compose up -d

# 访问 http://localhost:3000
```

**环境配置**（.env）：
```env
DATABASE_URL="file:/app/data/spool_tracker.db"
APP_PASSWORD="your_password"
NEXT_PUBLIC_BASE_URL="https://your-domain.com"
```

## 📊 当前测试状态

✅ **本地开发模式测试成功**
- 应用运行在：http://localhost:3000
- 数据库：./data/spool_tracker.db
- 登录密码：dev123

## 🔄 切换模式

### 从本地模式切换到 Docker 模式

1. 停止开发服务器（Ctrl+C）
2. 修改 .env 中的 DATABASE_URL：
   ```env
   DATABASE_URL="file:/app/data/spool_tracker.db"
   ```
3. 构建并启动 Docker 容器

### 从 Docker 模式切换到本地模式

1. 停止容器：`docker compose down`
2. 修改 .env 中的 DATABASE_URL：
   ```env
   DATABASE_URL="file:./data/spool_tracker.db"
   ```
3. 启动开发服务器：`npm run dev`

## 💡 建议

- **开发阶段**：使用本地开发模式，快速迭代
- **测试部署**：使用 Docker 模式，验证生产环境配置
- **生产环境**：使用 Docker + docker-compose.prod.yml

## 🐛 常见问题

**Q: Docker 构建失败，提示需要验证邮箱？**
A: 访问 https://hub.docker.com/ 验证邮箱，或使用 Dockerfile.cn（国内镜像源）

**Q: 端口 3000 被占用？**
A: 运行 `lsof -ti :3000 | xargs kill -9` 停止占用进程

**Q: 数据库迁移失败？**
A: 检查 .env 中的 DATABASE_URL 路径是否正确

**Q: 如何查看 Docker 容器日志？**
A: `docker compose logs -f app`
