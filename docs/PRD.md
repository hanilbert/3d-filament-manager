# 3D 打印耗材位置与生命周期管理系统
## 产品需求文档 (PRD)

**版本**: v1.0
**日期**: 2026-02-21
**状态**: MVP 已完成

---

## 目录

1. [项目概述](#1-项目概述)
2. [目标用户与使用场景](#2-目标用户与使用场景)
3. [核心业务架构](#3-核心业务架构)
4. [数据库 Schema](#4-数据库-schema)
5. [功能模块详细说明](#5-功能模块详细说明)
6. [用户工作流](#6-用户工作流)
7. [UI/UX 规范](#7-uiux-规范)
8. [标签打印规范](#8-标签打印规范)
9. [访问鉴权方案](#9-访问鉴权方案)
10. [技术栈](#10-技术栈)
11. [API 设计大纲](#11-api-设计大纲)
12. [部署方案](#12-部署方案)
13. [非功能性需求](#13-非功能性需求)
14. [MVP 范围外事项](#14-mvp-范围外事项)

---

## 1. 项目概述

### 1.1 产品名称

**Spool Tracker** —— 3D 打印耗材位置与生命周期管理系统

### 1.2 核心定位

一个轻量级的个人 Web 应用，主打**极简的移动端交互**、**二维码物理资产追踪**，以及**精准适配热敏打印机的标签打印**。

核心理念：**"一物一码一卡"** —— 每卷耗材对应一张贴有唯一二维码标签的色卡，通过手机扫码即可完成位置变更和生命周期归档。

### 1.3 产品背景

3D 打印玩家在积累一定数量的耗材后，面临两个日常痛点：
- **找不到**：耗材散放，不记得某种颜色放在哪个防潮箱
- **用不完**：不知道某卷耗材是否已经用完，反复查找空卷

本系统通过物理标签 + 数字化管理的闭环，彻底解决以上问题。

---

## 2. 目标用户与使用场景

### 2.1 目标用户

拥有多种品牌、多种颜色耗材的 3D 打印个人用户。

### 2.2 典型使用场景

| 场景 | 描述 |
|------|------|
| 收到新耗材 | 打印色卡 → 系统建档 → 打印标签 → 贴在色卡 → 放入防潮箱 |
| 移动耗材 | 手机扫码 → 点击"修改位置" → 扫描位置二维码 → 自动更新 |
| 查找耗材 | 手机扫码色卡 → 立即看到当前所在位置 |
| 用完耗材 | 手机扫码 → 点击"标记为已用完" → 自动归档 |
| 再次购买 | 扫描旧色卡 → 点击"重新入库" → 一键创建新料卷 |

---

## 3. 核心业务架构

### 3.1 双层数据架构（SPU + SKU 模型）

系统采用类电商 SPU（标准产品单元）与 SKU（库存单元）的双层设计：

```
全局耗材字典 (GlobalFilament / SPU)
│
│  一种耗材对应一条记录
│  例如：「Bambu Lab PLA Matte 草绿 11500」
│
└──→ 我的料卷 (Spool / SKU)
         │
         │  每购买一卷物理耗材对应一条记录
         │
         └──→ 位置 (Location)
                   例如：「防潮箱 A」
```

### 3.2 三大实体关系

- **GlobalFilament**（全局耗材字典）：客观属性，"维基百科"性质，不因个人库存变化而改变
- **Spool**（我的料卷）：代表现实中真实存在的一卷耗材，有独立的 UUID 和生命周期
- **Location**（位置）：物理存放点，也有独立的 UUID 和二维码标签

### 3.3 状态流转

```
[新建 Spool] ──→ ACTIVE（使用中）──→ EMPTY（已用完/归档）
                      ↑
               可从 EMPTY 重新入库
               （生成全新的 Spool 记录）
```

---

## 4. 数据库 Schema

数据库使用 **SQLite**，通过 **Prisma ORM** 管理。

### 4.1 GlobalFilament（全局耗材字典）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String (UUID) | ✅ | 主键，自动生成 |
| `brand` | String | ✅ | 品牌名称，如 "Bambu Lab"、"eSUN" |
| `material` | String | ✅ | 材质类型，如 "PLA Matte"、"PETG" |
| `color_name` | String | ✅ | 颜色名称，如 "草绿 11500 (Grass green)" |
| `color_hex` | String | ❌ | 颜色 hex 色值，如 "#5C8A3C"（选填，用于 UI 颜色预览） |
| `nozzle_temp` | String | ✅ | 喷嘴温度，如 "190-230°C" |
| `bed_temp` | String | ✅ | 热床温度，如 "35-45°C" |
| `print_speed` | String | ✅ | 打印速度，如 "≤300 mm/s" |
| `logo_url` | String | ❌ | 品牌 Logo（本地上传路径或外部 URL） |
| `created_at` | DateTime | ✅ | 创建时间，自动生成 |

### 4.2 Location（位置）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String (UUID) | ✅ | 主键，自动生成，同时作为位置二维码的内容 |
| `name` | String | ✅ | 位置名称，如 "防潮箱 A"、"货架 1 号" |

> **二维码内容**：`https://your-domain.com/location/{id}`，扫码后跳转到该位置下所有料卷的列表页。

### 4.3 Spool（我的料卷）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | String (UUID) | ✅ | 主键，自动生成，作为色卡标签二维码内容 |
| `global_filament_id` | String (FK) | ✅ | 外键，关联 GlobalFilament.id |
| `location_id` | String (FK) | ❌ | 外键，关联 Location.id，初始为 null |
| `status` | Enum | ✅ | `ACTIVE`（使用中）/ `EMPTY`（已归档）|
| `metadata` | JSON | ❌ | 预留扩展字段（购买日期、价格、初始重量、备注等）|
| `created_at` | DateTime | ✅ | 入库时间，自动生成 |

> **二维码内容**：`https://your-domain.com/spool/{id}`，扫码后跳转到该料卷的详情页。

---

## 5. 功能模块详细说明

### 5.1 模块 A：全局耗材字典管理

#### A-1 耗材字典列表
- 展示所有已录入的 GlobalFilament 记录
- 支持按**品牌**、**材质**筛选（300ms debounce 搜索）
- 每条记录显示：颜色色块 + 品牌 + 材质 + 颜色名 + 关联料卷数

#### A-2 新建耗材字典
- 填写表单：品牌、材质、颜色名、颜色 hex（选填）、喷嘴温度、热床温度、打印速度
- Logo 管理（Tab 切换）：上传图片 / 填写外部 URL
- 提交后自动跳转到该字典项的详情页

#### A-3 编辑耗材字典
- 预填所有字段，可修改后提交 PATCH

#### A-4 从字典创建料卷
- 在字典详情页点击**「加入我的料卷」**，创建新 Spool 记录（status=ACTIVE，location_id=null）

---

### 5.2 模块 B：我的料卷管理

#### B-1 料卷列表
- 顶部两个 Tab：**「使用中 (Active)」**和**「已归档 (Empty)」**
- 每条记录显示：颜色色块 + 品牌/材质/颜色名 + 当前位置 + 入库时间

#### B-2 料卷详情页（`/spool/{id}`）

**ACTIVE 状态**下的操作：

| 按钮 | 说明 |
|------|------|
| 「修改位置」| 调起手机摄像头，扫描位置二维码 |
| 「打印标签」| 跳转到标签打印页 `/spool/{id}/print` |
| 「标记为已用完」| 弹出确认对话框，确认后 status 改为 EMPTY |

**EMPTY 状态**下：
- 页面顶部显示警告横幅：`⚠️ 此耗材已归档（已用完）`
- 显示**「重新入库」**按钮：基于同一 GlobalFilament 创建新 Spool，跳转到新详情页

#### B-3 扫码修改位置（核心交互）

1. 点击「修改位置」→ 页面内展开扫码区域（`html5-qrcode`）
2. 扫描位置标签 → 前端解析 Location UUID
3. 自动调用 API 更新 `Spool.location_id`
4. 显示「✅ 位置已更新为：防潮箱 A」

---

### 5.3 模块 C：位置管理

#### C-1 位置列表
- 每个位置显示：名称 + 当前存放的料卷数量
- 内联折叠式新建表单

#### C-2 位置详情页（`/location/{id}`）
- 扫描位置标签后跳转到此页面
- 展示：位置名称 + 当前存放的所有活跃料卷列表
- 支持内联编辑位置名称
- 支持删除位置（解绑下属料卷的 location_id，不删除料卷）

#### C-3 位置标签打印（`/location/{id}/print`）
- 输出适配 40×30mm 的位置二维码标签

---

## 6. 用户工作流

### Workflow 1：新耗材入库
```
收到新耗材
  → 进入「全局字典」→ 搜索品牌/材质
      ├── [已有] 点击进入字典详情页
      └── [没有] 新建，填写参数（含上传 Logo）
  → 点击「加入我的料卷」
  → 跳转到新 Spool 详情页
  → 点击「打印标签」→ 热敏打印机打印 40×30mm 标签
  → 贴在色卡上，色卡放入料盒
```

### Workflow 2：更新耗材位置
```
扫描色卡上的二维码 → /spool/{id} 详情页
  → 点击「修改位置」→ 摄像头扫描防潮箱位置标签
  → 提示「位置已更新为：防潮箱 A」
```

### Workflow 3：查找耗材位置
```
扫描色卡上的二维码 → /spool/{id} 详情页
  → 查看「当前位置」字段
```

### Workflow 4：耗材用完归档
```
扫描色卡 → /spool/{id} 详情页
  → 点击「标记为已用完」→ 确认弹窗
  → status 改为 EMPTY，料卷移入「已归档」列表
```

### Workflow 5：再次购买同款
```
扫描旧色卡（EMPTY 状态）
  → 看到「⚠️ 此耗材已归档」提示
  → 点击「重新入库」
  → 创建新 Spool，跳转到新详情页，继续打印标签
```

---

## 7. UI/UX 规范

### 7.1 设计原则
- **移动端优先**：所有页面以手机浏览器为主要设计目标
- **大按钮原则**：操作按钮高度 ≥ 48px
- **信息密度适中**：列表卡片只显示核心信息

### 7.2 颜色展示
- 若 GlobalFilament 有 `color_hex`，在列表、详情页、标签打印页渲染颜色色块
- 无 `color_hex` 时，仅显示 `color_name` 文字，色块位置显示灰色占位

### 7.3 页面路由规划

| 路由 | 说明 |
|------|------|
| `/` | 重定向到 `/spools` |
| `/login` | 密码输入页 |
| `/spools` | 料卷列表（Active/Empty 两个 Tab）|
| `/spool/{id}` | 料卷详情页（扫码后的目标页）|
| `/spool/{id}/print` | 料卷标签打印页（无导航栏）|
| `/catalog` | 全局耗材字典列表 |
| `/catalog/new` | 新建全局耗材字典 |
| `/catalog/{id}` | 字典详情页 |
| `/catalog/{id}/edit` | 编辑字典 |
| `/locations` | 位置管理列表 |
| `/location/{id}` | 位置详情页（扫位置码后的目标页）|
| `/location/{id}/print` | 位置标签打印页 |

---

## 8. 标签打印规范

### 8.1 通用规格

| 项目 | 规格 |
|------|------|
| 物理尺寸 | 宽 40mm × 高 30mm |
| 打印方式 | CSS `@media print`，纯前端渲染 |
| 页面设置 | `@page { size: 40mm 30mm; margin: 0; }` |

### 8.2 料卷标签排版

```
┌──────────────────────────────┐  ← 40mm
│ [品牌 Logo]  PLA MATTE       │
│ ──────────────────  [■■■■]  │
│ 🌡 190-230°C  床: 35-45°C   │  [二维码]
│ ⚡ ≤300 mm/s                 │
│ ● 草绿 11500                 │
└──────────────────────────────┘
        ↕ 30mm
```

- **左侧（65% 宽度）**：品牌 Logo + 材质名称（加粗大写）+ 温度/速度/颜色参数
- **右侧（35% 宽度）**：充满二维码，内容为 `https://your-domain.com/spool/{id}`
- 若有 `color_hex`，材质名称背景色使用该颜色，文字色通过 luminance 公式自动适配

### 8.3 位置标签排版

```
┌──────────────────────────────┐  ← 40mm
│                              │
│  防潮箱 A         [■■■■]   │
│                   [二维码]   │
│                              │
└──────────────────────────────┘
        ↕ 30mm
```

---

## 9. 访问鉴权方案

### 9.1 方案说明

采用**单一密码 + Token** 方案，轻量无需注册登录系统。

### 9.2 密码配置

```env
APP_PASSWORD=your_secret_password_here
```

### 9.3 认证流程

```
用户访问任意页面
  → 检查 Cookie 中的 token（由 src/proxy.ts 中间件拦截）
      ├── [有效] 直接进入系统
      └── [无效/过期] 重定向到 /login?from=...
            → 用户输入密码
            → POST /api/auth/login { password }
            → 后端校验 process.env.APP_PASSWORD
                ├── [匹配] 生成 Token，写入 localStorage + Cookie（7天）
                └── [不匹配] 返回 401
```

### 9.4 Token 规则

| 项目 | 规格 |
|------|------|
| Token 类型 | 服务端生成的随机字符串（UUID v4）|
| 存储位置 | `localStorage['spool_tracker_token']` + Cookie |
| 有效期 | 7 天 |
| API 验证 | `Authorization: Bearer {token}` Header |
| 页面验证 | Cookie `spool_tracker_token`（由 proxy.ts 读取）|

> **注意**：Token 存储在内存 Map 中，服务重启后所有 Token 失效，用户需重新登录。

---

## 10. 技术栈

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| **框架** | Next.js 16（App Router，TypeScript）| 前后端一体，部署简单，单 Docker 镜像 |
| **数据库** | SQLite | 轻量、无需独立数据库服务、单文件挂载持久化 |
| **ORM** | Prisma | Schema 清晰、类型安全、迁移管理方便 |
| **UI 组件** | Tailwind CSS + shadcn/ui | 快速构建移动端优先的响应式界面 |
| **二维码生成** | `qrcode.react` | 前端动态渲染二维码，适合打印排版 |
| **二维码扫描** | `html5-qrcode` | 调用 H5 Camera API，轻量无依赖 |
| **Logo 上传** | Next.js API Route | 服务端处理文件上传，存储到 Docker Volume |
| **容器化** | Docker + docker-compose | 单镜像部署，数据库和图片目录通过 Volume 持久化 |

---

## 11. API 设计大纲

所有 API（除 `/api/auth/login`）均需 `Authorization: Bearer {token}` Header。

### 11.1 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 密码验证，返回 `{ token, expiresAt }` |

### 11.2 全局耗材字典 (Catalog)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/catalog` | 列表（支持 `?q=&brand=&material=` 过滤，含 spool 计数）|
| POST | `/api/catalog` | 新建 |
| GET | `/api/catalog/{id}` | 详情（含 ACTIVE spool 列表）|
| PATCH | `/api/catalog/{id}` | 更新 |
| DELETE | `/api/catalog/{id}` | 删除（有关联 Spool 则返回 400）|

### 11.3 料卷 (Spools)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/spools` | 列表（支持 `?status=ACTIVE\|EMPTY`，含 globalFilament + location）|
| POST | `/api/spools` | 新建（传入 `global_filament_id`）|
| GET | `/api/spools/{id}` | 详情（含 globalFilament + location 全量信息）|
| PATCH | `/api/spools/{id}` | 更新（白名单字段：location_id、status、metadata）|

### 11.4 位置 (Locations)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/locations` | 列表（含活跃料卷数 `_count`）|
| POST | `/api/locations` | 新建 |
| GET | `/api/locations/{id}` | 详情（含 ACTIVE Spool 列表）|
| PATCH | `/api/locations/{id}` | 更新名称 |
| DELETE | `/api/locations/{id}` | 删除（解绑料卷 location_id，不删除料卷）|

### 11.5 文件上传

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/logo` | 上传品牌 Logo（MIME 验证，≤5MB，UUID 重命名）|
| GET | `/api/logos/{filename}` | 读取 Logo 文件（basename 防路径穿越）|

---

## 12. 部署方案

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

---

## 13. 非功能性需求

### 13.1 性能
- 页面首屏加载：移动端 3G 网络下 < 3 秒
- API 响应时间：普通查询 < 200ms

### 13.2 安全性
- 全站强制鉴权，Token 有效期 7 天
- Logo 上传限制文件类型（`.jpg`、`.png`、`.webp`、`.svg`）和大小（≤ 5MB）
- 上传目录与代码分离，通过 API Route 代理访问（防路径穿越）

### 13.3 可维护性
- 所有数据库操作通过 Prisma，Schema 变更通过 migration 管理
- 环境变量驱动配置，代码中无硬编码密钥

### 13.4 扩展性设计
| 预留设计 | 说明 |
|----------|------|
| `Spool.metadata` JSON 字段 | 未来可存入初始重量、购买日期、价格、备注，无需迁移表结构 |
| `color_hex` 可选字段 | 不填写时系统正常运行，填写后自动启用颜色可视化 |
| Logo 双模式支持 | 上传文件和外部 URL 两种方式共存 |
| RESTful API | 便于未来接入移动 App 或自动化脚本 |

---

## 14. MVP 范围外事项

以下功能在当前 MVP 版本中**不实现**，未来可基于 `Spool.metadata` 扩展：

| 功能 | 触发条件 | 备注 |
|------|----------|------|
| 初始重量记录 | 需要区分大卷/小卷时 | 存入 `metadata.initial_weight` |
| 购买日期/价格 | 需要消耗成本统计时 | 存入 `metadata.purchase_date/price` |
| 个人备注 | 需要记录特殊打印参数时 | 存入 `metadata.notes` |
| UPC 条码搜索 | 全局字典数据量大时 | 扩展 `GlobalFilament` 表 |
| 多用户支持 | 有共用设备需求时 | 需重新设计鉴权架构 |
| Token 持久化 | 需要服务重启后不掉登录 | 新增 Session 表 |
