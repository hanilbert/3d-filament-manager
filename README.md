# Spool Tracker — 3D打印耗材管理系统

一款面向3D打印爱好者的耗材位置与生命周期管理工具。支持扫码定位、二维码标签打印、耗材字典管理，移动端优先设计，可通过 Docker 自托管部署。

---

## 功能特性

- **料卷管理** — 记录每卷耗材的品牌、材质、颜色及当前状态（使用中 / 已用完）
- **耗材字典** — 预设打印参数（喷嘴温度、热床温度、打印速度），新建料卷时直接关联复用
- **位置追踪** — 为每个存放位置生成二维码，扫码即可更新料卷所在位置
- **二维码标签** — 为料卷生成二维码，打印后贴在实物上方便扫描
- **全文搜索** — 按品牌、材质等条件快速检索耗材字典
- **生命周期管理** — 支持将料卷标记为已用完，也支持重新入库
- **移动优先** — 响应式布局，专为手机浏览器优化
- **Docker 部署** — 提供完整的 Dockerfile 和 docker-compose，一键自托管

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide React |
| ORM | Prisma |
| 数据库 | SQLite（文件型，适合单机部署）|
| 二维码 | html5-qrcode（扫描）+ qrcode.react（生成）|
| 部署 | Docker 多阶段构建 + docker-compose |

---

## 快速开始（本地开发）

### 前置要求

- Node.js 20+
- npm

### 安装与运行

```bash
# 克隆仓库
git clone <repo-url>
cd 3d-filament-manager

# 安装依赖
npm install

# 复制并配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 APP_PASSWORD

# 初始化数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可看到应用。

---

## Docker 部署（推荐用于生产）

```bash
# 复制环境变量文件
cp .env.example .env
# 编辑 .env，设置密码和域名

# 构建并启动
docker compose up -d
```

- 数据（SQLite 数据库 + 品牌 Logo）挂载在 `./data` 目录，重启容器后数据不丢失
- 容器启动时自动执行数据库迁移
- 健康检查：每 30 秒检测一次服务状态

---

## 环境变量

复制 `.env.example` 并按需修改：

| 变量 | 说明 | 示例 |
|------|------|------|
| `APP_PASSWORD` | 应用访问密码（必填）| `your_secret_password` |
| `NEXT_PUBLIC_BASE_URL` | 对外访问域名，用于生成二维码链接 | `https://spools.example.com` |
| `DATABASE_URL` | SQLite 数据库文件路径 | `file:/app/data/spool_tracker.db` |

---

## 数据库模型

```
GlobalFilament（耗材字典）
  └── 品牌、材质、颜色、打印参数、品牌 Logo

Spool（料卷实例）
  ├── 关联 GlobalFilament（多对一）
  ├── 关联 Location（多对一，可为空）
  └── 状态：ACTIVE / EMPTY

Location（存放位置）
  └── 位置名称（如"抽屉1"、"柜子顶层"）
```

---

## 项目结构

```
src/
├── app/
│   ├── (auth)/login/     # 登录页
│   ├── api/              # API 路由（料卷、字典、位置、文件上传）
│   ├── spools/           # 料卷列表
│   ├── spool/[id]/       # 料卷详情 & 标签打印
│   ├── catalog/          # 耗材字典列表 & 编辑
│   └── locations/        # 位置管理
├── components/           # React 组件（扫码器、二维码、表单等）
└── lib/                  # 工具库（数据库、认证、请求封装）
prisma/
├── schema.prisma         # 数据模型定义
└── migrations/           # 数据库迁移历史
```

---

## 常用命令

```bash
npm run dev       # 启动开发服务器
npm run build     # 生产构建
npm start         # 启动生产服务
npm run lint      # ESLint 代码检查
npx prisma studio # 可视化数据库管理界面
```

---

## 注意事项

- 认证采用**内存令牌**（服务重启后需重新登录），Token 有效期 7 天
- SQLite 适合个人或小团队使用，不建议高并发场景
- 二维码扫描需要 HTTPS 或 localhost（浏览器摄像头权限限制）
- 品牌 Logo 文件存储在 `data/logos/` 目录

---

## License

MIT
