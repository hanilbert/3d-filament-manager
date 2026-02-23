# Spool Tracker — 测试用例文档

**版本**: v1.0
**覆盖范围**: API 接口测试 + UI/功能测试 + E2E 工作流测试

---

## 目录

1. [测试环境准备](#1-测试环境准备)
2. [认证模块测试](#2-认证模块测试)
3. [全局耗材字典 API 测试](#3-全局耗材字典-api-测试)
4. [料卷 API 测试](#4-料卷-api-测试)
5. [位置 API 测试](#5-位置-api-测试)
6. [文件上传 API 测试](#6-文件上传-api-测试)
7. [UI/页面功能测试](#7-ui页面功能测试)
8. [E2E 工作流测试](#8-e2e-工作流测试)
9. [边界与异常测试](#9-边界与异常测试)
10. [打印功能测试](#10-打印功能测试)

---

## 1. 测试环境准备

### 1.1 本地环境启动

```bash
npm run dev
# 默认密码：dev123
# 访问地址：http://localhost:3000
```

### 1.2 获取测试 Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "dev123"}'

# 返回：{"token": "xxx-xxx-xxx", "expiresAt": 1234567890}
# 保存 token 用于后续 API 测试
export TOKEN="xxx-xxx-xxx"
```

### 1.3 测试数据约定

- 使用真实 UUID 格式（`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
- 测试后清理创建的测试数据，避免污染开发数据库

---

## 2. 认证模块测试

### TC-AUTH-001：正确密码登录

**输入**：`POST /api/auth/login` `{"password": "dev123"}`
**期望**：
- HTTP 200
- 返回 `{ token: string, expiresAt: number }`
- token 为非空字符串

### TC-AUTH-002：错误密码登录

**输入**：`POST /api/auth/login` `{"password": "wrongpassword"}`
**期望**：
- HTTP 401
- 返回 `{ error: "..." }`
- 不返回 token

### TC-AUTH-003：空密码登录

**输入**：`POST /api/auth/login` `{"password": ""}`
**期望**：
- HTTP 401

### TC-AUTH-004：无 Token 访问受保护 API

**输入**：`GET /api/catalog`（无 Authorization Header）
**期望**：
- HTTP 401

### TC-AUTH-005：过期/无效 Token 访问受保护 API

**输入**：`GET /api/catalog` `Authorization: Bearer invalidtoken`
**期望**：
- HTTP 401

### TC-AUTH-006：页面路由鉴权（未登录）

**操作**：清除 Cookie，直接访问 `http://localhost:3000/spools`
**期望**：
- 自动重定向到 `/login?from=/spools`

> **🐛 已修复（2026-02-22）**：`src/proxy.ts` 中间件在 Edge Runtime 调用了依赖 Node.js Runtime 内存的 `verifyToken()`，导致即使登录成功、设置了 Cookie 之后，中间件仍然因 token 查不到而把所有请求重定向回登录页，表现为"登录按钮闪烁一下然后无反应"。修复方案：中间件只检查 Cookie 是否存在，真正的 token 有效性验证仍由 API 路由层（Node.js Runtime）负责。

### TC-AUTH-007：登录后跳转回原页面

**操作**：访问 `/spools` 被重定向到 `/login?from=/spools` → 登录成功
**期望**：
- 登录成功后跳转回 `/spools`（而非固定跳转 `/spools`）

> **🐛 已修复（2026-02-22）**：登录页忽略了 `from` 查询参数，始终硬编码跳转到 `/spools`。修复方案：读取 `useSearchParams().get("from")` 并在成功登录后跳转到该地址；同时移除了多余的 `router.refresh()` 调用（该调用可能干扰正在进行中的 `router.push()` 导航）。

---

## 3. 全局耗材字典 API 测试

### TC-CAT-001：新建耗材字典（必填字段）

**输入**：
```bash
curl -X POST http://localhost:3000/api/catalog \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "brand": "Bambu Lab",
    "material": "PLA Matte",
    "color_name": "草绿 11500",
    "nozzle_temp": "190-230°C",
    "bed_temp": "35-45°C",
    "print_speed": "≤300 mm/s"
  }'
```
**期望**：
- HTTP 201
- 返回含 `id`（UUID 格式）、所有填写字段、`created_at` 的完整对象

### TC-CAT-002：新建耗材字典（含可选字段）

**输入**：在 TC-CAT-001 基础上增加 `"color_hex": "#5C8A3C"` 和 `"logo_url": "https://example.com/logo.png"`
**期望**：
- HTTP 201
- 返回对象中 `color_hex` 和 `logo_url` 值正确

### TC-CAT-003：新建耗材字典（缺少必填字段）

**输入**：缺少 `brand` 字段
**期望**：
- HTTP 400
- 返回错误信息指明缺少字段

### TC-CAT-004：获取字典列表

**输入**：`GET /api/catalog`
**期望**：
- HTTP 200
- 返回数组，每条记录含 `_count.spools`（关联料卷数）

### TC-CAT-005：按品牌搜索

**输入**：`GET /api/catalog?brand=Bambu+Lab`
**期望**：
- HTTP 200
- 返回数组，所有记录 `brand` 均为 "Bambu Lab"

### TC-CAT-006：按关键词搜索

**输入**：`GET /api/catalog?q=草绿`
**期望**：
- HTTP 200
- 返回数组，颜色名或品牌名或材质名包含"草绿"

### TC-CAT-007：获取字典详情

**前置**：使用 TC-CAT-001 创建的 ID
**输入**：`GET /api/catalog/{id}`
**期望**：
- HTTP 200
- 返回单个对象，含 `spools` 数组（关联的 ACTIVE 料卷）

### TC-CAT-008：获取不存在的字典

**输入**：`GET /api/catalog/00000000-0000-0000-0000-000000000000`
**期望**：
- HTTP 404

### TC-CAT-009：更新耗材字典

**输入**：`PATCH /api/catalog/{id}` `{"color_hex": "#FF0000"}`
**期望**：
- HTTP 200
- 返回更新后的对象，`color_hex` 为 "#FF0000"，其他字段不变

### TC-CAT-010：删除无关联料卷的字典

**前置**：创建字典（无 Spool 关联）
**输入**：`DELETE /api/catalog/{id}`
**期望**：
- HTTP 200

### TC-CAT-011：删除有关联料卷的字典

**前置**：创建字典，创建关联 Spool
**输入**：`DELETE /api/catalog/{id}`
**期望**：
- HTTP 400
- 返回错误信息，提示存在关联 Spool

---

## 4. 料卷 API 测试

### TC-SPOOL-001：创建料卷

**前置**：已有 GlobalFilament 记录（取其 id 为 `{filamentId}`）
**输入**：
```bash
curl -X POST http://localhost:3000/api/spools \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"global_filament_id": "{filamentId}"}'
```
**期望**：
- HTTP 201
- 返回含 `id`（UUID）、`status: "ACTIVE"`、`location_id: null` 的对象

### TC-SPOOL-002：创建料卷（globalFilament 不存在）

**输入**：`{"global_filament_id": "00000000-0000-0000-0000-000000000000"}`
**期望**：
- HTTP 404 或 400

### TC-SPOOL-003：获取 ACTIVE 料卷列表

**输入**：`GET /api/spools?status=ACTIVE`
**期望**：
- HTTP 200
- 所有返回记录 `status` 均为 `"ACTIVE"`
- 每条记录含嵌套的 `globalFilament` 和 `location`（可为 null）对象

### TC-SPOOL-004：获取 EMPTY 料卷列表

**输入**：`GET /api/spools?status=EMPTY`
**期望**：
- HTTP 200
- 所有返回记录 `status` 均为 `"EMPTY"`

### TC-SPOOL-005：获取料卷详情

**输入**：`GET /api/spools/{id}`
**期望**：
- HTTP 200
- 含完整的 `globalFilament` 信息（品牌、材质、温度等）
- 含 `location` 信息（可为 null）

### TC-SPOOL-006：更新料卷位置

**前置**：已有 Location 记录（取其 id 为 `{locationId}`）
**输入**：`PATCH /api/spools/{id}` `{"location_id": "{locationId}"}`
**期望**：
- HTTP 200
- 返回对象中 `location_id` 更新为 `{locationId}`

### TC-SPOOL-007：清除料卷位置

**输入**：`PATCH /api/spools/{id}` `{"location_id": null}`
**期望**：
- HTTP 200
- 返回对象中 `location_id` 为 null

### TC-SPOOL-008：标记料卷为已用完

**输入**：`PATCH /api/spools/{id}` `{"status": "EMPTY"}`
**期望**：
- HTTP 200
- 返回对象中 `status` 为 `"EMPTY"`

### TC-SPOOL-009：更新非白名单字段（应被忽略）

**输入**：`PATCH /api/spools/{id}` `{"global_filament_id": "other-id", "created_at": "2020-01-01"}`
**期望**：
- HTTP 200（不报错）
- 但 `global_filament_id` 和 `created_at` 未被修改

---

## 5. 位置 API 测试

### TC-LOC-001：创建位置

**输入**：
```bash
curl -X POST http://localhost:3000/api/locations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "防潮箱 A"}'
```
**期望**：
- HTTP 201
- 返回含 `id`（UUID）和 `name` 的对象

### TC-LOC-002：创建位置（缺少名称）

**输入**：`{"name": ""}` 或空 body
**期望**：
- HTTP 400

### TC-LOC-003：获取位置列表

**输入**：`GET /api/locations`
**期望**：
- HTTP 200
- 每条记录含 `_count.spools`（该位置下的 ACTIVE 料卷数）

### TC-LOC-004：获取位置详情

**输入**：`GET /api/locations/{id}`
**期望**：
- HTTP 200
- 含 `spools` 数组（位置下的 ACTIVE 料卷，含嵌套的 `globalFilament` 信息）

### TC-LOC-005：更新位置名称

**输入**：`PATCH /api/locations/{id}` `{"name": "防潮箱 B"}`
**期望**：
- HTTP 200
- 返回 `name` 更新后的对象

### TC-LOC-006：删除有料卷的位置

**前置**：位置下有 Spool 关联
**输入**：`DELETE /api/locations/{id}`
**期望**：
- HTTP 200
- 位置被删除
- 原关联 Spool 的 `location_id` 被置为 null（Spool 本身不删除）

**验证**：
```bash
# 验证 Spool 仍存在但 location_id 为 null
curl http://localhost:3000/api/spools/{spoolId} -H "Authorization: Bearer $TOKEN"
```

### TC-LOC-007：删除不存在的位置

**输入**：`DELETE /api/locations/00000000-0000-0000-0000-000000000000`
**期望**：
- HTTP 404

---

## 6. 文件上传 API 测试

### TC-UPLOAD-001：上传合法 PNG Logo

**输入**：
```bash
curl -X POST http://localhost:3000/api/upload/logo \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/logo.png"
```
**期望**：
- HTTP 200
- 返回 `{ path: "/api/logos/{uuid}.png" }`
- 访问该 path 能正常返回图片

### TC-UPLOAD-002：上传合法 SVG Logo

**输入**：上传 `.svg` 文件
**期望**：
- HTTP 200
- 返回正确的 path

### TC-UPLOAD-003：上传不支持的文件类型

**输入**：上传 `.exe` 或 `.pdf` 文件
**期望**：
- HTTP 400
- 返回错误信息，指明文件类型不支持

### TC-UPLOAD-004：上传超过 5MB 的文件

**输入**：上传 > 5MB 的图片
**期望**：
- HTTP 400
- 返回文件大小超限的错误信息

### TC-UPLOAD-005：路径穿越攻击防护

**输入**：`GET /api/logos/../../../etc/passwd`
**期望**：
- HTTP 400 或 404（basename 过滤后文件不存在）
- 不返回任何系统文件内容

### TC-UPLOAD-006：访问不存在的 Logo

**输入**：`GET /api/logos/nonexistent-file.png`
**期望**：
- HTTP 404

---

## 7. UI/页面功能测试

### TC-UI-001：登录页面

**步骤**：
1. 访问 `http://localhost:3000/login`
2. 输入错误密码，点击登录

**期望**：
- 显示错误提示（不刷新页面）

**步骤**：
3. 输入正确密码 `dev123`，点击登录

**期望**：
- 跳转到 `/spools`
- localStorage 中有 `spool_tracker_token`
- Cookie 中有 `spool_tracker_token`

---

### TC-UI-002：料卷列表页

**前置**：存在 ACTIVE 和 EMPTY 料卷各至少 1 条

**步骤**：
1. 访问 `/spools`

**期望**：
- 显示「使用中」和「已归档」两个 Tab
- 「使用中」Tab 显示 ACTIVE 料卷列表
- 每条显示颜色色块（有 hex）或灰色占位（无 hex）、品牌/材质/颜色名、位置、入库时间

**步骤**：
2. 点击「已归档」Tab

**期望**：
- 显示 EMPTY 料卷列表

---

### TC-UI-003：料卷详情页（ACTIVE 状态）

**步骤**：
1. 访问 ACTIVE 料卷的 `/spool/{id}`

**期望**：
- 显示：品牌 Logo（若有）、品牌/材质/颜色名、颜色色块（若有 hex）、打印参数、当前位置、入库时间、「使用中」状态标签
- 显示三个操作按钮：「修改位置」、「打印标签」、「标记为已用完」
- 按钮高度 ≥ 48px（大按钮原则）

---

### TC-UI-004：料卷详情页（EMPTY 状态）

**步骤**：
1. 访问 EMPTY 料卷的 `/spool/{id}`

**期望**：
- 页面顶部显示黄色/橙色警告横幅「⚠️ 此耗材已归档（已用完）」
- 显示「重新入库」按钮
- 不显示「修改位置」和「标记为已用完」按钮

---

### TC-UI-005：标记料卷已用完（含确认弹窗）

**步骤**：
1. 在 ACTIVE 料卷详情页，点击「标记为已用完」

**期望**：
- 弹出确认对话框，显示确认和取消按钮

**步骤**：
2. 点击「取消」

**期望**：
- 弹窗关闭，料卷状态不变

**步骤**：
3. 再次点击「标记为已用完」→ 点击「确认」

**期望**：
- 弹窗关闭
- 页面更新为 EMPTY 状态（显示归档横幅）
- 「修改位置」等按钮消失

---

### TC-UI-006：重新入库

**步骤**：
1. 在 EMPTY 料卷详情页，点击「重新入库」

**期望**：
- 跳转到新创建的 ACTIVE 料卷详情页（URL 为新的 `/spool/{newId}`）
- 新料卷关联同一 GlobalFilament
- 新料卷 status=ACTIVE，location_id=null

---

### TC-UI-007：字典列表搜索

**步骤**：
1. 访问 `/catalog`
2. 在搜索框输入"Bambu"

**期望**：
- 输入后约 300ms，列表自动过滤，只显示品牌/材质/颜色名包含"Bambu"的条目
- 无需按回车

---

### TC-UI-008：新建耗材字典（Logo 上传）

**步骤**：
1. 访问 `/catalog/new`
2. 填写所有必填字段
3. 在 Logo 区域选择「上传文件」Tab，选择一个 PNG 文件
4. 点击「上传」按钮
5. 提交表单

**期望**：
- 上传成功后，Logo 预览区显示上传的图片
- 提交后跳转到新字典的详情页
- 详情页显示上传的品牌 Logo

---

### TC-UI-009：位置列表新建位置

**步骤**：
1. 访问 `/locations`
2. 点击「新建位置」或展开内联表单
3. 输入名称「防潮箱 A」
4. 提交

**期望**：
- 位置列表中出现「防潮箱 A」
- 显示该位置下的料卷数量（初始为 0）

---

### TC-UI-010：位置详情页内联编辑名称

**步骤**：
1. 访问 `/location/{id}`
2. 点击编辑按钮
3. 修改名称为「防潮箱 B」
4. 保存

**期望**：
- 名称更新为「防潮箱 B」

---

### TC-UI-011：底部导航显示/隐藏

**步骤**：
1. 访问 `/spools`

**期望**：
- 页面底部显示底部导航（料卷、字典、位置 三个 Tab）

**步骤**：
2. 访问 `/login`

**期望**：
- 无底部导航

**步骤**：
3. 访问 `/spool/{id}/print`

**期望**：
- 无底部导航（纯打印页面）

---

## 8. E2E 工作流测试

### TC-E2E-001：完整入库工作流

**步骤**：
1. 访问 `/catalog/new`，新建字典「eSUN PETG 透明」，含 `color_hex: "#E8F4F8"`
2. 在字典详情页点击「加入我的料卷」
3. 验证跳转到新 Spool 详情页，status=ACTIVE，无位置
4. 访问 `/locations`，创建位置「货架 1 号」
5. 访问 `/location/{locationId}/print`，验证打印页可以显示
6. 回到 Spool 详情页，点击「打印标签」，验证跳转到打印页

**期望**：全流程无报错，数据正确

---

### TC-E2E-002：扫码更新位置（模拟扫码）

> 注意：本地 HTTP 环境不支持真实扫码，通过 API 模拟

**步骤**：
1. 有一个 ACTIVE Spool（id=`{spoolId}`）
2. 有一个 Location（id=`{locationId}`）
3. 调用 `PATCH /api/spools/{spoolId}` `{"location_id": "{locationId}"}`
4. 访问 `/spool/{spoolId}`

**期望**：
- 详情页显示「当前位置：货架 1 号」

---

### TC-E2E-003：耗材用完后重新入库

**步骤**：
1. 将 Spool A 的 status 设为 EMPTY（调用 PATCH API）
2. 访问 `/spool/{spoolAId}`，确认显示「已归档」横幅
3. 点击「重新入库」
4. 记录新的 Spool B 的 id

**期望**：
- Spool B 关联同一 GlobalFilament
- Spool B status=ACTIVE，location_id=null
- Spool A 仍存在（status=EMPTY，数据未删除）

---

### TC-E2E-004：删除位置后料卷状态

**步骤**：
1. 创建位置「临时位置」
2. 将 Spool 的 location_id 设为该位置
3. 验证 Spool 详情显示「临时位置」
4. 删除「临时位置」（调用 DELETE API）
5. 重新查看 Spool 详情

**期望**：
- Spool 仍存在
- Spool 的位置显示「暂未分配位置」（location_id 为 null）

---

## 9. 边界与异常测试

### TC-EDGE-001：color_hex 为空时 UI 降级

**前置**：创建字典时不填 `color_hex`
**期望**：
- 料卷列表、详情页中，颜色色块区域显示灰色占位
- 系统正常运行，无报错

### TC-EDGE-002：无 Logo 时 UI 降级

**前置**：创建字典时不填 `logo_url`
**期望**：
- 详情页不显示 Logo 区域或显示占位图
- 系统正常运行，无报错

### TC-EDGE-003：料卷无位置时的展示

**前置**：Spool.location_id = null
**期望**：
- 料卷列表中位置字段显示「未分配」
- 料卷详情页位置字段显示「暂未分配位置」

### TC-EDGE-004：字典列表为空

**前置**：数据库中无 GlobalFilament 记录
**期望**：
- `/catalog` 显示空状态（如"暂无数据"提示）
- 不报错、不崩溃

### TC-EDGE-005：料卷列表为空

**前置**：无 ACTIVE 料卷
**期望**：
- `/spools` 的「使用中」Tab 显示空状态
- 不报错、不崩溃

### TC-EDGE-006：同时发送多个 PATCH 请求（并发）

**输入**：对同一 Spool 并发发送两个不同的 location_id 更新
**期望**：
- 最终 location_id 为其中一个（SQLite 串行写入保证一致性）
- 不出现数据损坏

### TC-EDGE-007：超长字符串输入

**输入**：`brand` 字段填入 1000 个字符的字符串
**期望**：
- API 层有长度校验，返回 400；或数据库层接受（SQLite TEXT 无长度限制）
- 不出现 500 内部错误

---

## 10. 打印功能测试

### TC-PRINT-001：料卷标签打印页正确渲染

**步骤**：
1. 访问 `/spool/{id}/print`（该 Spool 有 color_hex 和 logo_url）

**期望**：
- 页面宽度约为 40mm 对应的像素
- 左侧显示品牌 Logo、材质名称（色块背景）、打印参数、颜色名
- 右侧显示二维码
- 二维码内容为 `{BASE_URL}/spool/{id}`

### TC-PRINT-002：料卷标签打印页（无 color_hex）

**前置**：Spool 关联的 GlobalFilament 无 color_hex
**步骤**：
1. 访问 `/spool/{id}/print`

**期望**：
- 材质名称区域无背景色（或白色背景）
- 页面正常渲染，无报错

### TC-PRINT-003：料卷标签打印页 color_hex 对比度

**前置**：
- 测试深色背景：`color_hex: "#1A1A1A"`（应显示白色文字）
- 测试浅色背景：`color_hex: "#FFFFFF"`（应显示黑色文字）

**期望**：
- 深色背景时文字为白色
- 浅色背景时文字为黑色

### TC-PRINT-004：位置标签打印页正确渲染

**步骤**：
1. 访问 `/location/{id}/print`

**期望**：
- 显示位置名称（大字体）
- 显示二维码，内容为 `{BASE_URL}/location/{id}`
- 页面加载后自动触发打印对话框（`window.print()`）

### TC-PRINT-005：打印页无底部导航

**步骤**：
1. 访问 `/spool/{id}/print`

**期望**：
- 页面无底部导航栏
- 页面无顶部导航栏
- 仅显示标签内容

---

## 测试执行记录模板

| 用例 ID | 测试日期 | 执行人 | 结果 | 备注 |
|---------|---------|--------|------|------|
| TC-AUTH-001 | | | Pass/Fail | |
| TC-AUTH-002 | | | Pass/Fail | |
| ... | | | | |

---

## 已知测试限制

1. **扫码功能**：`html5-qrcode` 要求 HTTPS，本地开发环境无法真实测试，需通过 API 调用模拟位置更新
2. **打印测试**：CSS `@page` 打印样式需在实际连接热敏打印机的设备上验证
3. **移动端测试**：需在真实手机浏览器（Chrome for Android / Safari for iOS）上测试大按钮可点击性
