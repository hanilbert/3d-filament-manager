# Spool Tracker — 测试用例设计（重构版）

**版本**: v2.0  
**日期**: 2026-02-23  
**目标**: 基于当前实现建立可回归、可分层执行的测试用例集（API + UI + 打印 + 安全边界）

---

## 1. 设计原则

- 覆盖“真实实现”，不沿用已过时行为假设。
- 先跑 P0 冒烟集，再跑 P1/P2 全量回归。
- API 优先自动化，UI/打印采用手工 + 静态验证组合。
- 每个用例都能映射到明确业务风险。

---

## 2. 测试范围

### 2.1 在测范围

- 鉴权：`/api/auth/login`、`/api/auth/logout`、`middleware` 路由拦截
- Catalog：CRUD、分组查询、品牌重命名
- Spool：CRUD、状态流转、扫码改位置
- Location：类型化位置、AMS 校验、删除解绑
- 上传：Logo 上传与读取
- 页面：登录、列表、详情、关键交互
- 打印：料卷标签页、位置标签页

### 2.2 不在本轮范围

- 浏览器兼容性矩阵（仅覆盖 Chrome 最新）
- 高并发压测与容量上限
- 自动化视觉回归（像素级）

---

## 3. 环境与数据

## 3.1 环境前提

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

- 默认地址：`http://localhost:3000`
- 测试密码：读取 `.env` 中 `APP_PASSWORD`

## 3.2 令牌获取

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"<APP_PASSWORD>"}'
```

保存返回 `token` 到 `TOKEN` 变量。

## 3.3 测试数据约定

- 使用前缀 `TC2_` 标记测试数据（如品牌、位置名）。
- 允许保留少量历史测试数据，断言应避免依赖“空库”。
- 需要“空态”断言时单独准备隔离数据库。

---

## 4. 用例格式

每条用例使用统一结构：

- `ID`
- `优先级`（P0/P1/P2）
- `类型`（API 自动化 / UI 手工 / 静态验证）
- `前置`
- `步骤`
- `期望`

---

## 5. P0 冒烟集（建议每次提交必跑）

| ID | 类型 | 场景 | 期望 |
|---|---|---|---|
| SMK-001 | API 自动化 | 正确密码登录 | 200，返回 `token` 与 `expiresAt` |
| SMK-002 | API 自动化 | 无 token 访问 `/api/catalog` | 401 |
| SMK-003 | API 自动化 | 创建 Catalog（含 `material_type`） | 201，返回 `id` |
| SMK-004 | API 自动化 | 基于 Catalog 创建 Spool | 201，`status=ACTIVE` |
| SMK-005 | API 自动化 | 创建 Location（`type=custom`） | 201，返回 `id` |
| SMK-006 | API 自动化 | PATCH Spool 位置 | 200，`location_id` 更新 |
| SMK-007 | API 自动化 | PATCH Spool 状态为 `EMPTY` | 200，`status=EMPTY` |
| SMK-008 | API 自动化 | EMPTY 料卷重新入库（POST /api/spools） | 201，新 `id`，`status=ACTIVE` |
| SMK-009 | API 自动化 | 删除 Location | 200，关联 Spool 被解绑 |
| SMK-010 | API 自动化 | 上传合法 Logo | 201，返回可访问 `url` |
| SMK-011 | UI 手工 | 登录后进入 `/spools` | 页面可用，Tab 正常 |
| SMK-012 | UI 手工 | 打开 `/location/{id}/print` | 页面加载后触发打印 |

---

## 6. API 合同测试（全量）

## 6.1 AUTH

### TC2-AUTH-001（P0，API 自动化）正确密码登录

- 步骤：`POST /api/auth/login`，body 含正确密码
- 期望：200，返回 `token`（非空字符串）与 `expiresAt`（number）

### TC2-AUTH-002（P0，API 自动化）错误密码登录

- 步骤：`POST /api/auth/login`，错误密码
- 期望：401，不返回 `token`

### TC2-AUTH-003（P1，API 自动化）空密码登录

- 步骤：`POST /api/auth/login`，`password=""`
- 期望：401

### TC2-AUTH-004（P0，API 自动化）无 token 访问受保护 API

- 步骤：`GET /api/spools`
- 期望：401

### TC2-AUTH-005（P0，API 自动化）无效 token 访问受保护 API

- 步骤：`GET /api/spools`，`Authorization: Bearer invalid`
- 期望：401

### TC2-AUTH-006（P1，API 自动化）登出接口可调用

- 步骤：`POST /api/auth/logout`
- 期望：200，`success=true`，响应头含清理 `spool_tracker_token` 的 Set-Cookie

### TC2-AUTH-007（P0，UI 手工）未登录访问页面被重定向

- 前置：清空 cookie
- 步骤：访问 `/spools`
- 期望：重定向到 `/login?from=/spools`

### TC2-AUTH-008（P1，UI 手工）登录后回跳 from

- 步骤：从 `/login?from=/catalog` 登录
- 期望：跳转回 `/catalog`

## 6.2 CATALOG

### TC2-CAT-001（P0，API 自动化）创建最小合法 Catalog

- 步骤：`POST /api/catalog`
- body：`brand`、`color_name`、`material_type`（`material` 可空）
- 期望：201，返回 `id`

### TC2-CAT-002（P1，API 自动化）创建 Catalog（含扩展字段）

- 步骤：提交 `color_hex/logo_url/nozzle_temp/...` 等字段
- 期望：201，字段持久化正确

### TC2-CAT-003（P0，API 自动化）缺少 `brand`

- 步骤：`POST /api/catalog` 不传 `brand`
- 期望：400

### TC2-CAT-004（P0，API 自动化）缺少 `material_type`

- 步骤：`POST /api/catalog` 不传 `material_type`
- 期望：400

### TC2-CAT-005（P1，API 自动化）`material_type="__custom"`

- 步骤：提交哨兵值 `__custom`
- 期望：400

### TC2-CAT-006（P0，API 自动化）列表查询（默认扁平）

- 步骤：`GET /api/catalog`
- 期望：200，数组项含 `_count.spools`

### TC2-CAT-007（P1，API 自动化）关键词查询 `q`

- 步骤：`GET /api/catalog?q=<keyword>`
- 期望：200，结果匹配 brand/material/color_name 任一字段

### TC2-CAT-008（P1，API 自动化）品牌过滤 `brand`

- 步骤：`GET /api/catalog?brand=<name>`
- 期望：200，结果品牌符合过滤条件

### TC2-CAT-009（P1，API 自动化）材料过滤 `material`

- 步骤：`GET /api/catalog?material=<name>`
- 期望：200，结果材料符合过滤条件

### TC2-CAT-010（P1，API 自动化）按材料大类过滤 `materialType`

- 步骤：`GET /api/catalog?materialType=PLA`
- 期望：200，结果 `material_type=PLA`

### TC2-CAT-011（P1，API 自动化）分组：品牌列表

- 步骤：`GET /api/catalog?groupBy=brandList`
- 期望：200，返回去重品牌与 logo

### TC2-CAT-012（P1，API 自动化）分组：品牌聚合

- 步骤：`GET /api/catalog?groupBy=brand`
- 期望：200，返回 `count/materials/materialTypes/spoolCount`

### TC2-CAT-013（P1，API 自动化）分组：材料大类

- 步骤：`GET /api/catalog?groupBy=material`
- 期望：200，返回 `material_type/subMaterialCount/brandCount/spoolCount`

### TC2-CAT-014（P1，API 自动化）分组：子材料（缺参数）

- 步骤：`GET /api/catalog?groupBy=materialType`
- 期望：400

### TC2-CAT-015（P1，API 自动化）分组：子材料（有参数）

- 步骤：`GET /api/catalog?groupBy=materialType&materialType=PLA`
- 期望：200，返回按 `material` 聚合结果

### TC2-CAT-016（P0，API 自动化）详情存在

- 步骤：`GET /api/catalog/{id}`
- 期望：200，含 `spools`（仅 ACTIVE）

### TC2-CAT-017（P1，API 自动化）详情不存在

- 步骤：`GET /api/catalog/{fakeId}`
- 期望：404

### TC2-CAT-018（P0，API 自动化）PATCH 更新

- 步骤：`PATCH /api/catalog/{id}` 更新 `color_hex`
- 期望：200，字段变化生效

### TC2-CAT-019（P0，API 自动化）删除无关联字典

- 步骤：`DELETE /api/catalog/{id}`（无 spool）
- 期望：200，`success=true`

### TC2-CAT-020（P0，API 自动化）删除有关联字典

- 步骤：先建 spool，再删该 catalog
- 期望：400，拒绝删除

### TC2-CAT-021（P1，API 自动化）品牌重命名（POST）

- 步骤：`POST /api/catalog/brand-rename` 传 `oldBrand/newBrand`
- 期望：200，返回 `updated`，对应记录品牌名更新

### TC2-CAT-022（P2，API 自动化）品牌重命名（PATCH）

- 步骤：`PATCH /api/catalog/brand-rename`
- 期望：405（方法不允许）

## 6.3 SPOOL

### TC2-SPOOL-001（P0，API 自动化）创建 Spool 成功

- 步骤：`POST /api/spools` with `global_filament_id`
- 期望：201，`status=ACTIVE`，`location_id=null`

### TC2-SPOOL-002（P0，API 自动化）创建 Spool 失败（字典不存在）

- 步骤：`POST /api/spools` with fake id
- 期望：404

### TC2-SPOOL-003（P1，API 自动化）列表过滤 ACTIVE

- 步骤：`GET /api/spools?status=ACTIVE`
- 期望：200，结果状态全部 ACTIVE

### TC2-SPOOL-004（P1，API 自动化）列表过滤 EMPTY

- 步骤：`GET /api/spools?status=EMPTY`
- 期望：200，结果状态全部 EMPTY

### TC2-SPOOL-005（P0，API 自动化）详情存在

- 步骤：`GET /api/spools/{id}`
- 期望：200，含 `globalFilament` 与 `location`

### TC2-SPOOL-006（P1，API 自动化）详情不存在

- 步骤：`GET /api/spools/{fakeId}`
- 期望：404

### TC2-SPOOL-007（P0，API 自动化）更新位置

- 步骤：`PATCH /api/spools/{id}` 设置 `location_id`
- 期望：200，返回对象位置更新

### TC2-SPOOL-008（P1，API 自动化）清空位置

- 步骤：`PATCH /api/spools/{id}` 设置 `location_id=null`
- 期望：200

### TC2-SPOOL-009（P0，API 自动化）标记 EMPTY

- 步骤：`PATCH /api/spools/{id}` 设置 `status=EMPTY`
- 期望：200，状态更新

### TC2-SPOOL-010（P1，API 自动化）非白名单字段应被忽略

- 步骤：PATCH `global_filament_id/created_at`
- 期望：200，但字段值不改变

### TC2-SPOOL-011（P1，API 自动化）更新 metadata

- 步骤：`PATCH /api/spools/{id}` 设置 `metadata`
- 期望：200，`metadata` 持久化

### TC2-SPOOL-012（P0，API 自动化）删除 Spool

- 步骤：`DELETE /api/spools/{id}`
- 期望：200，`success=true`

## 6.4 LOCATION

### TC2-LOC-001（P0，API 自动化）创建 custom 位置

- 步骤：`POST /api/locations` with `name`
- 期望：201，`type=custom`

### TC2-LOC-002（P1，API 自动化）空名称创建失败

- 步骤：`POST /api/locations` with empty `name`
- 期望：400

### TC2-LOC-003（P1，API 自动化）创建 AMS 位置成功

- 步骤：`POST /api/locations`，`type=ams_slot` + `printer_name/ams_unit/ams_slot`
- 期望：201

### TC2-LOC-004（P0，API 自动化）创建 AMS 缺字段失败

- 步骤：`POST /api/locations`，`type=ams_slot` 缺任一必填
- 期望：400

### TC2-LOC-005（P1，API 自动化）列表查询

- 步骤：`GET /api/locations`
- 期望：200，项含 `_count.spools`（ACTIVE 计数）

### TC2-LOC-006（P1，API 自动化）详情查询

- 步骤：`GET /api/locations/{id}`
- 期望：200，含 `spools` 与嵌套 `globalFilament`

### TC2-LOC-007（P1，API 自动化）更新基础字段

- 步骤：`PATCH /api/locations/{id}` 更新 `name/type`
- 期望：200

### TC2-LOC-008（P1，API 自动化）更新 AMS 缺字段失败

- 步骤：`PATCH /api/locations/{id}` 设置 `type=ams_slot` 但缺字段
- 期望：400

### TC2-LOC-009（P1，API 自动化）默认位置互斥

- 前置：至少两个 location
- 步骤：先 A 设 `is_default=true`，再 B 设 `is_default=true`
- 期望：B=true，A=false

### TC2-LOC-010（P0，API 自动化）删除位置会解绑 Spool

- 前置：某 spool 绑定该 location
- 步骤：`DELETE /api/locations/{id}`
- 期望：200；该 spool 仍存在且 `location_id=null`

### TC2-LOC-011（P1，API 自动化）删除不存在位置

- 步骤：`DELETE /api/locations/{fakeId}`
- 期望：404

## 6.5 LOGO 上传/读取

### TC2-UPLOAD-001（P0，API 自动化）上传 PNG

- 步骤：`POST /api/upload/logo` 上传 png
- 期望：201，返回 `url`，GET 该 URL 返回 `image/png`

### TC2-UPLOAD-002（P1，API 自动化）上传 SVG

- 步骤：上传 svg
- 期望：201

### TC2-UPLOAD-003（P0，API 自动化）不支持类型

- 步骤：上传 pdf/exe
- 期望：400

### TC2-UPLOAD-004（P0，API 自动化）超大文件

- 步骤：上传 >5MB
- 期望：400

### TC2-UPLOAD-005（P1，API 自动化）路径穿越防护

- 步骤：`GET /api/logos/../../../etc/passwd`
- 期望：400 或 404，不泄漏系统文件

### TC2-UPLOAD-006（P1，API 自动化）读取不存在文件

- 步骤：`GET /api/logos/nonexistent.png`
- 期望：404

---

## 7. UI 与交互回归

## 7.1 核心页面

### TC2-UI-001（P0，UI 手工）登录页

- 错误密码显示错误提示
- 正确登录写入 localStorage + cookie，并完成路由跳转

### TC2-UI-002（P0，UI 手工）Spools 列表

- `ACTIVE/EMPTY` Tab 切换正常
- 卡片展示品牌/材料/颜色/位置/日期

### TC2-UI-003（P0，UI 手工）Spool 详情 ACTIVE 操作集

- 展示按钮：`修改位置`、`标签预览`、`标记为已用完`、`删除料卷`

### TC2-UI-004（P0，UI 手工）Spool 详情 EMPTY 操作集

- 展示归档提示
- 展示按钮：`重新入库`、`删除料卷`

### TC2-UI-005（P1，UI 手工）扫码改位置

- 识别 `/location/{uuid}` 与纯 UUID 两种扫描结果
- 无效二维码显示错误提示

### TC2-UI-006（P1，UI 手工）Catalog 搜索

- 输入后约 300ms 触发查询
- 结果与关键词匹配

### TC2-UI-007（P1，UI 手工）Catalog 新建/编辑

- 品牌下拉与自定义输入正常
- 材料大类下拉与自定义输入正常
- 可折叠参数区可展开/收起

### TC2-UI-008（P1，UI 手工）Location 新建/编辑

- 类型切换正确显示字段
- `ams_slot` 时展示并校验专属字段

### TC2-UI-009（P1，UI 手工）桌面导航

- 桌面侧边栏显示一级导航
- `/catalog` 展开“品牌/材料”子导航

### TC2-UI-010（P1，UI 手工）导航隐藏规则

- `/login` 与 `*/print` 页面不显示底部导航与侧边栏

## 7.2 打印与标签

### TC2-PRINT-001（P1，UI 手工）料卷标签页可用

- 打开 `/spool/{id}/print` 正常渲染
- 可选择参数槽位并下载 PNG

### TC2-PRINT-002（P1，UI 手工）位置标签打印页

- 打开 `/location/{id}/print` 渲染 40x30mm 布局
- 页面加载自动触发打印

### TC2-PRINT-003（P2，静态验证）二维码内容正确

- 料卷二维码包含 `/spool/{id}`
- 位置二维码包含 `/location/{id}`

---

## 8. E2E 业务流

### TC2-E2E-001（P0，API+UI）新耗材入库闭环

- 流程：创建 Catalog -> 创建 Spool -> 打开料卷详情
- 期望：详情展示完整信息，状态 ACTIVE

### TC2-E2E-002（P0，API+UI）改位置闭环

- 流程：创建 Location -> 更新 Spool 位置 -> 刷新详情
- 期望：位置名正确显示

### TC2-E2E-003（P0，API+UI）归档与再入库闭环

- 流程：ACTIVE -> EMPTY -> 重新创建 ACTIVE
- 期望：旧记录保留，新记录为新 ID

### TC2-E2E-004（P1，API+UI）位置删除闭环

- 流程：绑定位置 -> 删除位置 -> 校验 spool
- 期望：spool 存在，`location_id=null`

---

## 9. 安全与边界

### TC2-EDGE-001（P1，API 自动化）超长字符串

- 在 `brand/name` 传入 1000 字符
- 期望：接口返回可控（不 500）

### TC2-EDGE-002（P1，API 自动化）并发更新同一 spool 位置

- 并发发起两次 `PATCH /api/spools/{id}`
- 期望：最终一致，不出现非法中间态

### TC2-EDGE-003（P1，UI 手工）无 `color_hex` 降级展示

- 列表与详情显示灰色占位色块，不崩溃

### TC2-EDGE-004（P1，UI 手工）无 `logo_url` 降级展示

- 使用品牌首字母占位，不影响流程

### TC2-EDGE-005（P2，API 自动化）Token 篡改

- 人工修改 token payload 或签名
- 期望：401

---

## 10. 执行建议

- PR 阶段：执行第 5 章 P0 冒烟集 + 涉及模块对应 P1 用例。
- 合并前：执行第 6 章 API 全量 + 第 8 章 E2E。
- 发布前：额外执行第 7 章打印与关键 UI 用例。

---

## 11. 与脚本的关系

- 当前脚本：`scripts/test-api.sh`
  - 默认运行 P0 冒烟集：`bash scripts/test-api.sh`
  - 完整 API 回归：`bash scripts/test-api.sh --full`
- 脚本已覆盖：
  - `material_type` 必填校验
  - Spool DELETE
  - Catalog `groupBy` 系列
  - Location AMS 与默认位置互斥
  - `POST /api/catalog/brand-rename`（并验证 PATCH=405）
  - Upload 成功/失败与路径穿越防护
