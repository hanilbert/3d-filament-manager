# Spool Tracker — 开发任务分解

**关联文档**: `PRD.md`
**技术栈**: Next.js 15 (App Router, TypeScript) + Prisma + SQLite + Tailwind CSS + shadcn/ui
**目标**: 可打包为单 Docker 镜像，部署在公网 VPS 上

---

## 任务状态说明

- `[ ]` 待开始
- `[x]` 已完成
- `[~]` 进行中

---

## ✅ Phase 0：项目初始化（已完成）

### T0-1 初始化 Next.js 项目
- [x] 使用 `create-next-app` 创建 Next.js 15 项目，启用 TypeScript、Tailwind CSS、App Router
- [x] 配置 `tsconfig.json` 路径别名（`@/` 指向 `src/`）
- [x] 安装核心依赖：
  - `prisma` + `@prisma/client`
  - `shadcn/ui`（通过 `npx shadcn@latest init` 初始化）
  - `qrcode.react`（QR 码生成）
  - `html5-qrcode`（QR 码扫描）
  - `formidable`（文件上传处理）
  - `uuid`（UUID 生成）
  - `@types/uuid`、`@types/formidable`
- [x] shadcn/ui 组件已安装：button、card、dialog、tabs、input、label、badge、alert、select

### T0-2 配置环境变量模板
- [x] 创建 `.env.example`（三个环境变量模板）
- [x] 创建本地开发用 `.env`（DATABASE_URL=file:./data/dev.db，APP_PASSWORD=dev123）
- [x] 更新 `.gitignore`（排除 `.env`、`.env.local`、`/data/`）

### T0-3 创建项目目录结构
- [x] `data/logos/` 目录已创建（Docker Volume 挂载点）
- [x] `src/lib/`、`src/components/` 目录由 shadcn/ui 自动生成

---

## ✅ Phase 1：数据库与基础设施（已完成）

### T1-1 编写 Prisma Schema
- [x] `prisma/schema.prisma` 已创建，定义三张表：GlobalFilament、Location、Spool
- [x] 运行 `npx prisma migrate dev --name init`，迁移文件已生成
- [x] SQLite 数据库文件：`data/dev.db`

### T1-2 创建 Prisma 客户端单例
- [x] `src/lib/db.ts`：全局单例 prisma 客户端

### T1-3 实现认证工具函数
- [x] `src/lib/auth.ts`：`generateToken()`、`verifyToken()`、`extractBearerToken()`
  - token 存储：内存 Map（token → 过期时间戳），有效期 7 天
- [x] `src/lib/api-auth.ts`：`requireAuth(request)` 供 API Route 使用

### T1-4 配置 Logo 静态文件服务
- [x] `next.config.ts` 更新：`serverActions.bodySizeLimit = "10mb"`
- [ ] Logo API 代理路由（`GET /api/logos/[filename]`）待在 T2-5 中实现

---

## 🚧 Phase 2：API 层实现（进行中）

> 所有 API（除 `/api/auth/login`）均需验证 `Authorization: Bearer {token}` Header。

### T2-1 认证 API ✅
- [x] **POST `/api/auth/login`** → `src/app/api/auth/login/route.ts`

### T2-2 全局耗材字典 API ✅
- [x] **GET `/api/catalog`**（支持 q、brand、material 过滤）→ `src/app/api/catalog/route.ts`
- [x] **POST `/api/catalog`** → `src/app/api/catalog/route.ts`
- [x] **GET `/api/catalog/[id]`** → `src/app/api/catalog/[id]/route.ts`
- [x] **PATCH `/api/catalog/[id]`** → `src/app/api/catalog/[id]/route.ts`
- [x] **DELETE `/api/catalog/[id]`**（有关联 Spool 则拒绝）→ `src/app/api/catalog/[id]/route.ts`

### T2-3 料卷 API ⬜ 待实现
- [ ] **GET `/api/spools`**（支持 `?status=ACTIVE|EMPTY`）→ `src/app/api/spools/route.ts`
- [ ] **POST `/api/spools`**（传入 `global_filament_id`）→ `src/app/api/spools/route.ts`
- [ ] **GET `/api/spools/[id]`**（含 globalFilament + location）→ `src/app/api/spools/[id]/route.ts`
- [ ] **PATCH `/api/spools/[id]`**（更新 location_id 或 status）→ `src/app/api/spools/[id]/route.ts`

### T2-4 位置 API ⬜ 待实现
- [ ] **GET `/api/locations`**（含活跃料卷数）→ `src/app/api/locations/route.ts`
- [ ] **POST `/api/locations`** → `src/app/api/locations/route.ts`
- [ ] **GET `/api/locations/[id]`**（含 ACTIVE Spool 列表）→ `src/app/api/locations/[id]/route.ts`
- [ ] **PATCH `/api/locations/[id]`** → `src/app/api/locations/[id]/route.ts`
- [ ] **DELETE `/api/locations/[id]`**（解绑料卷 location_id，不删料卷）→ `src/app/api/locations/[id]/route.ts`

### T2-5 文件上传 API ⬜ 待实现
- [ ] **POST `/api/upload/logo`**（formidable 解析，验证类型/大小，存到 `data/logos/`）→ `src/app/api/upload/logo/route.ts`
- [ ] **GET `/api/logos/[filename]`**（代理读取 data/logos/ 下的文件）→ `src/app/api/logos/[filename]/route.ts`

---

## ⬜ Phase 3：Next.js 中间件与布局（待实现）

### T3-1 全局路由鉴权中间件
- [ ] `src/middleware.ts`：检查 Cookie 中的 token，无效则重定向 `/login`
  - 放行：`/login`、`/api/auth/login`、`/_next/`、`/api/logos/`

### T3-2 根布局与导航
- [ ] `src/app/layout.tsx`：更新为包含底部导航的全局布局
- [ ] `src/components/BottomNav.tsx`：底部三标签导航（料卷 / 字典 / 位置）

### T3-3 基础 UI 组件
- [ ] `src/components/ColorSwatch.tsx`：颜色色块（有 hex 则显示色块，无则灰色占位）
- [ ] `src/components/QRCodeDisplay.tsx`：使用 `qrcode.react` 渲染二维码
- [ ] `src/components/QRScanner.tsx`：使用 `html5-qrcode` 调起摄像头扫码
- [ ] `src/components/StatusBadge.tsx`：ACTIVE/EMPTY 状态标签
- [ ] `src/components/ConfirmDialog.tsx`：确认对话框（用于「标记为已用完」）

---

## ⬜ Phase 4：页面实现（待实现）

### T4-1 登录页 `/login`
- [ ] `src/app/(auth)/login/page.tsx`：密码输入 → POST /api/auth/login → 存 localStorage + Cookie → 跳转 /spools

### T4-2 料卷列表页 `/spools`
- [ ] `src/app/spools/page.tsx`：Active/Empty 双 Tab，卡片展示，点击进详情

### T4-3 料卷详情页 `/spool/[id]`
- [ ] `src/app/spool/[id]/page.tsx`：
  - ACTIVE 状态：修改位置（扫码）、打印标签、标记已用完
  - EMPTY 状态：警告横幅 + 重新入库按钮

### T4-4 料卷标签打印页 `/spool/[id]/print`
- [ ] `src/app/spool/[id]/print/page.tsx`：40×30mm CSS 打印，左侧信息右侧 QR 码

### T4-5 全局字典列表页 `/catalog`
- [ ] `src/app/catalog/page.tsx`：搜索、筛选、卡片列表

### T4-6 新建字典页 `/catalog/new`
- [ ] `src/app/catalog/new/page.tsx`：表单（含 Logo 上传/URL 二选一）

### T4-7 字典详情页 `/catalog/[id]`
- [ ] `src/app/catalog/[id]/page.tsx`：详情 + 关联料卷列表 + 加入料卷按钮

### T4-8 编辑字典页 `/catalog/[id]/edit`
- [ ] `src/app/catalog/[id]/edit/page.tsx`：预填表单，提交 PATCH

### T4-9 位置列表页 `/locations`
- [ ] `src/app/locations/page.tsx`：位置卡片列表 + 新建

### T4-10 位置详情页 `/location/[id]`
- [ ] `src/app/location/[id]/page.tsx`：位置名称 + 活跃料卷列表 + 打印/编辑/删除

### T4-11 位置标签打印页 `/location/[id]/print`
- [ ] `src/app/location/[id]/print/page.tsx`：40×30mm CSS 打印，左侧位置名右侧 QR 码

---

## ⬜ Phase 5：Docker 与部署（待实现）

### T5-1 编写 Dockerfile
- [ ] 多阶段构建（deps → builder → runner），基于 `node:20-alpine`
- [ ] 启动命令：先 `prisma migrate deploy`，再 `node server.js`

### T5-2 编写 docker-compose.yml
- [ ] Volume 挂载 `./data:/app/data`，env_file 读取 `.env`

### T5-3 Logo 静态服务配置
- [ ] 确认容器内 `/app/data/logos/` 文件权限
- [ ] 通过 `GET /api/logos/[filename]` API 代理读取（见 T2-5）

---

## 依赖关系总览

```
T0-1 → T0-2 → T0-3
T0-1 → T1-1 → T1-2 → T1-3
T1-3 → T2-1
T1-2 → T2-2, T2-3, T2-4, T2-5
T0-1 → T3-1, T3-2, T3-3
T3-1, T3-2, T3-3 → T4-1 ~ T4-11
T2-x → T4-x（各页面依赖对应 API）
T4-x → T5-1, T5-2, T5-3
```

---

## 关键注意事项（给开发者）

1. **Prisma + SQLite in Docker**：构建时需运行 `prisma generate`；容器启动时需运行 `prisma migrate deploy`（非 `dev`），确保生产环境迁移正确。

2. **html5-qrcode 仅在 HTTPS 下可用**：本地开发时若需测试扫码，需使用 `ngrok` 等工具创建 HTTPS 隧道，或在真实 VPS 上测试。

3. **Token 存储**：当前方案为内存存储（`Map`），服务重启后所有 token 失效，用户需重新登录。这在单用户个人应用中可接受。若需持久化，可将 token 写入 SQLite（新增 Session 表）。

4. **Next.js 中间件 vs. API Token 验证**：
   - 中间件（`middleware.ts`）用于保护页面路由（重定向到 `/login`），读取 **Cookie** 中的 token
   - API Route 中用 `requireAuth(request)` 函数验证 **Authorization Header** 中的 Bearer Token
   - 前端发送 API 请求时，从 `localStorage` 读取 token 放入 Header；同时在登录成功后也将 token 写入 **Cookie**（供中间件使用）

5. **color_hex 对比度**：在打印标签中，若使用 color_hex 作为背景色，需动态计算文字颜色（黑/白），可使用 luminance 公式：`(R * 299 + G * 587 + B * 114) / 1000 > 128` → 黑字，否则白字。

6. **Logo 访问路径**：`/logos/{filename}` 需通过 API Route 代理读取（`GET /api/logos/[filename]`），因为 `data/` 目录在 Docker Volume 中，不在 Next.js 的 `public/` 目录下。

---

## 下次开始执行的位置

**从 T2-3 继续**：`src/app/api/spools/route.ts`（料卷 API）

已完成文件清单：
```
prisma/schema.prisma
prisma/migrations/20260221072403_init/
data/dev.db
data/logos/
src/lib/db.ts
src/lib/auth.ts
src/lib/api-auth.ts
src/app/api/auth/login/route.ts
src/app/api/catalog/route.ts
src/app/api/catalog/[id]/route.ts
next.config.ts（已更新）
.env（本地开发用）
.env.example
.gitignore（已更新）
```
