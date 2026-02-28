# Spool Tracker — 3D 打印耗材位置与生命周期管理系统
## 产品需求文档（PRD）

**版本**: v1.2（实现对齐版）
**日期**: 2026-02-28
**状态**: MVP+（核心功能已落地）

---

## 1. 项目概述

### 1.1 产品定位

Spool Tracker 是一个面向个人/小团队的 3D 打印耗材管理 Web 应用，核心目标是：

- 用二维码把实物料卷与系统记录绑定
- 用位置管理减少找料时间
- 用状态流转管理耗材生命周期（ACTIVE / EMPTY / 重新入库）
- 在移动端快速完成高频操作（扫码、改位置、归档）

### 1.2 设计原则

- 移动端优先，桌面端补充效率视图
- 单密码鉴权，低运维成本
- SQLite + Docker，自托管友好
- 数据模型可扩展，兼容后续参数扩充

---

## 2. 目标用户与典型场景

### 2.1 目标用户

- 具有多品牌、多材料、多颜色耗材库存的 3D 打印用户
- 需要管理 AMS 插槽、货架、防潮箱等多个存放点的用户

### 2.2 典型场景

| 场景 | 当前支持情况 |
|---|---|
| 新耗材入库 | 已支持：建字典项 -> 加入料卷 -> 生成标签预览 |
| 料卷位置变更 | 已支持：扫码位置二维码 -> PATCH 更新 `location_id` |
| 快速查找耗材 | 已支持：通过料卷二维码进入详情查看当前位置 |
| 耗材归档与复购 | 已支持：标记 EMPTY -> 再次入库创建新 ACTIVE 料卷 |
| 位置标签维护 | 已支持：位置新建/编辑/删除 + 标签打印 |

---

## 3. 当前版本范围（与代码实现对齐）

### 3.1 已实现能力

1. 鉴权系统（登录、登出、路由/API 鉴权）
2. 耗材字典管理（新增/编辑/详情/删除）
3. 品牌与材料分层浏览（品牌页、材料页、子材料页）
4. 料卷管理（ACTIVE/EMPTY 列表、详情、归档、重新入库、删除）
5. 扫码改位置（识别 `/location/{id}` URL 或纯 UUID）
6. 位置管理（类型化位置、AMS 插槽字段、默认位置标记、删除解绑）
7. 标签能力
   - 料卷标签：参数可配置预览 + PNG 下载
   - 位置标签：40x30mm 打印页 + 自动触发打印
8. 品牌 Logo 上传/读取（MIME 校验、大小限制、防路径穿越）

### 3.2 已知限制（截至 2026-02-28）

1. `is_default` 仅用于标记默认位置，当前新建料卷不会自动分配到默认位置。
2. 料卷打印页当前形态是“标签编辑器 + 图片下载”，不是固定版式的一键热敏打印页。
3. 单密码模式不包含多用户体系。

---

## 4. 核心业务模型

### 4.1 实体关系

```text
Filament（耗材字典/SPU）
  └── Spool（我的料卷/SKU）
        └── Location（物理位置）
```

### 4.2 生命周期

```text
创建 Spool -> ACTIVE -> EMPTY
                 ↑
           重新入库（创建新 Spool）
```

### 4.3 二维码语义

- 料卷码：`{BASE_URL}/spools/{spoolId}`
- 位置码：`{BASE_URL}/location/{locationId}`

---

## 5. 数据模型（Prisma Schema 对齐）

数据库：SQLite（通过 Prisma 管理）

### 5.1 Filament

- 必填：`id`、`brand`、`material`、`color_name`、`created_at`、`updated_at`
- 可选：`variant`、`upc_gtin`、`color_hex`、`nozzle_temp`、`bed_temp`、`print_speed`、`logo_url`
- 扩展：技术参数、风扇/速度参数、干燥参数、兼容性参数等

### 5.2 Location

- `id`、`name`
- `type`（`custom|shelf|printer|ams_slot|dryer`）
- `is_default`
- AMS 字段：`printer_name`、`ams_unit`、`ams_slot`
- `created_at`、`updated_at`

### 5.3 Spool

- `id`
- `filament_id`（FK）
- `location_id`（FK，可空）
- `status`：`ACTIVE` / `EMPTY`
- `metadata`（字符串扩展字段）
- `created_at`、`updated_at`

---

## 6. 功能模块说明

### 6.1 模块 A：访问鉴权

- 登录页：`/login`
- 登录接口：`POST /api/auth/login`
- 登出接口：`POST /api/auth/logout`
- Token 存储：HttpOnly Cookie
- 鉴权链路：
  - `middleware.ts` 负责路由级拦截
  - `requireAuth()` 负责 API token 校验

### 6.2 模块 B：耗材字典（Filaments）

- 路由：`/filaments`、`/filaments/materials`、`/filaments/brand/{brand}`、`/filaments/material/{material}`
- 能力：新建、编辑、详情、删除、按品牌/材料分组浏览、从字典项创建料卷
- 搜索：支持品牌/材料/颜色关键词与 UPC/GTIN

### 6.3 模块 C：料卷管理（Spools）

- 列表页：`/spools`（ACTIVE / EMPTY）
- 详情页：`/spools/{id}`
- 打印页：`/spools/{id}/print`
- 操作：扫码改位置、归档、重新入库、删除
- 兼容路由：`/spools/details/{filamentId}` 会重定向到 `/filaments/{filamentId}`

### 6.4 模块 D：位置管理（Locations）

- 列表：`/locations`
- 新建：`/locations/new`
- 详情：`/location/{id}`
- 编辑：`/location/{id}/edit`
- 打印：`/location/{id}/print`

---

## 7. 页面路由（当前实现）

| 路由 | 说明 |
|---|---|
| `/` | 首页 |
| `/login` | 登录页 |
| `/spools` | 料卷列表 |
| `/spools/{id}` | 料卷详情 |
| `/spools/{id}/print` | 料卷标签页 |
| `/filaments` | 品牌总览 |
| `/filaments/materials` | 材料总览 |
| `/filaments/new` | 新建耗材 |
| `/filaments/{id}` | 耗材详情 |
| `/filaments/{id}/edit` | 编辑耗材 |
| `/filaments/brand/{brand}` | 品牌详情 |
| `/filaments/material/{material}` | 材料详情 |
| `/locations` | 位置列表 |
| `/locations/new` | 新建位置 |
| `/location/{id}` | 位置详情 |
| `/location/{id}/edit` | 编辑位置 |
| `/location/{id}/print` | 位置标签打印页 |

---

## 8. API 设计（当前实现）

> 除登录/登出与 Logo 读取外，其余接口需要有效 token。

### 8.1 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/login` | 密码登录，返回过期时间 |
| `POST` | `/api/auth/logout` | 登出 |

### 8.2 Filaments

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/filaments` | 列表/搜索/分组 |
| `POST` | `/api/filaments` | 新建 |
| `GET` | `/api/filaments/{id}` | 详情（含 spools） |
| `PATCH` | `/api/filaments/{id}` | 更新 |
| `DELETE` | `/api/filaments/{id}` | 删除（有关联 spool 则拒绝） |
| `PATCH` | `/api/filaments/brand-rename` | 批量改品牌名 |

### 8.3 Spools

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/spools` | 列表（支持 `status` 过滤） |
| `POST` | `/api/spools` | 创建料卷（`filament_id`） |
| `GET` | `/api/spools/{id}` | 详情 |
| `PATCH` | `/api/spools/{id}` | 更新（`location_id/status/metadata`） |
| `DELETE` | `/api/spools/{id}` | 删除 |

### 8.4 Locations

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/locations` | 列表 |
| `POST` | `/api/locations` | 新建 |
| `GET` | `/api/locations/{id}` | 详情 |
| `PATCH` | `/api/locations/{id}` | 更新 |
| `DELETE` | `/api/locations/{id}` | 删除并解绑 spools |

### 8.5 文件

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/upload/logo` | Logo 上传 |
| `GET` | `/api/logos/{filename}` | 读取 Logo 文件 |

---

## 9. 技术栈

| 层级 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| ORM | Prisma |
| 数据库 | SQLite |
| 二维码 | `qrcode.react` |
| 扫码 | `html5-qrcode` |
| 标签导出 | `html-to-image` |
| 部署 | Docker + docker-compose |

---

## 10. 部署与配置

### 10.1 环境变量

| 变量 | 说明 |
|---|---|
| `APP_PASSWORD` | 登录密码 |
| `NEXT_PUBLIC_BASE_URL` | 二维码基地址 |
| `DATABASE_URL` | SQLite 路径 |
| `TOKEN_SECRET` | 可选签名密钥 |

### 10.2 部署特性

- 启动执行 `prisma migrate deploy`
- `./data` 卷持久化数据库和 Logo
- 内置健康检查

---

## 11. 非功能性需求与约束

1. 移动端高频链路（扫码、改位置）优先保证易用性。
2. SQLite 面向个人/小规模并发场景。
3. 浏览器扫码依赖 HTTPS 或 localhost。
