# Spool Tracker — 技术架构文档

**版本**: v1.1  
**日期**: 2026-02-23  
**状态**: 与当前代码实现同步

---

## 1. 架构总览

```text
Browser (Mobile/Desktop)
  ├─ UI Routes (Next.js App Router)
  ├─ API Routes (/api/*)
  └─ QR Scan / QR Render

Next.js 16 App
  ├─ middleware.ts (路由鉴权)
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
      catalog
      catalog/[id]
      catalog/brand-rename
      spools
      spools/[id]
      locations
      locations/[id]
      upload/logo
      logos/[filename]
    spools/
    spool/[id]/
    spool/[id]/print/
    catalog/
    locations/
    location/[id]/
    location/[id]/edit/
    location/[id]/print/
  components/
  lib/
  middleware.ts
prisma/
  schema.prisma
  migrations/
```

---

## 3. 数据层

### 3.1 数据模型

- `GlobalFilament`：耗材字典，包含基础字段 + 扩展打印参数
- `Spool`：料卷实例，关联 `GlobalFilament` 与 `Location`
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
- API 路由：`src/lib/api-auth.ts` 校验 Bearer Token

### 4.3 客户端存储

- `localStorage.spool_tracker_token`：供 `apiFetch` 自动注入 Authorization
- Cookie `spool_tracker_token`：供 middleware 拦截页面访问

### 4.4 过期行为

- `apiFetch` 收到 401 会清理本地 Token 和 Cookie，并跳转 `/login`

---

## 5. API 层

### 5.1 接口分组

- `auth`：登录/登出
- `catalog`：字典 CRUD + 分组查询 + 品牌重命名
- `spools`：列表/创建/详情/更新/删除
- `locations`：列表/创建/详情/更新/删除
- `upload/logo` & `logos/[filename]`：Logo 文件上传与读取

### 5.2 鉴权约束

- 公开接口：`/api/auth/login`、`/api/auth/logout`、`/api/logos/*`
- 其余接口要求 Bearer Token

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

### 6.2 Catalog 交互

- 品牌总览：`/catalog`
- 材料总览：`/catalog/materials`
- 支持 300ms debounce 搜索
- 支持品牌/材料分层浏览与聚合统计

### 6.3 Spool 交互

- 详情页可扫码改位置
- `ACTIVE` 和 `EMPTY` 展示不同操作集
- 标签组件支持参数槽位选择并导出 PNG

### 6.4 Location 交互

- 位置按类型分组展示
- `ams_slot` 类型需录入打印机/单元/插槽
- 删除位置后批量解绑关联料卷

---

## 7. 打印与二维码

### 7.1 料卷标签

- 页面：`/spool/{id}/print`
- 组件：`spool-label-printer.tsx`
- 形式：SVG 预览 + `html-to-image` 导出 PNG

### 7.2 位置标签

- 页面：`/location/{id}/print`
- 规格：40mm x 30mm
- 自动调用 `window.print()`

### 7.3 二维码内容

- 料卷：`{NEXT_PUBLIC_BASE_URL}/spool/{id}`
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
2. `is_default` 目前仅标记默认位置，未自动参与新料卷分配。
3. 品牌重命名接口与前端调用方法存在不一致，需统一。
4. SQLite 不适合高并发写入场景。
