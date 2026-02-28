# Spool Tracker — 技术架构文档

**版本**: v1.2
**日期**: 2026-02-28
**状态**: 与当前代码实现同步

---

## 1. 架构总览

```text
Browser (Mobile/Desktop)
  ├─ UI Routes (Next.js App Router)
  ├─ API Routes (/api/*)
  └─ QR Scan / QR Render

Next.js 16 App
  ├─ src/middleware.ts (路由鉴权)
  ├─ src/app/* (页面与 API)
  ├─ src/lib/auth.ts (Token 生成/校验)
  ├─ src/lib/api-auth.ts (API 认证守卫)
  └─ Prisma Client

SQLite + Files
  ├─ data/spool_tracker.db
  └─ data/logos/*
```

---

## 2. 代码结构

```text
src/
  app/
    (auth)/login/
    api/
      auth/login
      auth/logout
      filaments
      filaments/[id]
      filaments/brand-rename
      spools
      spools/[id]
      locations
      locations/[id]
      upload/logo
      logos/[filename]
    filaments/
    spools/
    locations/
    location/[id]/
    location/[id]/edit/
    location/[id]/print/
  components/
  lib/
prisma/
  schema.prisma
  migrations/
```

---

## 3. 数据层

### 3.1 数据模型

- `Filament`：耗材字典（SPU）
- `Spool`：料卷实例（SKU），关联 `Filament` 与 `Location`
- `Location`：位置实体，支持 `type/is_default/ams_*`

### 3.2 状态设计

- `SpoolStatus` 为 Prisma Enum：`ACTIVE`、`EMPTY`
- 重新入库策略：创建新的 `Spool` 记录，不复用旧记录

### 3.3 数据库

- 开发：`file:./data/dev.db`
- 生产：`file:/app/data/spool_tracker.db`

---

## 4. 认证与鉴权

### 4.1 Token 机制

- 登录后签发 HMAC-SHA256 签名 Token
- payload 含 `iat` 与 `exp`（7 天 TTL）
- Secret 来源：`TOKEN_SECRET`，未设置时回退 `APP_PASSWORD`

### 4.2 双通道鉴权

- 页面路由：`src/middleware.ts` 从 Cookie 校验 `spool_tracker_token`
- API 路由：`src/lib/api-auth.ts` 优先校验 Bearer Token，缺失时回退 Cookie

### 4.3 客户端存储

- 使用 HttpOnly Cookie `spool_tracker_token`
- `apiFetch` 使用 `credentials: "same-origin"` 自动携带 Cookie

### 4.4 过期行为

- `apiFetch` 收到 401 时跳转 `/login`

---

## 5. API 层

### 5.1 接口分组

- `auth`：登录/登出
- `filaments`：字典 CRUD + 分组查询 + 品牌重命名
- `spools`：列表/创建/详情/更新/删除
- `locations`：列表/创建/详情/更新/删除
- `upload/logo` & `logos/[filename]`：Logo 文件上传与读取

### 5.2 鉴权约束

- 公开接口：`/api/auth/login`、`/api/auth/logout`、`/api/logos/*`
- 其余接口要求有效 token

### 5.3 文件上传策略

- 支持类型：`jpg/png/webp/svg`
- 大小限制：`<= 5MB`
- 存储路径：`data/logos`
- 读取时使用 `basename()` 防路径穿越

---

## 6. 前端层

### 6.1 导航策略

- 移动端：`BottomNav`
- 桌面端：`SideNav`
- 在 `/login` 与 `*/print` 页面隐藏导航

### 6.2 Filament 交互

- 品牌总览：`/filaments`
- 材料总览：`/filaments/materials`
- 支持搜索、分层浏览与聚合统计

### 6.3 Spool 交互

- 列表页按 Filament 聚合展示
- 详情页可扫码改位置
- `ACTIVE` 和 `EMPTY` 展示不同操作集
- 保留兼容路由 `/spools/details/[id]`，内部重定向到 `/filaments/[id]`

### 6.4 Location 交互

- 位置按类型分组展示
- `ams_slot` 类型需录入打印机/单元/插槽
- 删除位置后批量解绑关联料卷

---

## 7. 打印与二维码

### 7.1 料卷标签

- 页面：`/spools/[id]/print`
- 组件：`spool-label-printer.tsx`
- 形式：SVG 预览 + `html-to-image` 导出 PNG

### 7.2 位置标签

- 页面：`/location/[id]/print`
- 规格：40mm x 30mm
- 自动调用 `window.print()`

### 7.3 二维码内容

- 料卷：`{NEXT_PUBLIC_BASE_URL}/spools/{id}`
- 位置：`{NEXT_PUBLIC_BASE_URL}/location/{id}`

---

## 8. 部署与运行

- 构建：Docker 多阶段构建
- 启动：`prisma migrate deploy && node server.js`
- 持久化：挂载 `./data:/app/data`
- 健康检查：访问 `/login`

---

## 9. 已知限制与后续方向

1. 单密码模式，不含多用户与权限控制。
2. `is_default` 当前仅标记默认位置，未自动参与新料卷分配。
3. SQLite 不适合高并发写入场景。
