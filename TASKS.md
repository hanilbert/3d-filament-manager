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

## Phase 0：项目初始化

### T0-1 初始化 Next.js 项目
- [ ] 使用 `create-next-app` 创建 Next.js 15 项目，启用 TypeScript、Tailwind CSS、App Router
- [ ] 配置 `tsconfig.json` 路径别名（`@/` 指向 `src/`）
- [ ] 安装核心依赖：
  - `prisma` + `@prisma/client`
  - `shadcn/ui`（通过 `npx shadcn@latest init` 初始化）
  - `qrcode.react`（QR 码生成）
  - `html5-qrcode`（QR 码扫描）
  - `formidable`（文件上传处理）
  - `uuid`（UUID 生成）
  - `@types/uuid`、`@types/formidable`

### T0-2 配置环境变量模板
- [ ] 创建 `.env.example` 文件，包含：
  ```
  APP_PASSWORD=your_secret_password_here
  NEXT_PUBLIC_BASE_URL=https://your-domain.com
  DATABASE_URL=file:/app/data/spool_tracker.db
  ```
- [ ] 创建本地开发用 `.env.local`（不提交 Git）
- [ ] 在 `.gitignore` 中确保 `.env.local`、`.env`、`data/` 被忽略

### T0-3 创建项目目录结构
- [ ] 按 PRD 规划创建以下目录（空目录用 `.gitkeep` 占位）：
  ```
  src/app/(auth)/login/
  src/app/api/auth/login/
  src/app/api/catalog/[id]/
  src/app/api/spools/[id]/
  src/app/api/locations/[id]/
  src/app/api/upload/logo/
  src/app/catalog/[id]/edit/
  src/app/catalog/new/
  src/app/spools/
  src/app/spool/[id]/print/
  src/app/locations/
  src/app/location/[id]/print/
  src/components/
  src/lib/
  data/logos/
  ```

---

## Phase 1：数据库与基础设施

### T1-1 编写 Prisma Schema
- [ ] 创建 `prisma/schema.prisma`，定义三张表：
  - **GlobalFilament**：`id`(UUID)、`brand`、`material`、`color_name`、`color_hex`(可选)、`nozzle_temp`、`bed_temp`、`print_speed`、`logo_url`(可选)、`created_at`
  - **Location**：`id`(UUID)、`name`
  - **Spool**：`id`(UUID)、`global_filament_id`(FK)、`location_id`(FK, nullable)、`status`(Enum: ACTIVE/EMPTY)、`metadata`(Json, 可选)、`created_at`
- [ ] 配置 `datasource db` 使用 SQLite，`DATABASE_URL` 从环境变量读取
- [ ] 运行 `npx prisma migrate dev --name init` 生成初始迁移

### T1-2 创建 Prisma 客户端单例
- [ ] 创建 `src/lib/db.ts`，导出全局单例 `prisma` 客户端（防止开发热重载时重复创建连接）

### T1-3 实现认证工具函数
- [ ] 创建 `src/lib/auth.ts`，包含：
  - `generateToken()`：生成随机 UUID v4 作为 token
  - `verifyToken(token: string)`：验证 token 是否有效（对比服务端内存存储或 token 文件）
  - token 存储方案：使用 `Map<string, number>` 内存存储（token → 过期时间戳），服务重启后需重新登录（可接受）
  - token 有效期：7 天（`7 * 24 * 60 * 60 * 1000` ms）
- [ ] 创建 `src/lib/auth-middleware.ts`，提供 `requireAuth(request)` 函数，用于 API Route 中提取并验证 Bearer Token

### T1-4 配置 Logo 静态文件服务
- [ ] 在 `next.config.ts` 中配置 `rewrites` 或使用 Next.js 的静态文件服务，使 `/data/logos/` 目录中的图片可通过 `/logos/{filename}` URL 访问
- [ ] **注意**：`data/` 目录在 Docker 中通过 Volume 挂载，需确保路径映射正确

---

## Phase 2：API 层实现

> 所有 API（除 `/api/auth/login`）均需验证 `Authorization: Bearer {token}` Header。

### T2-1 认证 API
- [ ] **POST `/api/auth/login`**
  - 接收 `{ password: string }`
  - 对比 `process.env.APP_PASSWORD`
  - 匹配则调用 `generateToken()` 存储并返回 `{ token, expiresAt }`
  - 不匹配返回 `401`

### T2-2 全局耗材字典 API

- [ ] **GET `/api/catalog`**
  - 支持 Query 参数：`q`（关键词）、`brand`、`material`
  - 返回 GlobalFilament 列表，含关联的 Spool 数量（`_count.spools`）

- [ ] **POST `/api/catalog`**
  - 接收所有 GlobalFilament 字段（`logo_url`、`color_hex` 可选）
  - 自动生成 `id`（UUID）和 `created_at`
  - 返回创建的记录

- [ ] **GET `/api/catalog/[id]`**
  - 返回单条 GlobalFilament 详情，含关联的 Spool 列表（只含 ACTIVE 状态）

- [ ] **PATCH `/api/catalog/[id]`**
  - 部分更新 GlobalFilament 字段
  - 返回更新后记录

- [ ] **DELETE `/api/catalog/[id]`**
  - 检查是否有关联 Spool，若有则返回 `400` 并提示禁止删除
  - 无关联则删除并返回 `200`

### T2-3 料卷 API

- [ ] **GET `/api/spools`**
  - 支持 Query 参数：`status=ACTIVE|EMPTY`
  - 返回 Spool 列表，含 `globalFilament`（品牌/材质/颜色/color_hex）和 `location`（位置名称）

- [ ] **POST `/api/spools`**
  - 接收 `{ global_filament_id: string }`
  - 自动生成 `id`（UUID）、`status=ACTIVE`、`location_id=null`、`created_at`
  - 返回创建的 Spool 记录

- [ ] **GET `/api/spools/[id]`**
  - 返回单条 Spool 详情，含完整 `globalFilament` 信息和 `location` 信息

- [ ] **PATCH `/api/spools/[id]`**
  - 支持更新字段：`location_id`（修改位置）、`status`（改为 EMPTY）
  - 返回更新后记录

### T2-4 位置 API

- [ ] **GET `/api/locations`**
  - 返回所有 Location，含每个位置的活跃料卷数量（`_count` 或子查询）

- [ ] **POST `/api/locations`**
  - 接收 `{ name: string }`
  - 自动生成 `id`（UUID）
  - 返回创建的 Location

- [ ] **GET `/api/locations/[id]`**
  - 返回 Location 详情，含该位置下所有 `status=ACTIVE` 的 Spool 列表（含 globalFilament 信息）

- [ ] **PATCH `/api/locations/[id]`**
  - 更新 `name` 字段
  - 返回更新后记录

- [ ] **DELETE `/api/locations/[id]`**
  - 将该 Location 下所有 Spool 的 `location_id` 设为 `null`
  - 删除 Location 记录
  - 返回 `200`

### T2-5 文件上传 API

- [ ] **POST `/api/upload/logo`**
  - 使用 `formidable` 解析 multipart/form-data
  - 验证文件类型（仅 `.jpg`、`.png`、`.webp`、`.svg`）和文件大小（≤ 5MB）
  - 将文件保存至 `./data/logos/{uuid}.{ext}`
  - 返回 `{ url: '/logos/{uuid}.{ext}' }`

---

## Phase 3：Next.js 中间件与布局

### T3-1 全局路由鉴权中间件
- [ ] 创建 `src/middleware.ts`
  - 匹配所有路由（除 `/login`、`/api/auth/login`、`/_next/`、`/logos/`）
  - 从 Request Cookie 或 Header 中提取 token（前端通过 API 调用携带，页面路由通过 Cookie）
  - 无效 token 时重定向到 `/login`
  - **页面路由**：检查 Cookie 中的 token；**API 路由**：检查 Authorization Header（由各 API Handler 自行验证）

### T3-2 根布局与导航
- [ ] 创建 `src/app/layout.tsx`，引入全局样式和 Tailwind
- [ ] 创建底部导航栏组件 `src/components/BottomNav.tsx`，包含：
  - 料卷（`/spools`）
  - 字典（`/catalog`）
  - 位置（`/locations`）
  - 当前激活状态高亮

### T3-3 基础 UI 组件

- [ ] **ColorSwatch** (`src/components/ColorSwatch.tsx`)
  - Props: `colorHex?: string`，若有则渲染圆形色块，若无则渲染灰色占位

- [ ] **QRCodeDisplay** (`src/components/QRCodeDisplay.tsx`)
  - 使用 `qrcode.react` 渲染，Props: `value: string`（完整 URL）、`size?: number`

- [ ] **QRScanner** (`src/components/QRScanner.tsx`)
  - 使用 `html5-qrcode` 调起手机后置摄像头
  - Props: `onResult: (decodedText: string) => void`、`onClose: () => void`
  - 解析扫描结果中的 Location UUID（兼容完整 URL 和纯 UUID 两种格式）
  - 扫描成功后自动关闭摄像头

- [ ] **StatusBadge** (`src/components/StatusBadge.tsx`)
  - Props: `status: 'ACTIVE' | 'EMPTY'`，渲染对应颜色标签

- [ ] **ConfirmDialog** (`src/components/ConfirmDialog.tsx`)
  - 通用确认对话框，用于「标记为已用完」操作
  - 使用 shadcn/ui 的 Dialog 或 AlertDialog 组件

---

## Phase 4：页面实现

### T4-1 登录页 `/login`
- [ ] 路径：`src/app/(auth)/login/page.tsx`
- [ ] 单个密码输入框 + 提交按钮
- [ ] 调用 `POST /api/auth/login`，成功后将 token 存入 `localStorage['spool_tracker_token']` 和 Cookie（供中间件使用），跳转到 `/spools`
- [ ] 失败显示"密码错误"提示
- [ ] 页面样式：居中大输入框，移动端友好

### T4-2 料卷列表页 `/spools`
- [ ] 路径：`src/app/spools/page.tsx`
- [ ] 顶部两个 Tab：**使用中 (Active)** / **已归档 (Empty)**
- [ ] 调用 `GET /api/spools?status=ACTIVE|EMPTY` 获取数据
- [ ] 每条卡片展示：
  - 左侧色块（`<ColorSwatch colorHex={...} />`）
  - 品牌 + 材质 + 颜色名
  - 当前位置（无则显示「未分配」）
  - 入库时间
- [ ] 点击卡片跳转到 `/spool/{id}`
- [ ] 右上角浮动按钮：「+ 新增」→ 跳转 `/catalog`（引导用户先找字典）

### T4-3 料卷详情页 `/spool/[id]`
- [ ] 路径：`src/app/spool/[id]/page.tsx`
- [ ] 调用 `GET /api/spools/{id}` 获取数据
- [ ] 页面内容：
  - 品牌 Logo（若有）
  - 颜色大色块（若有 color_hex）
  - 品牌 / 材质 / 颜色名
  - 打印参数：喷嘴温度 / 热床温度 / 打印速度
  - 当前位置（未分配显示「暂未分配位置」）
  - 入库时间
  - 状态标签（`<StatusBadge />`）
- [ ] **ACTIVE 状态**显示三个大按钮（高度 ≥ 48px）：
  - 「修改位置」：展开 `<QRScanner>`，扫描位置码后自动调用 `PATCH /api/spools/{id} { location_id }`，显示成功提示
  - 「打印标签」：跳转 `/spool/{id}/print`
  - 「标记为已用完」：弹出 `<ConfirmDialog>`，确认后调用 `PATCH /api/spools/{id} { status: 'EMPTY' }`，页面刷新
- [ ] **EMPTY 状态**：
  - 顶部显示黄色警告横幅「⚠️ 此耗材已归档（已用完）」
  - 显示「重新入库」按钮：调用 `POST /api/spools { global_filament_id }`，跳转到新 Spool 详情页

### T4-4 料卷标签打印页 `/spool/[id]/print`
- [ ] 路径：`src/app/spool/[id]/print/page.tsx`
- [ ] **无导航栏**（全屏打印布局）
- [ ] CSS `@media print` 设置：`@page { size: 40mm 30mm; margin: 0; }`
- [ ] 布局（参照 PRD 8.2 节）：
  - **左侧 65%**：品牌 Logo（若有）+ 材质名大写加粗；若有 color_hex 则用该颜色作材质名背景色（文字自动对比色）；下方小字：喷嘴温度、热床温度、打印速度、颜色名
  - **右侧 35%**：`<QRCodeDisplay>` 渲染二维码，内容为 `${NEXT_PUBLIC_BASE_URL}/spool/{id}`
- [ ] 调用 `GET /api/spools/{id}` 获取数据
- [ ] 页面加载完成后自动触发 `window.print()`（可选）

### T4-5 全局字典列表页 `/catalog`
- [ ] 路径：`src/app/catalog/page.tsx`
- [ ] 搜索框（关键词搜索品牌/材质/颜色）
- [ ] 品牌、材质筛选 Select 下拉
- [ ] 调用 `GET /api/catalog?q=...&brand=...&material=...`
- [ ] 每条卡片展示：色块（若有）+ 品牌 + 材质 + 颜色名 + 关联料卷数
- [ ] 点击卡片跳转 `/catalog/{id}`
- [ ] 右上角「+ 新建」按钮跳转 `/catalog/new`

### T4-6 新建字典页 `/catalog/new`
- [ ] 路径：`src/app/catalog/new/page.tsx`
- [ ] 表单字段（使用 shadcn/ui Form + React Hook Form）：
  - 品牌（文本，必填）
  - 材质（文本，必填）
  - 颜色名（文本，必填）
  - 颜色 Hex（颜色选择器，选填）
  - 喷嘴温度（文本，必填）
  - 热床温度（文本，必填）
  - 打印速度（文本，必填）
  - Logo 管理（Tab 切换）：
    - 上传图片：文件选择 → 调用 `POST /api/upload/logo` → 将返回的 URL 填入隐藏字段
    - 外部 URL：直接输入 URL
- [ ] 提交调用 `POST /api/catalog`，成功后跳转 `/catalog/{id}`

### T4-7 字典详情页 `/catalog/[id]`
- [ ] 路径：`src/app/catalog/[id]/page.tsx`
- [ ] 调用 `GET /api/catalog/{id}`
- [ ] 展示：Logo、品牌、材质、颜色（含色块）、打印参数
- [ ] 展示该字典关联的活跃料卷列表（含位置）
- [ ] 操作按钮：
  - 「加入我的料卷」：调用 `POST /api/spools { global_filament_id: id }`，跳转到新 Spool 详情页
  - 「编辑」：跳转 `/catalog/{id}/edit`
  - 「删除」（若无关联 Spool 才显示）：调用 `DELETE /api/catalog/{id}`，成功后跳转 `/catalog`

### T4-8 编辑字典页 `/catalog/[id]/edit`
- [ ] 路径：`src/app/catalog/[id]/edit/page.tsx`
- [ ] 与新建页面相同的表单，但预填当前值
- [ ] 提交调用 `PATCH /api/catalog/{id}`，成功后跳转 `/catalog/{id}`

### T4-9 位置列表页 `/locations`
- [ ] 路径：`src/app/locations/page.tsx`
- [ ] 调用 `GET /api/locations` 获取数据
- [ ] 每条卡片展示：位置名称 + 活跃料卷数量
- [ ] 点击卡片跳转 `/location/{id}`
- [ ] 右上角「+ 新建位置」按钮：弹出 Modal 或跳转新页，输入位置名称，调用 `POST /api/locations`

### T4-10 位置详情页 `/location/[id]`
- [ ] 路径：`src/app/location/[id]/page.tsx`
- [ ] 调用 `GET /api/locations/{id}`
- [ ] 展示：位置名称 + 该位置下所有活跃料卷列表（含色块、品牌/材质/颜色名）
- [ ] 操作按钮：
  - 「打印位置标签」：跳转 `/location/{id}/print`
  - 「编辑名称」：内联编辑或弹窗，调用 `PATCH /api/locations/{id}`
  - 「删除位置」：确认后调用 `DELETE /api/locations/{id}`，提示"该位置下料卷的位置将被清空"

### T4-11 位置标签打印页 `/location/[id]/print`
- [ ] 路径：`src/app/location/[id]/print/page.tsx`
- [ ] 无导航栏，`@page { size: 40mm 30mm; margin: 0; }`
- [ ] 布局（参照 PRD 8.3 节）：
  - **左侧**：位置名称（大号加粗字体）
  - **右侧**：`<QRCodeDisplay>` 内容为 `${NEXT_PUBLIC_BASE_URL}/location/{id}`
- [ ] 调用 `GET /api/locations/{id}` 获取数据

---

## Phase 5：Docker 与部署

### T5-1 编写 Dockerfile
- [ ] 使用多阶段构建：
  - **Stage 1 (deps)**：安装依赖
  - **Stage 2 (builder)**：运行 `prisma generate` + `next build`
  - **Stage 3 (runner)**：基于 `node:20-alpine`，仅复制构建产物，设置 `NODE_ENV=production`
- [ ] 暴露端口 `3000`
- [ ] 入口命令：先运行 `prisma migrate deploy`（确保生产环境迁移），再启动 `node server.js`

### T5-2 编写 docker-compose.yml
- [ ] 配置：
  ```yaml
  services:
    app:
      build: .
      ports:
        - "3000:3000"
      volumes:
        - ./data:/app/data
      env_file:
        - .env
      restart: unless-stopped
  ```

### T5-3 Logo 静态服务配置
- [ ] 确认 Docker 容器内 `/app/data/logos/` 路径的访问权限
- [ ] 在 `next.config.ts` 中配置，确保 `/logos/` 路径可以访问 Docker Volume 中的图片文件
- [ ] 方案：使用 Next.js API Route `GET /api/logos/[filename]` 作为代理读取文件（更安全），或配置 Next.js `rewrites`

---

## Phase 6：集成测试与验收

### T6-1 核心工作流端到端测试
- [ ] **Workflow 1**：新建字典 → 上传 Logo → 加入料卷 → 打印标签 → 验证 QR 码 URL 正确
- [ ] **Workflow 2**：扫描料卷码 → 点击修改位置 → 扫描位置码 → 确认位置已更新
- [ ] **Workflow 3**：扫描料卷码 → 查看位置信息正确
- [ ] **Workflow 4**：扫描料卷码 → 标记为已用完 → 确认出现归档警告 → 在 Empty Tab 中出现
- [ ] **Workflow 5**：在 EMPTY 料卷详情页 → 点击重新入库 → 新料卷创建并跳转

### T6-2 移动端兼容性测试
- [ ] 在真实手机浏览器（iOS Safari、Android Chrome）上验证扫码功能（需 HTTPS）
- [ ] 验证所有按钮高度 ≥ 48px，可正常点击
- [ ] 验证打印页在 40×30mm 热敏打印机上输出正常（QR 码清晰可扫）

### T6-3 安全验证
- [ ] 未登录时访问任意页面均重定向到 `/login`
- [ ] Token 过期（7 天后）需重新登录
- [ ] Logo 上传拒绝非法文件类型和超大文件
- [ ] API 无 Token 返回 401

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
T5-x → T6-x
```

---

## 关键注意事项（给开发者）

1. **Prisma + SQLite in Docker**：构建时需运行 `prisma generate`；容器启动时需运行 `prisma migrate deploy`（非 `dev`），确保生产环境迁移正确。

2. **html5-qrcode 仅在 HTTPS 下可用**：本地开发时若需测试扫码，需使用 `ngrok` 等工具创建 HTTPS 隧道，或在真实 VPS 上测试。

3. **Token 存储**：当前方案为内存存储（`Map`），服务重启后所有 token 失效，用户需重新登录。这在单用户个人应用中可接受。若需持久化，可将 token 写入 SQLite（新增 Session 表）。

4. **Next.js 中间件 vs. API Token 验证**：
   - 中间件（`middleware.ts`）用于保护页面路由（重定向到 `/login`），读取 **Cookie** 中的 token
   - API Route 中用 `requireAuth(request)` 函数验证 **Authorization Header** 中的 Bearer Token
   - 前端发送 API 请求时，从 `localStorage` 读取 token 放入 Header；同时在登录成功后也将 token 写入 **httpOnly Cookie**（供中间件使用）

5. **color_hex 对比度**：在打印标签中，若使用 color_hex 作为背景色，需动态计算文字颜色（黑/白）以确保可读性，可使用 luminance 公式：`(R * 299 + G * 587 + B * 114) / 1000 > 128` → 黑字，否则白字。

6. **Logo 访问路径**：`/logos/{filename}` 的静态文件服务需要特别处理，因为 `data/` 目录在 Docker Volume 中，不在 Next.js 的 `public/` 目录下，普通静态文件服务无法直接访问，需要通过 API Route 代理读取。
