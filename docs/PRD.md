# Spool Tracker — 3D 打印耗材位置与生命周期管理系统
## 产品需求文档（PRD）

**版本**: v1.1（实现对齐版）  
**日期**: 2026-02-23  
**状态**: MVP+（核心功能已落地，含少量已知差异）

---

## 1. 项目概述

### 1.1 产品定位

Spool Tracker 是一个面向个人/小团队的 3D 打印耗材管理 Web 应用，核心目标是：

- 用二维码把“实物料卷”和“系统记录”绑定
- 用位置管理减少找料时间
- 用状态流转管理耗材生命周期（使用中/已归档/重新入库）
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
3. 品牌与材料分层浏览（品牌页、材料大类页、子材料页）
4. 料卷管理（ACTIVE/EMPTY 列表、详情、归档、重新入库、删除）
5. 扫码改位置（识别 `/location/{id}` URL 或纯 UUID）
6. 位置管理（类型化位置、AMS 插槽字段、默认位置标记、删除解绑）
7. 标签能力
   - 料卷标签：参数可配置预览 + PNG 下载
   - 位置标签：40x30mm 打印页 + 自动触发打印
8. 品牌 Logo 上传/读取（MIME 校验、大小限制、防路径穿越）

### 3.2 已知差异/限制（截至 2026-02-23）

1. `is_default` 仅用于标记默认位置，当前新建料卷不会自动分配到默认位置。
2. 品牌重命名后端接口当前导出为 `POST /api/catalog/brand-rename`，品牌页前端调用方法与其不完全一致，属于待修复项。
3. 料卷打印页当前形态是“标签编辑器 + 图片下载”，不是固定版式的一键热敏打印页。

---

## 4. 核心业务模型

### 4.1 实体关系

```text
GlobalFilament（耗材字典/SPU）
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

- 料卷码：`{BASE_URL}/spool/{spoolId}`
- 位置码：`{BASE_URL}/location/{locationId}`

---

## 5. 数据模型（Prisma Schema 对齐）

数据库：SQLite（通过 Prisma 管理）

### 5.1 GlobalFilament

#### 必填字段

- `id` (UUID)
- `brand`
- `material`
- `color_name`
- `created_at`
- `updated_at`

#### 核心可选字段

- `material_type`
- `color_hex`
- `nozzle_temp`
- `bed_temp`
- `print_speed`
- `logo_url`

#### 扩展参数（均为可选）

- 技术参数：`density`、`diameter`、`nominal_weight`、`softening_temp`、`chamber_temp`、`shrinkage`、`empty_spool_weight`、`pressure_advance`
- 熨烫/风扇：`ironing_flow`、`ironing_speed`、`fan_min`、`fan_max`
- 分层速度：`first_layer_*`、`other_layers_*`
- 颜色数据：`measured_rgb`、`top_voted_td`、`num_td_votes`
- 流量特性：`max_volumetric_speed`、`flow_ratio`
- 干燥信息：`drying_temp`、`dry_time`
- 兼容性：`ams_compatibility`、`build_plates`

### 5.2 Location

- `id` (UUID)
- `name`
- `type`（默认 `custom`，支持 `shelf`/`printer`/`ams_slot`/`dryer`）
- `is_default`（默认 `false`）
- AMS 字段：`printer_name`、`ams_unit`、`ams_slot`
- `created_at`、`updated_at`

### 5.3 Spool

- `id` (UUID)
- `global_filament_id`（FK）
- `location_id`（FK，可空）
- `status`：`ACTIVE` / `EMPTY`
- `metadata`（当前类型为 `String?`，用于扩展）
- `created_at`、`updated_at`

---

## 6. 功能模块说明

### 6.1 模块 A：访问鉴权

- 登录页：`/login`
- 登录接口：`POST /api/auth/login`（密码校验后返回 token + expiresAt）
- 登出接口：`POST /api/auth/logout`（清空 Cookie）
- Token 存储：`localStorage` + Cookie 双写
- 鉴权链路：
  - `middleware.ts` 负责路由级拦截
  - `requireAuth()` 负责 API Bearer Token 校验

### 6.2 模块 B：耗材字典（Catalog）

#### 主要能力

1. 新建/编辑字典项（支持大量参数、Logo 上传）
2. 详情页查看参数分组与关联 ACTIVE 料卷
3. 删除字典项（若有关联 Spool 则阻止）
4. 从字典项创建料卷（加入我的料卷）
5. 浏览视图：
   - 品牌总览（`/catalog`）
   - 材料总览（`/catalog/materials`）
   - 品牌详情（`/catalog/brand/{brand}`）
   - 材料大类详情（`/catalog/material-type/{type}`）
   - 子材料详情（`/catalog/material/{material}`）
6. 搜索：品牌/材料/颜色关键字（300ms debounce）

### 6.3 模块 C：料卷管理（Spools）

#### 列表页

- 路由：`/spools`
- 双 Tab：`ACTIVE` / `EMPTY`
- 展示：颜色、品牌/材料、位置、入库日期

#### 详情页

- 路由：`/spool/{id}`
- `ACTIVE` 操作：
  - 修改位置（扫码）
  - 标签预览（可下载 PNG）
  - 标记为已用完
  - 删除料卷
- `EMPTY` 操作：
  - 重新入库（创建新 Spool）
  - 删除料卷

#### 扫码规则

- 支持扫描内容：
  - 完整 URL：`.../location/{uuid}`
  - 纯 UUID
- 更新方式：`PATCH /api/spools/{id}` 写入 `location_id`

### 6.4 模块 D：位置管理（Locations）

#### 列表与详情

- 列表：`/locations`（按类型分组展示）
- 新建：`/locations/new`
- 详情：`/location/{id}`
- 编辑：`/location/{id}/edit`

#### 位置类型

- `shelf`（货架）
- `printer`（打印机）
- `ams_slot`（AMS 插槽）
- `dryer`（干燥机）
- `custom`（自定义）

#### 关键规则

- `ams_slot` 类型要求 `printer_name` + `ams_unit` + `ams_slot`
- 删除位置时，不删除料卷，只将对应 `Spool.location_id` 批量置空

### 6.5 模块 E：标签与打印

#### 料卷标签

- 页面：`/spool/{id}/print`（可复用详情页内同款标签组件）
- 形态：参数槽位可配置 + 二维码 + PNG 下载

#### 位置标签

- 页面：`/location/{id}/print`
- 规格：40mm × 30mm
- 行为：页面加载后自动触发 `window.print()`

---

## 7. 页面路由（当前实现）

| 路由 | 说明 |
|---|---|
| `/` | 重定向到 `/spools` |
| `/login` | 登录页 |
| `/spools` | 料卷列表 |
| `/spool/{id}` | 料卷详情 |
| `/spool/{id}/print` | 料卷标签页 |
| `/catalog` | 品牌总览 |
| `/catalog/materials` | 材料总览 |
| `/catalog/new` | 新建耗材 |
| `/catalog/{id}` | 耗材详情 |
| `/catalog/{id}/edit` | 编辑耗材 |
| `/catalog/brand/{brand}` | 品牌详情 |
| `/catalog/material-type/{type}` | 材料大类详情 |
| `/catalog/material/{material}` | 子材料详情 |
| `/locations` | 位置列表 |
| `/locations/new` | 新建位置 |
| `/location/{id}` | 位置详情 |
| `/location/{id}/edit` | 编辑位置 |
| `/location/{id}/print` | 位置标签打印页 |

---

## 8. API 设计（当前实现）

> 除登录/登出与 Logo 读取外，受保护接口需要 `Authorization: Bearer {token}`。

### 8.1 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/login` | 密码登录，返回 token |
| `POST` | `/api/auth/logout` | 登出（清空 cookie） |

### 8.2 Catalog

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/catalog` | 列表/搜索/分组（`groupBy`） |
| `POST` | `/api/catalog` | 新建 |
| `GET` | `/api/catalog/{id}` | 详情（含 ACTIVE spools） |
| `PATCH` | `/api/catalog/{id}` | 更新 |
| `DELETE` | `/api/catalog/{id}` | 删除（有关联 spool 则拒绝） |
| `POST` | `/api/catalog/brand-rename` | 批量改品牌名 |

`/api/catalog` 支持参数：

- 过滤：`q`、`brand`、`material`、`materialType`
- 分组：`groupBy=brandList|brand|material|materialType`

### 8.3 Spools

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/spools` | 列表（可按 `status` 过滤） |
| `POST` | `/api/spools` | 创建料卷（`global_filament_id`） |
| `GET` | `/api/spools/{id}` | 详情 |
| `PATCH` | `/api/spools/{id}` | 更新（`location_id/status/metadata`） |
| `DELETE` | `/api/spools/{id}` | 删除料卷 |

### 8.4 Locations

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/locations` | 列表（含 ACTIVE spool 计数） |
| `POST` | `/api/locations` | 新建位置 |
| `GET` | `/api/locations/{id}` | 详情（含 ACTIVE spools） |
| `PATCH` | `/api/locations/{id}` | 更新 |
| `DELETE` | `/api/locations/{id}` | 删除并解绑 spools |

### 8.5 文件

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/upload/logo` | Logo 上传（仅 jpg/png/webp/svg，<=5MB） |
| `GET` | `/api/logos/{filename}` | 读取 Logo 文件 |

---

## 9. 技术栈

| 层级 | 选型 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 运行时 | React 19 |
| UI | Tailwind CSS v4 + shadcn/ui |
| ORM | Prisma |
| 数据库 | SQLite |
| 二维码 | `qrcode.react` |
| 扫码 | `html5-qrcode` |
| 标签导出 | `html-to-image` |
| 鉴权签名 | Node `crypto` HMAC |
| 部署 | Docker + docker-compose |

---

## 10. 部署与配置

### 10.1 环境变量

| 变量 | 说明 |
|---|---|
| `APP_PASSWORD` | 登录密码（必填） |
| `NEXT_PUBLIC_BASE_URL` | 生成二维码链接的基础域名 |
| `DATABASE_URL` | SQLite 路径 |
| `TOKEN_SECRET` | 可选；未配置时回退使用 `APP_PASSWORD` 进行 token 签名 |

### 10.2 部署特性

- 容器启动命令会执行 `prisma migrate deploy`
- `./data` 卷持久化数据库和 Logo 文件
- 内置健康检查

---

## 11. 非功能性需求与约束

### 11.1 性能目标

- 常用列表与详情接口保持低延迟（小型数据集场景）
- 移动端操作链路尽量控制在少跳转、少输入

### 11.2 安全要求

- API 强制 Bearer Token 校验
- 上传严格限制 MIME 类型与大小
- 文件读取路径防穿越

### 11.3 当前约束

1. 单用户密码模式，不含用户体系与权限分级。
2. SQLite 适合个人/小规模并发，不适合高并发写入场景。
3. 浏览器扫码依赖 HTTPS 或 localhost。

---

## 12. MVP 范围外（后续阶段）

1. 多用户与权限模型
2. 默认位置自动分配策略落地
3. 料卷消耗统计（重量、成本、使用时长）
4. 品牌/材料管理批量操作完善
5. 与打印机/AMS 设备状态联动
