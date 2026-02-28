# Spool Tracker — 3D 打印耗材管理系统

Spool Tracker 是一个面向 3D 打印用户的耗材管理应用，解决“料卷在哪”和“料卷是否已用完”两个高频问题。系统通过二维码将实物料卷、位置标签与 Web 数据绑定，支持移动端扫码更新和桌面端批量浏览。

---

## 功能特性

- 料卷生命周期管理：`ACTIVE / EMPTY`、重新入库、删除料卷
- 耗材字典管理：品牌、材料、颜色与完整打印参数档案
- 品牌与材料分层浏览：品牌页、材料大类页、子材料页
- 位置管理：支持货架/打印机/AMS 插槽/干燥机/自定义位置
- 扫码改位置：扫描位置二维码后直接更新料卷 `location_id`
- 标签能力：
  - 料卷标签预览 + PNG 下载
  - 位置标签 40x30mm 打印页（自动触发打印）
- 品牌 Logo 上传：MIME/大小校验，文件落盘并通过 API 读取
- 移动端优先 + 桌面侧边导航

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 运行时 | React 19 |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide React |
| ORM | Prisma |
| 数据库 | SQLite |
| 扫码/二维码 | html5-qrcode + qrcode.react |
| 标签导出 | html-to-image |
| 鉴权 | HMAC 签名 Token（7 天有效） |
| 部署 | Docker 多阶段构建 + docker-compose |

---

## 快速开始（本地开发）

### 前置要求

- Node.js 20+
- npm 或其他包管理器

### 安装与运行

1. **克隆项目并安装依赖**

```bash
# 安装依赖
npm install
```

2. **配置环境变量**

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，设置必要的环境变量
# APP_PASSWORD=your_secret_password
# NEXT_PUBLIC_BASE_URL=http://localhost:3000
# DATABASE_URL=file:./data/spool_tracker.db
```

3. **初始化数据库**

```bash
# 创建数据目录
mkdir -p data

# 运行数据库迁移
npx prisma migrate dev
```

4. **启动开发服务器**

```bash
npm run dev
```

5. **访问应用**

打开浏览器访问 [http://localhost:3000](http://localhost:3000)

首次访问会跳转到登录页面，使用 `.env` 中配置的 `APP_PASSWORD` 登录。

---

## Docker 部署（推荐）

### 使用 Docker Compose

1. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，设置生产环境的配置
```

2. **构建并启动容器**

```bash
docker compose up -d --build
```

3. **查看日志**

```bash
docker compose logs -f
```

4. **停止容器**

```bash
docker compose down
```

### 数据持久化

- 数据目录挂载为 `./data`（包含 SQLite 数据库和 Logo 文件）
- 容器启动时会自动执行 `prisma migrate deploy` 应用数据库迁移
- 确保 `./data` 目录有正确的读写权限

### 健康检查

容器配置了健康检查，每 30 秒检查一次应用是否正常运行。可以通过以下命令查看健康状态：

```bash
docker compose ps
```

---

## 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `APP_PASSWORD` | 访问密码（必填） | `your_secret_password` |
| `NEXT_PUBLIC_BASE_URL` | 生成二维码跳转链接的基础地址 | `https://spools.example.com` |
| `DATABASE_URL` | SQLite 数据库路径 | `file:/app/data/spool_tracker.db` |
| `TOKEN_SECRET` | Token 签名密钥（可选；不填则回退 `APP_PASSWORD`） | `a-strong-secret` |

---

## 数据模型

系统采用三层数据模型：

```text
Filament（耗材字典/SPU）
  ├── 基本信息：brand, material, variant, color_name, color_hex
  ├── 打印参数：温度、速度、风扇、回抽等 40+ 字段
  ├── 标识：logo_url, upc_gtin
  └── spools[]（一对多关系）
        ↓
Spool（线轴/SKU）
  ├── 状态：ACTIVE | EMPTY
  ├── 关联：filament_id（外键，onDelete: Restrict）
  ├── 位置：location_id（外键，可空）
  ├── 元数据：metadata（JSON 字符串）
  └── 时间戳：created_at, updated_at
        ↓
Location（存储位置）
  ├── 基本信息：name, type（shelf/printer/ams_slot/dryer/custom）
  ├── 默认位置：is_default
  ├── AMS 专用字段：printer_name, ams_unit, ams_slot
  └── spools[]（一对多关系）
```

### 核心业务规则

1. **耗材唯一性**：`(brand, material, variant, color_name)` 组合唯一
2. **UPC/GTIN 唯一性**：如果提供 UPC/GTIN，必须全局唯一
3. **品牌 Logo 共享**：同品牌的耗材自动继承最新上传的 Logo
4. **级联删除保护**：删除耗材时，如果存在关联的线轴，会拒绝删除
5. **位置解绑**：删除位置时，关联的线轴会自动解绑（location_id 设为 null）

---

## API 文档

所有 API 路由都需要认证（除了登录接口）。认证方式支持：
1. Authorization 请求头：`Bearer <token>`
2. HttpOnly Cookie：`spool_tracker_token`

### 认证 API

#### POST /api/auth/login
登录并获取 Token

**请求体：**
```json
{
  "password": "your_password"
}
```

**响应：**
- 200: 设置 HttpOnly Cookie，返回 `{ success: true }`
- 401: 密码错误

#### POST /api/auth/logout
登出并清除 Cookie

**响应：**
- 200: `{ success: true }`

### 耗材 API

#### GET /api/filaments
获取耗材列表或聚合统计

**查询参数：**
- `q`: 全文搜索（品牌、材料、变体、颜色）
- `brand`, `material`, `variant`: 筛选条件
- `exact`: 是否精确匹配（默认模糊匹配）
- `upc_gtin`: UPC/GTIN 查询
- `groupBy`: 聚合模式（`brand` | `material` | `variant` | `brandList`）

**响应：**
- 200: 耗材列表或聚合结果

#### POST /api/filaments
创建新耗材

**请求体：**
```json
{
  "brand": "eSUN",
  "material": "PLA+",
  "variant": "Pro",
  "color_name": "黑色",
  "color_hex": "#000000",
  "upc_gtin": "1234567890123",
  // ... 其他 40+ 打印参数字段
}
```

**响应：**
- 201: 创建成功，返回耗材详情
- 400: 请求格式错误或 UPC/GTIN 格式错误
- 409: UPC/GTIN 已存在

#### GET /api/filaments/[id]
获取耗材详情（包含关联的线轴）

**响应：**
- 200: 耗材详情
- 404: 耗材不存在

#### PATCH /api/filaments/[id]
更新耗材信息

**请求体：**（所有字段均为可选）
```json
{
  "brand": "新品牌名",
  "color_hex": "#FF0000",
  // ... 其他字段
}
```

**响应：**
- 200: 更新成功，返回耗材详情
- 400: 请求格式错误
- 404: 耗材不存在

#### DELETE /api/filaments/[id]
删除耗材

**响应：**
- 200: 删除成功
- 400: 存在关联的线轴，无法删除
- 404: 耗材不存在

#### PATCH /api/filaments/brand-rename
批量重命名品牌

**请求体：**
```json
{
  "oldBrand": "旧品牌名",
  "newBrand": "新品牌名"
}
```

**响应：**
- 200: 更新成功，返回 `{ count: 更新数量 }`

### 线轴 API

#### GET /api/spools
获取线轴列表

**查询参数：**
- `status`: 筛选状态（`ACTIVE` | `EMPTY`）
- `sortBy`: 排序字段（`brand` | `material` | `variant` | `color_name` | `status` | `created_at` | `updated_at`）
- `sortOrder`: 排序方向（`asc` | `desc`，默认 `desc`）

**响应：**
- 200: 线轴列表（包含关联的耗材和位置信息）

#### POST /api/spools
创建新线轴

**请求体：**
```json
{
  "filament_id": "耗材ID"
}
```

**响应：**
- 201: 创建成功，返回线轴详情
- 404: 耗材不存在

#### GET /api/spools/[id]
获取线轴详情

**响应：**
- 200: 线轴详情（包含耗材和位置信息）
- 404: 线轴不存在

#### PATCH /api/spools/[id]
更新线轴信息

**请求体：**（所有字段均为可选）
```json
{
  "status": "EMPTY",
  "location_id": "位置ID",
  "metadata": { "custom": "data" }
}
```

**响应：**
- 200: 更新成功，返回线轴详情
- 404: 线轴不存在

#### DELETE /api/spools/[id]
删除线轴

**响应：**
- 200: 删除成功
- 404: 线轴不存在

### 位置 API

#### GET /api/locations
获取位置列表

**查询参数：**
- `view`: 简化模式（`picker` 仅返回 id 和 name）

**响应：**
- 200: 位置列表

#### POST /api/locations
创建新位置

**请求体：**
```json
{
  "name": "位置名称",
  "type": "shelf",
  "is_default": false,
  "printer_name": "打印机名称",
  "ams_unit": "AMS 单元",
  "ams_slot": "插槽编号"
}
```

**响应：**
- 201: 创建成功，返回位置详情

#### GET /api/locations/[id]
获取位置详情（包含活跃线轴）

**响应：**
- 200: 位置详情
- 404: 位置不存在

#### PATCH /api/locations/[id]
更新位置信息

**请求体：**（所有字段均为可选）
```json
{
  "name": "新位置名称",
  "type": "ams_slot"
}
```

**响应：**
- 200: 更新成功，返回位置详情
- 404: 位置不存在

#### DELETE /api/locations/[id]
删除位置（自动解绑关联的线轴）

**响应：**
- 200: 删除成功
- 404: 位置不存在

### 文件上传 API

#### POST /api/upload/logo
上传品牌 Logo

**请求体：**
- Content-Type: `multipart/form-data`
- 字段名：`file`
- 支持格式：PNG, JPEG, WebP, SVG
- 最大大小：5MB

**响应：**
- 200: 上传成功，返回 `{ url: "/api/logos/filename.png" }`
- 400: 文件格式或大小不符合要求

#### GET /api/logos/[filename]
读取 Logo 文件

**响应：**
- 200: 返回图片文件
- 404: 文件不存在

---

## 目录结构

```text
3d-filament-manager/
├── src/
│   ├── app/                          # Next.js App Router 页面和 API 路由
│   │   ├── (auth)/                   # 认证相关页面（登录）
│   │   │   └── login/
│   │   ├── api/                      # RESTful API 路由
│   │   │   ├── auth/                 # 认证 API（登录/登出）
│   │   │   ├── filaments/            # 耗材管理 API
│   │   │   ├── spools/               # 线轴管理 API
│   │   │   ├── locations/            # 位置管理 API
│   │   │   ├── upload/               # 文件上传 API
│   │   │   └── logos/                # Logo 文件读取 API
│   │   ├── filaments/                # 耗材相关页面
│   │   │   ├── [id]/                 # 耗材详情和编辑
│   │   │   ├── new/                  # 新建耗材
│   │   │   └── materials/            # 材料分类浏览
│   │   ├── spools/                   # 线轴列表页面
│   │   │   └── details/[id]/         # 线轴详情页面
│   │   ├── locations/                # 位置管理页面
│   │   │   └── [id]/                 # 位置详情页面
│   │   ├── layout.tsx                # 全局布局
│   │   └── page.tsx                  # 首页仪表盘
│   ├── components/                   # React 组件
│   │   ├── layout/                   # 布局组件（页面标题、容器等）
│   │   ├── theme/                    # 主题相关组件（主题切换、提供者）
│   │   ├── ui/                       # shadcn/ui 基础组件
│   │   ├── CatalogForm.tsx           # 耗材表单（40+ 字段）
│   │   ├── LocationForm.tsx          # 位置表单
│   │   ├── FilamentDetailView.tsx    # 耗材详情视图
│   │   ├── GlobalScanDialog.tsx      # 全局扫码对话框
│   │   ├── QRScanner.tsx             # 二维码扫描器
│   │   └── QRCodeDisplay.tsx         # 二维码显示组件
│   ├── lib/                          # 核心业务逻辑和工具函数
│   │   ├── auth.ts                   # HMAC Token 生成和验证
│   │   ├── api-auth.ts               # API 路由认证中间件
│   │   ├── api-schemas.ts            # Zod 验证 Schema
│   │   ├── rate-limit.ts             # 固定窗口限流器
│   │   ├── http.ts                   # HTTP 请求体大小限制
│   │   ├── brand-logo.ts             # 品牌 Logo 共享逻辑
│   │   ├── upc-gtin.ts               # UPC/GTIN 格式校验
│   │   ├── filaments-api-query.ts    # 耗材查询条件构建
│   │   ├── location-types.ts         # 位置类型枚举
│   │   ├── types.ts                  # TypeScript 类型定义
│   │   ├── db.ts                     # Prisma Client 单例
│   │   ├── fetch.ts                  # 客户端 API 请求封装
│   │   └── utils.ts                  # 通用工具函数
│   ├── __tests__/                    # 测试文件（Vitest）
│   └── middleware.ts                 # Next.js 全局中间件（路由守卫）
├── prisma/
│   ├── schema.prisma                 # 数据库模型定义
│   └── migrations/                   # 数据库迁移文件
├── public/                           # 静态资源
│   └── fonts/                        # 字体文件
├── data/                             # 数据持久化目录（Docker 挂载）
│   ├── spool_tracker.db              # SQLite 数据库
│   └── logos/                        # 品牌 Logo 文件
├── Dockerfile                        # Docker 镜像构建配置
├── docker-compose.yml                # Docker Compose 配置
├── next.config.ts                    # Next.js 配置
├── tailwind.config.ts                # Tailwind CSS 配置
├── tsconfig.json                     # TypeScript 配置
├── package.json                      # 项目依赖和脚本
└── .env                              # 环境变量配置
```

---

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器（http://localhost:3000）
npm run build            # 构建生产版本
npm start                # 启动生产服务器
npm run lint             # 运行 ESLint 代码检查

# 测试
npm test                 # 运行测试（Vitest）
npm run test:watch       # 监听模式运行测试

# 数据库
npx prisma studio        # 打开 Prisma Studio 数据库管理界面
npx prisma migrate dev   # 创建并应用数据库迁移（开发环境）
npx prisma migrate deploy # 应用数据库迁移（生产环境）
npx prisma generate      # 生成 Prisma Client
npx prisma db push       # 直接同步数据库结构（不创建迁移）
```

---

## 注意事项

- 扫码依赖 HTTPS 或 localhost（浏览器摄像头权限限制）
- SQLite 适合个人/小规模并发场景
- 当前为单密码模式，不含多用户权限体系

---

## License

MIT

### Third-Party Licenses

This project includes the following third-party assets:

- **Font**: LXGW Neo XiHei Screen Full
  - License: IPA Font License 1.0
  - Location: `/fonts/LXGWNeoXiHeiScreenFull.ttf`
  - Full license text: `/fonts/LICENSE`
  - Source: https://github.com/lxgw/LxgwNeoXiHei
