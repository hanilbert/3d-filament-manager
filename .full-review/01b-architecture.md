# 架构审查报告 -- 3D Filament Manager

> 审查日期: 2026-02-28
> 审查范围: 全量代码库 -- 核心基础设施 (6) + API 路由 (11) + 页面组件 (18) + 共享模块
> 技术栈: Next.js 15 App Router / React 19 / TypeScript / Prisma + SQLite / Tailwind CSS 4.x

---

## 一、总体架构评估

### 1.1 架构概况

项目采用 **Next.js App Router 全栈单体架构**, 前后端共置于同一代码库中。数据层使用 Prisma ORM 配合 SQLite 作为嵌入式数据库。认证基于自定义 HMAC Token + HttpOnly Cookie, 在 Edge Middleware 中完成鉴权拦截。

**架构评分: 7.0 / 10**

项目在安全防护方面展现了良好的工程素养 (timing-safe 比较、HMAC 签名、open redirect 防护、magic byte 文件校验等), 且 API 设计保持了较好的一致性。但在组件边界、代码复用、数据模型设计和错误处理等方面存在明确的改进空间。

### 1.2 架构优势

| 方面 | 说明 |
|------|------|
| 安全意识 | 登录接口实现了 timing-safe 比较、速率限制、body 大小限制; logo 上传实现了 magic byte 校验 |
| Edge 兼容 | auth 模块精心设计了 Edge Runtime + Node.js Runtime 双兼容方案 |
| 数据库单例 | `globalForPrisma` 模式正确避免了开发模式下的连接泄漏 |
| API 一致性 | 所有路由采用统一的 `requireAuth` + try/catch + Prisma 错误码映射模式 |
| 页面布局 | `PageShell` / `PageHeader` 抽象提供了统一的页面结构 |

---

## 二、架构发现 (按严重程度排列)

---

### ARCH-C1: Filament 模型存在大量 "弱类型" 数据列

**严重程度: Critical**
**影响: 数据完整性、查询性能、API 契约可靠性**

**问题描述:**

`schema.prisma` 中 `Filament` 模型包含约 30 个 `String?` 类型的可选列, 其中 `nozzle_temp`, `bed_temp`, `density`, `diameter` 等本应为数值类型的字段全部存储为字符串。

```prisma
// prisma/schema.prisma -- 当前状态
nozzle_temp   String?
bed_temp      String?
density       String?
diameter      String?
print_speed   String?
```

**架构影响:**

1. **无法进行范围查询**: "查找喷嘴温度在 190-230 之间的耗材" 在字符串列上无法正确排序
2. **无法聚合统计**: 无法对温度、密度等做 AVG / MIN / MAX 运算
3. **数据质量无保障**: 用户可以输入 "很热" 作为温度值, 数据库层面无校验
4. **前端展示混乱**: 数值型字段的单位需要在每个消费端自行解析

**建议:**

将数值性字段迁移为 `Float?` 或 `Int?`, 并在应用层添加单位标注。对于确实需要自由文本的字段 (如 `ams_compatibility`, `build_plates`) 保留 `String?`。

```prisma
// 建议方案
nozzle_temp_min  Float?
nozzle_temp_max  Float?
bed_temp         Float?
density          Float?
diameter         Float?  @default(1.75)
```

---

### ARCH-C2: `filaments/route.ts` GET 端点承载过多职责 -- God Endpoint

**严重程度: Critical**
**影响: 可维护性、可测试性、API 契约清晰度**

**问题描述:**

`/api/filaments` 的 GET handler 通过 `groupBy` 查询参数承载了至少 6 种完全不同的响应结构:

| `groupBy` 值 | 返回结构 | 职责 |
|---|---|---|
| (空) | `FilamentItem[]` | 耗材列表 + 搜索 |
| `brandList` | `{brand, logo_url}[]` | 品牌下拉列表 |
| `brand` | `{brand, count, materials[], ...}[]` | 品牌分组聚合 |
| `material` | `{material, variantCount, ...}[]` | 材料分组聚合 |
| `materialType` | `{materialType, count}[]` | 材料类型聚合 |
| `variant` | `{variant, brandCount, ...}[]` | 细分类型聚合 |

```typescript
// src/app/api/filaments/route.ts -- 当前 GET 入口
export async function GET(request: NextRequest) {
  // ... 解析 8 个查询参数
  if (groupBy === "brandList") return handleGroupByBrandList();
  if (groupBy === "brand") return handleGroupByBrand();
  if (groupBy === "material") return handleGroupByMaterial();
  if (groupBy === "materialType") { /* 内联逻辑 */ }
  if (groupBy === "variant") return handleGroupByVariant(normalizedMaterial);
  // 默认: 耗材列表
}
```

**架构影响:**

1. **违反单一职责原则**: 一个端点返回 6 种完全不同的 JSON 结构, TypeScript 类型安全形同虚设
2. **无法独立缓存**: 耗材列表和品牌聚合的缓存策略完全不同, 合并后无法精细控制
3. **文档困难**: 无法用 OpenAPI schema 清晰描述返回类型
4. **测试复杂度高**: 需要覆盖 6 条分支路径

**建议:**

将聚合端点拆分为独立路由:

```
GET /api/filaments              -- 耗材列表 + 搜索
GET /api/filaments/brands       -- 品牌聚合
GET /api/filaments/materials    -- 材料聚合
GET /api/filaments/brand-list   -- 品牌下拉列表数据
```

---

### ARCH-H1: 页面组件大量重复 -- FilamentDetailPage 与 SpoolsDetailsPage 几乎相同

**严重程度: High**
**影响: 可维护性、DRY 原则**

**问题描述:**

以下两个页面在结构、逻辑和 UI 上几乎完全相同:

- `src/app/filaments/[id]/page.tsx` (FilamentDetailPage, 234 行)
- `src/app/spools/details/[id]/page.tsx` (SpoolsDetailsPage, 234 行)

它们都:
1. 通过 `apiFetch(/api/filaments/${id})` 获取相同的数据
2. 包含相同的 "新建线轴" / "删除线轴" 操作
3. 渲染相同的 "耗材概览" 卡片 (brand logo + color swatch)
4. 渲染相同的 filament detail sections
5. 包含相同的 spool 列表 (桌面表格 + 移动卡片)

```typescript
// 两个文件中几乎相同的代码块 (仅 title 构造略有不同)
// filaments/[id]/page.tsx:
const title = [item.brand, item.material, item.variant, item.color_name].filter(Boolean).join(" ");

// spools/details/[id]/page.tsx:
const title = [item.brand, item.color_name].filter(Boolean).join(" ");
```

**架构影响:**

修改 spool 列表的 UI 或行为时, 需要在两个文件中同步修改。目前已经出现了轻微的不一致: 一个标题是 "线轴列表", 另一个是 "料盘列表"。

**建议:**

提取共享组件:

```typescript
// components/FilamentSpoolPanel.tsx
export function FilamentSpoolPanel({ filament, spools, onAddSpool, onDeleteSpool })
// components/FilamentOverviewCard.tsx
export function FilamentOverviewCard({ filament })
```

---

### ARCH-H2: 接口类型定义散落各处, 缺少统一的 API 契约层

**严重程度: High**
**影响: 类型安全、前后端一致性**

**问题描述:**

API 返回的数据结构在每个消费页面中独立定义, 没有共享的接口定义:

```typescript
// src/app/filaments/page.tsx
interface BrandGroup {
  brand: string; logo_url?: string | null; count: number; ...
}

// src/app/filaments/brand/[brand]/page.tsx
interface FilamentItem {
  id: string; brand: string; material: string; ...
}

// src/app/spools/page.tsx
interface Spool {
  id: string; status: "ACTIVE" | "EMPTY"; filament: { ... }; ...
}

// src/app/location/[id]/page.tsx
interface LocationDetail {
  id: string; name: string; spools: Array<{ ... }>; ...
}
```

同一个数据实体 (如 Filament) 在不同页面中的接口定义存在细微差异 (字段是否可选、嵌套关系是否包含), 难以保证前后端契约的一致性。

**建议:**

在 `src/lib/types.ts` 中建立完整的 API 响应类型体系:

```typescript
// src/lib/types.ts -- 扩展
export interface SpoolWithRelations extends Spool {
  filament: FilamentSummary;
  location: LocationSummary | null;
}

export interface FilamentWithSpools extends Filament {
  spools: SpoolSummary[];
}

export interface LocationWithSpools extends Location {
  spools: SpoolWithFilament[];
  _count: { spools: number };
}
```

---

### ARCH-H3: Location 路径不一致 -- `/locations` vs `/location`

**严重程度: High**
**影响: 路由一致性、可预测性**

**问题描述:**

位置相关页面的路径存在单复数不一致:

```
列表页:   /locations          (复数)
新建页:   /locations/new      (复数)
批量创建: /locations/bulk-ams  (复数)
详情页:   /location/[id]      (单数)  <-- 不一致
编辑页:   /location/[id]/edit  (单数)  <-- 不一致
```

对比其他实体的路径全部使用复数:

```
/filaments
/filaments/[id]
/filaments/[id]/edit
/spools
/spools/[id]
```

**架构影响:**

1. 开发者记忆负担增加, 容易写错路径
2. SideNav 中需要特殊处理两种前缀: `pathname.startsWith("/locations") || pathname.startsWith("/location/")`
3. 破坏了整个应用的路由命名惯例

**建议:**

将 `src/app/location/` 目录统一迁移到 `src/app/locations/`, 使所有实体路由保持复数形式一致。

---

### ARCH-H4: `data-repair.ts` -- 在请求热路径中执行数据修复

**严重程度: High**
**影响: 性能、架构清晰度**

**问题描述:**

`ensureOrphanSpoolFilamentsRepaired()` 被嵌入到 spools 的 GET / PATCH 请求中:

```typescript
// src/app/api/spools/route.ts
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  await ensureOrphanSpoolFilamentsRepaired().catch(...);  // <-- 每次 GET 都执行
  // ...
}
```

该函数内部执行了原始 SQL 查询 (`$queryRaw`) + 潜在的批量 `upsert` 操作。虽然有 5 分钟的 TTL 缓存, 但:

1. **职责错位**: 数据修复逻辑不应该在 API 请求的关键路径上执行
2. **模块级状态**: `repairInFlight` 和 `lastRepairAt` 作为模块级变量, 在 serverless 环境中不可靠 (每个 cold start 都会重置)
3. **异常吞没**: `.catch()` 静默忽略修复失败, 可能掩盖严重的数据问题

**建议:**

将数据修复逻辑移至:
- 独立的 CLI 命令或 cron job
- 应用启动时的初始化钩子
- 专用的 `/api/admin/repair` 端点

---

### ARCH-H5: backfill 脚本存在 N+1 更新问题

**严重程度: High**
**影响: 性能**

**问题描述:**

```typescript
// prisma/backfill-material-type.ts
for (const row of missingMaterialRows) {
  const inferred = row.variant.trim().split(/\s+/)[0] || "UNKNOWN";
  await prisma.filament.update({
    where: { id: row.id },
    data: { material: inferred },
  });
}
```

逐条 `await` 更新, 当数据量大时将产生 N 次数据库往返。

**建议:**

使用 `prisma.$transaction()` 进行批量更新, 或按 inferred material 值分组后使用 `updateMany`:

```typescript
const grouped = new Map<string, string[]>();
for (const row of missingMaterialRows) {
  const inferred = row.variant.trim().split(/\s+/)[0] || "UNKNOWN";
  if (!grouped.has(inferred)) grouped.set(inferred, []);
  grouped.get(inferred)!.push(row.id);
}

await prisma.$transaction(
  [...grouped.entries()].map(([material, ids]) =>
    prisma.filament.updateMany({
      where: { id: { in: ids } },
      data: { material },
    })
  )
);
```

---

### ARCH-H6: Locations GET 返回过量嵌套数据 -- 过度加载

**严重程度: High**
**影响: 性能、带宽**

**问题描述:**

`GET /api/locations` 返回所有位置及其完整的 spool + filament 嵌套数据:

```typescript
// src/app/api/locations/route.ts
const locations = await prisma.location.findMany({
  include: {
    _count: { select: { spools: { where: { status: "ACTIVE" } } } },
    spools: {
      where: { status: "ACTIVE" },
      include: {
        filament: {
          select: { brand: true, material: true, color_name: true, color_hex: true, nominal_weight: true },
        },
      },
    },
  },
});
```

当位置数量多且每个位置有大量 spool 时, 响应体积将急剧膨胀。列表页面实际上只需要 `_count` 和少量摘要信息。

**建议:**

分离列表和详情的数据需求:
- `GET /api/locations` 仅返回位置基本信息 + `_count`
- `GET /api/locations/[id]` 返回完整的嵌套数据

---

### ARCH-M1: `isRecord` 工具函数在 3 个文件中重复定义

**严重程度: Medium**
**影响: DRY 原则**

**问题描述:**

以下函数在 3 个 API 路由文件中完全相同地定义:

```typescript
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

出现位置:
- `src/app/api/locations/route.ts`
- `src/app/api/locations/[id]/route.ts`
- `src/app/api/spools/route.ts`
- `src/app/api/spools/[id]/route.ts`

**建议:**

提取到 `src/lib/validation.ts`:

```typescript
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

---

### ARCH-M2: `logApiError` 在 5 个文件中重复定义

**严重程度: Medium**
**影响: DRY 原则、日志一致性**

**问题描述:**

```typescript
function logApiError(context: string, error: unknown) {
  if (process.env.NODE_ENV !== "test") {
    console.error(`[api/...] ${context}`, error);
  }
}
```

出现位置: `filaments/brand-rename`, `locations/route`, `locations/[id]`, `spools/route`, `spools/[id]`

每个文件的差异仅在日志前缀上。

**建议:**

提取到 `src/lib/api-logger.ts`:

```typescript
export function createApiLogger(prefix: string) {
  return (context: string, error: unknown) => {
    if (process.env.NODE_ENV !== "test") {
      console.error(`[${prefix}] ${context}`, error);
    }
  };
}
```

---

### ARCH-M3: `parseSortField` / `parseSortOrder` 在 filaments 和 spools 路由中重复

**严重程度: Medium**
**影响: DRY 原则**

**问题描述:**

`parseSortOrder` 在 `filaments/route.ts` 和 `spools/route.ts` 中存在完全相同的实现。`parseSortField` 逻辑相同、仅允许列表不同。

此外, `spools/page.tsx` 中的客户端排序逻辑 (`sortGroups`) 与服务端排序字段存在重叠, 容易产生排序不一致。

**建议:**

创建 `src/lib/query-utils.ts` 统一管理排序参数解析。

---

### ARCH-M4: 品牌 Logo 传播逻辑耦合在 CRUD 操作中

**严重程度: Medium**
**影响: 领域逻辑清晰度、单一职责**

**问题描述:**

在 `filaments/route.ts` POST 和 `filaments/[id]/route.ts` PATCH 中, 都嵌入了品牌 Logo 自动传播逻辑:

```typescript
// POST: 创建后传播 logo 到同品牌
if (item.logo_url) {
  await prisma.filament.updateMany({
    where: { brand: item.brand },
    data: { logo_url: item.logo_url },
  });
}

// PATCH: 更新后传播 logo
if (hasLogoInPayload) {
  await prisma.filament.updateMany({
    where: { brand: item.brand },
    data: { logo_url: item.logo_url },
  });
}
```

这段逻辑:
1. 在两个路由中重复
2. 与 CRUD 操作紧耦合, 难以独立测试
3. 存在隐含的性能风险 -- 当一个品牌有大量耗材时, `updateMany` 可能影响大量行

**建议:**

提取为领域服务:

```typescript
// src/lib/brand-logo-sync.ts
export async function syncBrandLogo(brand: string, logoUrl: string | null) { ... }
```

---

### ARCH-M5: 客户端页面缺乏统一的加载与错误状态处理

**严重程度: Medium**
**影响: 用户体验一致性、代码重复**

**问题描述:**

几乎所有客户端页面都包含相同的加载/空状态/错误模式:

```typescript
if (loading) return <div className="p-4 text-center text-muted-foreground">加载中...</div>;
if (!item) return <div className="p-4 text-center text-muted-foreground">未找到</div>;
```

```typescript
if (loading) return <p className="text-center text-muted-foreground py-8">加载中...</p>;
```

同类代码在至少 10 个页面中重复, 且样式不完全一致。

**建议:**

创建统一的状态组件:

```typescript
// components/PageLoadingState.tsx
export function PageLoading() { ... }
export function PageEmpty({ message }: { message: string }) { ... }
export function PageError({ error }: { error: string }) { ... }
```

或使用自定义 hook:

```typescript
function useAsyncData<T>(fetcher: () => Promise<T>) {
  // 返回 { data, loading, error, reload }
}
```

---

### ARCH-M6: Bulk AMS 创建使用串行 API 调用

**严重程度: Medium**
**影响: 性能、事务一致性**

**问题描述:**

`locations/bulk-ams/page.tsx` 中的批量创建逻辑逐个发送 HTTP 请求:

```typescript
for (let i = 0; i < selectedSlots.length; i++) {
  if (!selectedSlots[i]) continue;
  await apiFetch("/api/locations", {
    method: "POST",
    body: JSON.stringify({ ... }),
  });
  done++;
  setProgress(done);
}
```

**架构影响:**

1. 4 个 slot 需要 4 次 HTTP 往返, 在网络较差时体验不佳
2. 如果第 3 个请求失败, 前 2 个已经创建成功, 导致部分成功状态
3. 没有事务保证

**建议:**

添加批量 API 端点:

```
POST /api/locations/bulk
body: { locations: [...] }
```

在服务端使用 `prisma.$transaction` 保证原子性。

---

### ARCH-M7: SpoolDetailPage 加载全部 Location 用于位置选择器

**严重程度: Medium**
**影响: 性能**

**问题描述:**

```typescript
// src/app/spools/[id]/page.tsx
useEffect(() => {
  async function loadLocations() {
    const data = await apiFetch<SpoolLocation[]>("/api/locations");
    setLocations(data);
  }
  void loadLocations();
}, []);
```

这里加载了完整的 `/api/locations` 响应 (包含所有 spool 嵌套), 但实际上只需要 `{id, name}[]` 用于位置选择器下拉菜单。

**建议:**

添加精简端点或查询参数:

```
GET /api/locations?fields=id,name
```

---

### ARCH-M8: `auth.ts` 中 Token 缺少版本号 / 吊销机制

**严重程度: Medium**
**影响: 安全性**

**问题描述:**

```typescript
export function generateToken(): string {
  const payload = { iat: Date.now(), exp: Date.now() + TOKEN_TTL };
  const payloadB64 = toBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = hmacSignSync(payloadB64, getSecret());
  return `${payloadB64}.${sig}`;
}
```

Token payload 仅包含 `iat` 和 `exp`, 缺少:
1. **Token 版本号 (`ver`)**: 无法在不更换密钥的情况下批量失效旧 Token
2. **Token ID (`jti`)**: 无法针对单个 Token 进行吊销
3. **无黑名单/吊销机制**: 一旦签发, Token 在 7 天内始终有效, 即使用户已 "登出"

登出仅清除客户端 Cookie, 旧 Token 仍然有效:

```typescript
// src/app/api/auth/logout/route.ts
export async function POST() {
  return NextResponse.json(
    { success: true },
    { headers: { "Set-Cookie": "spool_tracker_token=; path=/; max-age=0; SameSite=Lax" } }
  );
}
```

**建议:**

对于个人工具应用, 当前方案可接受。如需增强:
- 添加 `ver` 字段 + 环境变量 `TOKEN_VERSION`
- 修改密码后自动递增版本号使所有旧 Token 失效

---

### ARCH-M9: Location 类型使用字符串枚举而非数据库枚举

**严重程度: Medium**
**影响: 数据完整性**

**问题描述:**

`Location.type` 在 schema 中定义为 `String @default("custom")`, 类型校验仅在应用层:

```prisma
model Location {
  type  String  @default("custom")
}
```

```typescript
// src/lib/location-types.ts
export const LOCATION_TYPES = [
  { value: "shelf", ... },
  { value: "printer", ... },
  { value: "ams_slot", ... },
  { value: "dryer", ... },
  { value: "custom", ... },
] as const;
```

对比 `SpoolStatus` 已经使用了 Prisma enum:

```prisma
enum SpoolStatus {
  ACTIVE
  EMPTY
}
```

**建议:**

将 `LocationType` 也提升为 Prisma enum, 与 `SpoolStatus` 保持一致:

```prisma
enum LocationType {
  shelf
  printer
  ams_slot
  dryer
  custom
}
```

---

### ARCH-L1: 数据访问模式缺乏抽象层 -- Prisma Client 直接渗透到路由

**严重程度: Low**
**影响: 可测试性、可替换性**

**问题描述:**

所有 API 路由和服务端组件直接调用 `prisma.xxx.findMany()`, 没有 Repository / Service 层:

```typescript
// src/app/api/filaments/route.ts
const items = await prisma.filament.findMany({ where: { ... }, include: { ... } });

// src/app/page.tsx
const [filamentCount, spoolActiveCount, ...] = await Promise.all([
  prisma.filament.count(),
  prisma.spool.count({ where: { status: "ACTIVE" } }),
  // ...
]);
```

**架构影响:**

1. **单元测试困难**: 测试路由逻辑需要 mock 整个 Prisma Client
2. **查询逻辑分散**: 相同的查询模式在多个路由中重复
3. **迁移困难**: 如果将来从 SQLite 迁移到 PostgreSQL 并需要使用原生特性, 修改面广

**建议:**

对于当前项目规模 (单人维护的工具应用), 这是一个低优先级的改进。如果项目增长, 可考虑引入 Repository 模式:

```typescript
// src/lib/repositories/filament-repository.ts
export const filamentRepository = {
  findWithSpools(id: string) { ... },
  search(query: SearchParams) { ... },
  groupByBrand() { ... },
};
```

---

### ARCH-L2: 服务端页面组件直接调用 Prisma -- 绕过了 API 层

**严重程度: Low**
**影响: 架构一致性**

**问题描述:**

项目中混合使用了两种数据获取模式:

| 模式 | 示例 |
|---|---|
| 服务端组件直接调用 Prisma | `page.tsx` (首页), `filaments/[id]/edit/page.tsx` |
| 客户端组件通过 API 获取 | 大部分列表和详情页 |

```typescript
// src/app/page.tsx (服务端组件) -- 直接用 prisma
const [filamentCount, spoolActiveCount, ...] = await Promise.all([
  prisma.filament.count(), ...
]);

// src/app/filaments/[id]/edit/page.tsx (服务端组件) -- 直接用 prisma
const item = await prisma.filament.findUnique({ where: { id } });

// src/app/filaments/[id]/page.tsx (客户端组件) -- 通过 API
const data = await apiFetch<FilamentWithSpools>(`/api/filaments/${id}`);
```

**建议:**

这在 Next.js App Router 中是合理的架构选择 (服务端组件可直接访问数据库), 但应保持一致: 要么统一通过 API, 要么统一在服务端组件中直接查询。当前的混合模式会导致相同的数据查询逻辑需要维护两套。

---

### ARCH-L3: 登录速率限制使用内存存储

**严重程度: Low**
**影响: 可靠性 (仅在分布式部署时)**

**问题描述:**

```typescript
// src/app/api/auth/login/route.ts
const attempts = new Map<string, { count: number; resetAt: number }>();
```

速率限制状态存储在进程内存中。在 serverless 或多实例部署时, 每个实例的限制计数器独立, 攻击者可通过分布到多个实例来绕过限制。

**建议:**

对于当前部署模式 (单实例 SQLite 应用) 这是完全合理的设计。如果将来需要分布式部署, 可迁移到 Redis 或 SQLite 表。

---

### ARCH-L4: `FilamentDetailSection` 渲染组件的 layout 分支在组件外部决定

**严重程度: Low**
**影响: 组件封装性**

**问题描述:**

`getFilamentDetailSections` 返回 `layout: "list" | "metric"`, 由 `FilamentDetailSection` 组件根据这个值选择渲染方式。这种设计将展示策略嵌入了数据定义中, 混淆了数据与 UI 的边界。

但考虑到这是一个简单的配置驱动 UI, 当前方案的实用性大于理论纯洁性, 不需要大规模重构。

---

## 三、依赖关系分析

### 3.1 模块依赖图 (核心)

```
middleware.ts ──> lib/auth.ts (verifyToken)

API Routes ──┬──> lib/api-auth.ts ──> lib/auth.ts
             ├──> lib/db.ts ──> prisma
             ├──> lib/types.ts
             ├──> lib/brand-logo.ts ──> lib/db.ts
             ├──> lib/data-repair.ts ──> lib/db.ts
             ├──> lib/upc-gtin.ts
             ├──> lib/filaments-query.ts
             ├──> lib/image-signature.ts
             └──> lib/spool-detail.ts

Page Components ──┬──> lib/fetch.ts (apiFetch)
                  ├──> lib/types.ts
                  ├──> lib/location-types.ts
                  ├──> lib/filament-detail-sections.ts ──> lib/types.ts
                  ├──> lib/utils.ts
                  ├──> components/layout/* (PageShell, PageHeader)
                  └──> components/* (ColorSwatch, ConfirmDialog, etc.)
```

### 3.2 循环依赖检查

**未发现循环依赖。** 依赖方向清晰:
- `lib/` 模块之间无环
- `components/` 依赖 `lib/` 但不反向依赖
- API 路由依赖 `lib/` 但不被 `lib/` 依赖

### 3.3 依赖方向评估

| 检查项 | 结果 |
|---|---|
| lib 是否依赖 components | 否 -- 正确 |
| lib 是否依赖 API routes | 否 -- 正确 |
| components 是否依赖 API routes | 否 -- 正确 |
| API routes 是否依赖 page components | 否 -- 正确 |

依赖方向符合 Clean Architecture 的依赖规则。

---

## 四、API 设计评估

### 4.1 RESTful 一致性

| 端点 | 方法 | 评估 |
|---|---|---|
| `/api/filaments` | GET/POST | GET 承载过多 (见 ARCH-C2), POST 正常 |
| `/api/filaments/[id]` | GET/PATCH/DELETE | 符合 REST 规范 |
| `/api/filaments/brand-rename` | PATCH | 动词式端点, 可接受为 RPC 风格操作 |
| `/api/locations` | GET/POST | GET 返回过多嵌套 (见 ARCH-H6) |
| `/api/locations/[id]` | GET/PATCH/DELETE | 符合 REST 规范 |
| `/api/spools` | GET/POST | 符合 REST 规范 |
| `/api/spools/[id]` | GET/PATCH/DELETE | 符合 REST 规范 |
| `/api/upload/logo` | POST | 独立的文件上传端点, 合理 |
| `/api/logos/[filename]` | GET | 静态资源读取, 合理 |

### 4.2 错误响应契约

所有 API 端点统一使用 `{ error: string }` 结构返回错误, 这是一个一致的契约。但缺少:
- 错误码 (仅有 HTTP 状态码 + 自然语言消息)
- 字段级别的验证错误详情

### 4.3 版本控制

当前无 API 版本控制。对于内部工具应用, 这是可接受的。

---

## 五、数据模型评估

### 5.1 Schema 设计

```
Filament (1) ──< Spool (N) >── (0..1) Location
```

三实体模型清晰地反映了业务领域: 耗材目录、线轴实例、存储位置。

### 5.2 索引覆盖

```prisma
model Spool {
  @@index([filament_id])   -- 支持"查看某耗材的所有线轴"
  @@index([location_id])   -- 支持"查看某位置的所有线轴"
  @@index([status])        -- 支持"筛选活跃/归档线轴"
}

model Filament {
  @@unique([brand, material, variant, color_name])  -- 业务唯一性约束
}
```

索引设计合理, 覆盖了主要查询路径。

### 5.3 潜在问题

| 问题 | 说明 |
|---|---|
| 所有数值字段为 String | 见 ARCH-C1 |
| Location.type 无数据库约束 | 见 ARCH-M9 |
| 缺少 `Filament.brand` 索引 | `brandFilter`, `groupBy=brand` 等查询频繁按品牌过滤, 但品牌字段无索引 |
| Spool 无复合索引 | `status + filament_id` 的复合索引可加速 "查看某耗材的活跃线轴" |

---

## 六、设计模式评估

### 6.1 已使用的模式

| 模式 | 实现 | 评估 |
|---|---|---|
| 单例模式 | `lib/db.ts` Prisma Client 全局单例 | 正确 |
| 策略模式 | `filament-detail-sections.ts` 配置驱动渲染 | 良好 |
| 中间件模式 | `middleware.ts` + `api-auth.ts` 认证拦截 | 良好 |
| 组合模式 | `PageShell` / `PageHeader` 页面组合 | 良好 |
| 适配器模式 | `spool-detail.ts` `withFallbackFilamentLogo` 策略注入 | 良好 |

### 6.2 缺失的抽象

| 缺失 | 说明 |
|---|---|
| Repository 层 | Prisma 调用直接散布在路由中 (见 ARCH-L1) |
| 统一的 API Response 工厂 | 每个路由手动构造 `NextResponse.json()` |
| 表单验证层 | 缺少 Zod/Yup 等 schema 验证, 手动 `if` 检查 |
| 自定义 Hook 层 | 数据获取逻辑在每个页面中重复 |

---

## 七、改进优先级建议

### 优先级 P0 (建议立即处理)

| 编号 | 问题 | 预估工作量 |
|---|---|---|
| ARCH-C2 | 拆分 filaments GET 端点 | 2-3h |
| ARCH-H3 | 统一 location 路由路径 | 1h |

### 优先级 P1 (建议本迭代处理)

| 编号 | 问题 | 预估工作量 |
|---|---|---|
| ARCH-H1 | 提取 FilamentDetail 共享组件 | 2h |
| ARCH-H2 | 统一 API 类型定义 | 2h |
| ARCH-M1/M2/M3 | 提取重复工具函数 | 1h |
| ARCH-M4 | 提取品牌 Logo 同步服务 | 1h |
| ARCH-M5 | 统一加载/错误状态组件 | 1h |
| ARCH-H6 | 优化 Locations GET 返回数据量 | 1h |

### 优先级 P2 (可在后续迭代处理)

| 编号 | 问题 | 预估工作量 |
|---|---|---|
| ARCH-C1 | 数值字段类型迁移 | 4-6h (含数据迁移) |
| ARCH-H4 | 移除请求热路径中的数据修复 | 1h |
| ARCH-H5 | 优化 backfill 脚本 | 30min |
| ARCH-M6 | 添加批量 AMS 创建端点 | 1.5h |
| ARCH-M7 | 优化位置选择器数据加载 | 30min |
| ARCH-M8 | Token 版本号 | 1h |
| ARCH-M9 | LocationType 提升为 Prisma enum | 1h |

---

## 八、架构一致性评分

| 维度 | 评分 | 说明 |
|---|---|---|
| 安全架构 | 8.5/10 | 出色的安全意识, timing-safe 比较、HMAC、rate limiting、magic byte 校验 |
| API 设计 | 6.0/10 | 一致的错误处理, 但 God Endpoint 和路径不一致拉低了分数 |
| 数据模型 | 5.5/10 | 关系设计合理, 但弱类型字段是核心缺陷 |
| 组件边界 | 6.0/10 | 有 PageShell/PageHeader 抽象, 但大量重复代码 |
| 代码复用 | 5.5/10 | 工具函数多处重复, 页面组件间代码克隆 |
| 可测试性 | 6.0/10 | 无 Repository 层, 但模块依赖方向清晰 |
| 关注点分离 | 6.5/10 | 整体分层合理, 但品牌 Logo 传播等领域逻辑嵌入 CRUD |
| 总体 | 7.0/10 | 对于个人工具项目而言是良好的水平, 有明确的提升路径 |

---

*审查工具: Claude Opus 4.6 -- Architecture Review Mode*
