# Spool Tracker — 技术架构文档

**版本**: v1.0
**状态**: 与 MVP 实现保持同步

---

## 目录

1. [整体架构概览](#1-整体架构概览)
2. [目录结构](#2-目录结构)
3. [数据层](#3-数据层)
4. [认证与鉴权层](#4-认证与鉴权层)
5. [API 层](#5-api-层)
6. [前端层](#6-前端层)
7. [关键技术决策](#7-关键技术决策)
8. [已知限制与后续改进方向](#8-已知限制与后续改进方向)

---

## 1. 整体架构概览

```
┌─────────────────────────────────────────────────────┐
│                    Docker Container                  │
│                                                     │
│  ┌────────────────────────────────────────────────┐ │
│  │              Next.js 16 App                    │ │
│  │                                                │ │
│  │  ┌──────────────┐    ┌────────────────────┐   │ │
│  │  │   src/proxy  │    │   API Routes       │   │ │
│  │  │  (路由鉴权)   │    │  /api/auth/login   │   │ │
│  │  │   Cookie     │    │  /api/catalog      │   │ │
│  │  │   校验       │    │  /api/spools       │   │ │
│  │  └──────────────┘    │  /api/locations    │   │ │
│  │                      │  /api/upload/logo  │   │ │
│  │  ┌──────────────┐    │  /api/logos/[file] │   │ │
│  │  │   Pages      │    └────────┬───────────┘   │ │
│  │  │  /spools     │             │               │ │
│  │  │  /catalog    │    ┌────────▼───────────┐   │ │
│  │  │  /locations  │    │   Prisma Client    │   │ │
│  │  │  /login      │    │   (SQLite ORM)     │   │ │
│  │  └──────────────┘    └────────┬───────────┘   │ │
│  └──────────────────────────────┼────────────────┘ │
│                                 │                   │
│  ┌──────────────────────────────▼────────────────┐ │
│  │           Docker Volume: ./data               │ │
│  │   spool_tracker.db  │  logos/                 │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         ↑
    Nginx (用户自行配置，HTTPS + 反向代理)
         ↑
    公网 VPS
```

---

## 2. 目录结构

```
3d-filament-manager/
├── prisma/
│   ├── schema.prisma              # 数据库 Schema 定义
│   └── migrations/                # Prisma 迁移文件
│       └── 20260221072403_init/
├── src/
│   ├── app/
│   │   ├── (auth)/                # 无底部导航的布局组
│   │   │   ├── layout.tsx         # 空布局（无 BottomNav）
│   │   │   └── login/
│   │   │       └── page.tsx       # 登录页
│   │   ├── api/
│   │   │   ├── auth/login/        # POST /api/auth/login
│   │   │   ├── catalog/           # GET/POST /api/catalog
│   │   │   │   └── [id]/          # GET/PATCH/DELETE /api/catalog/{id}
│   │   │   ├── spools/            # GET/POST /api/spools
│   │   │   │   └── [id]/          # GET/PATCH /api/spools/{id}
│   │   │   ├── locations/         # GET/POST /api/locations
│   │   │   │   └── [id]/          # GET/PATCH/DELETE /api/locations/{id}
│   │   │   ├── upload/logo/       # POST /api/upload/logo
│   │   │   └── logos/[filename]/  # GET /api/logos/{filename}
│   │   ├── catalog/               # 全局字典页面
│   │   │   ├── page.tsx           # 列表
│   │   │   ├── new/page.tsx       # 新建
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # 详情
│   │   │       └── edit/page.tsx  # 编辑
│   │   ├── spools/
│   │   │   └── page.tsx           # 料卷列表（Active/Empty Tab）
│   │   ├── spool/
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # 料卷详情页
│   │   │       └── print/page.tsx # 标签打印页
│   │   ├── locations/
│   │   │   └── page.tsx           # 位置列表
│   │   ├── location/
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # 位置详情页
│   │   │       └── print/page.tsx # 位置标签打印页
│   │   ├── layout.tsx             # 根布局（含 ConditionalNav）
│   │   └── page.tsx               # 重定向到 /spools
│   ├── components/
│   │   ├── BottomNav.tsx          # 底部三标签导航
│   │   ├── CatalogForm.tsx        # 新建/编辑字典共用表单
│   │   ├── ColorSwatch.tsx        # 颜色色块组件
│   │   ├── ConfirmDialog.tsx      # 确认弹窗（AlertDialog 封装）
│   │   ├── ConditionalNav.tsx     # 条件渲染导航（login/print 页隐藏）
│   │   ├── QRCodeDisplay.tsx      # 二维码显示组件
│   │   ├── QRScanner.tsx          # 二维码扫描组件（动态导入）
│   │   └── StatusBadge.tsx        # 状态徽章（ACTIVE/EMPTY）
│   ├── lib/
│   │   ├── api-auth.ts            # requireAuth() 供 API Route 使用
│   │   ├── auth.ts                # generateToken() / verifyToken()
│   │   ├── db.ts                  # Prisma 客户端单例
│   │   └── fetch.ts               # apiFetch<T> 封装（自动注入 Token）
│   └── proxy.ts                   # Next.js 16 路由鉴权中间件
├── data/                          # Docker Volume 挂载点（不提交 Git）
│   ├── dev.db                     # 本地开发 SQLite
│   └── logos/                     # 上传的品牌 Logo 图片
├── docs/                          # 项目文档
├── Dockerfile                     # 多阶段构建
├── docker-compose.yml
├── .env.example
├── next.config.ts
├── prisma.config.ts
└── package.json
```

---

## 3. 数据层

### 3.1 Prisma Schema

三张核心表：`GlobalFilament`、`Location`、`Spool`

关键设计决策：
- 所有主键使用 UUID（`@default(uuid())`），便于二维码追踪
- `Spool.metadata` 使用 `String?` 存储 JSON 字符串，保留扩展性
- `Spool.status` 使用 `String`（而非 Enum），值约定为 `"ACTIVE"` / `"EMPTY"`

### 3.2 Prisma 客户端单例（`src/lib/db.ts`）

使用 `globalThis` 模式防止 Next.js 开发时热重载造成连接泄漏：

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 3.3 数据库文件路径

| 环境 | 路径 |
|------|------|
| 本地开发 | `file:./data/dev.db` |
| Docker 生产 | `file:/app/data/spool_tracker.db` |

通过 `DATABASE_URL` 环境变量配置，Prisma 通过 `prisma.config.ts` 读取。

---

## 4. 认证与鉴权层

### 4.1 双 Token 存储机制

系统使用两种存储方式，各司其职：

| 存储位置 | 用途 | 使用方 |
|----------|------|--------|
| `localStorage['spool_tracker_token']` | API 请求 Authorization Header | 前端 `apiFetch` |
| Cookie `spool_tracker_token` | 页面路由鉴权 | `src/proxy.ts` |

登录成功后，两处同时写入 Token，保持一致。

### 4.2 Token 存储（`src/lib/auth.ts`）

Token 存储在内存 `Map<string, number>` 中（token → 过期时间戳），服务重启后失效。

```typescript
const tokens = new Map<string, number>()

export function generateToken(): string {
  const token = uuidv4()
  tokens.set(token, Date.now() + 7 * 24 * 60 * 60 * 1000)
  return token
}

export function verifyToken(token: string): boolean {
  const exp = tokens.get(token)
  return exp !== undefined && Date.now() < exp
}
```

### 4.3 路由鉴权（`src/proxy.ts`）

Next.js 16 中间件约定，放行路径：
- `/login`、`/api/auth/login`（公开）
- `/_next/`、`/favicon`（静态资源）
- `/api/logos/`（Logo 图片静态服务）

### 4.4 API 鉴权（`src/lib/api-auth.ts`）

```typescript
export function requireAuth(request: Request): Response | null {
  const token = extractBearerToken(request)
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
```

---

## 5. API 层

### 5.1 统一模式

所有受保护 API Route 的处理模式：

```typescript
export async function GET(request: Request) {
  const authError = requireAuth(request)
  if (authError) return authError

  // 业务逻辑
  const data = await prisma.xxx.findMany(...)
  return NextResponse.json(data)
}
```

### 5.2 Logo 文件服务

Logo 存储在 Docker Volume（`/app/data/logos/`）中，不在 `public/` 目录，因此通过 API Route 代理访问：

```
POST /api/upload/logo  → 接收 FormData，UUID 重命名，存到 data/logos/
GET  /api/logos/{filename}  → basename() 防路径穿越，读取文件返回
```

---

## 6. 前端层

### 6.1 客户端请求工具（`src/lib/fetch.ts`）

```typescript
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('spool_tracker_token')
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
}
```

### 6.2 关键组件

| 组件 | 说明 |
|------|------|
| `QRScanner` | 动态导入 `html5-qrcode`（避免 SSR 报错），使用后置摄像头 |
| `QRCodeDisplay` | 使用 `qrcode.react` 的 `QRCodeSVG` 渲染，适合打印 |
| `ColorSwatch` | 支持 sm/md/lg 尺寸，有 hex 则渲染实际颜色 |
| `ConditionalNav` | 在 `/login` 和 `**/print` 路径下隐藏底部导航 |
| `CatalogForm` | 新建/编辑字典共用，Logo Tab 切换（上传文件/外部URL）|

### 6.3 打印页实现

打印页使用服务端组件（直接读 Prisma），CSS `@page` 规则控制纸张尺寸：

```css
@page { size: 40mm 30mm; margin: 0; }
body { width: 40mm; height: 30mm; }
```

位置标签打印页加载后自动触发 `window.print()`。

---

## 7. 关键技术决策

### 7.1 Next.js 16 特殊约定

| 变更点 | 说明 |
|--------|------|
| 中间件文件名 | `src/proxy.ts`（非 `middleware.ts`），导出函数名 `proxy` |
| Viewport 元数据 | 从 `metadata` 对象中分离，单独 `export const viewport: Viewport` |
| Server Actions 大小限制 | `next.config.ts` 中配置 `serverActions.bodySizeLimit = "10mb"` |

### 7.2 html5-qrcode 仅 HTTPS 可用

H5 Camera API 要求 HTTPS 环境。本地开发测试扫码需通过 `ngrok` 等工具创建 HTTPS 隧道。

### 7.3 Color Hex 对比度计算

标签打印时动态计算文字颜色（黑/白）：

```typescript
function getTextColor(hex: string): 'black' | 'white' {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? 'black' : 'white'
}
```

---

## 8. 已知限制与后续改进方向

| 限制 | 现状 | 改进方向 |
|------|------|----------|
| Token 内存存储 | 服务重启后所有用户需重新登录 | 新增 Session 表写入 SQLite |
| 单用户设计 | 共享同一密码，无法区分用户 | 重新设计鉴权，引入用户表 |
| 无统计/报表 | 无耗材用量统计 | 基于 `Spool.metadata` 扩展 |
| 无批量操作 | 每次只能操作单个料卷 | 考虑批量入库/批量归档 |
| QR 扫描仅 HTTPS | 本地开发无法测试扫码 | 考虑手动输入 UUID 作为备选 |
