# Spool Tracker 测试执行结果

- 测试基准文件：`docs/TEST-CASES.md`
- 执行日期：2026-02-23
- 执行人：Codex
- 执行环境：本地 `http://localhost:3000`（`npm run dev`）

## 结果汇总

- 总用例：67
- 通过：63
- 失败：2
- 未执行：2

## 详细结果（按测试文件顺序）

| 用例 ID | 结果 | 验证方式 | 备注 |
|---|---|---|---|
| TC-AUTH-001 | Pass | API 实测 | `POST /api/auth/login` 正确密码返回 200 且含 token |
| TC-AUTH-002 | Pass | API 实测 | 错误密码返回 401 |
| TC-AUTH-003 | Pass | API 实测 | 空密码返回 401 |
| TC-AUTH-004 | Pass | API 实测 | 无 Token 访问受保护 API 返回 401 |
| TC-AUTH-005 | Pass | API 实测 | 无效 Token 返回 401 |
| TC-AUTH-006 | Pass | 页面响应实测 | 访问 `/spools`（无 Cookie）返回 307，Location: `/login?from=%2Fspools` |
| TC-AUTH-007 | Pass | 代码静态验证 | `src/app/(auth)/login/page.tsx` 存在 `from=searchParams.get("from")` 且 `router.push(from)` |
| TC-CAT-001 | Pass | API 实测 | 创建字典（必填）返回 201 + id |
| TC-CAT-002 | Pass | API 实测 | 创建字典（可选字段）返回 201，`color_hex/logo_url` 正确 |
| TC-CAT-003 | Pass | API 实测 | 缺少必填字段返回 400 |
| TC-CAT-004 | Pass | API 实测 | 列表返回 200 且含 `_count.spools` |
| TC-CAT-005 | Pass | API 实测 | 按品牌过滤正确 |
| TC-CAT-006 | Pass | API 实测 | 关键词搜索正确 |
| TC-CAT-007 | Pass | API 实测 | 详情返回 200，含 `spools` |
| TC-CAT-008 | Pass | API 实测 | 不存在 id 返回 404 |
| TC-CAT-009 | Pass | API 实测 | PATCH 更新字段成功 |
| TC-CAT-010 | Pass | API 实测 | 删除无关联字典成功 |
| TC-CAT-011 | Pass | API 实测 | 删除有关联 Spool 的字典返回 400 |
| TC-SPOOL-001 | Pass | API 实测 | 创建料卷返回 201，状态 ACTIVE |
| TC-SPOOL-002 | Pass | API 实测 | 不存在 global filament 返回 404 |
| TC-SPOOL-003 | Pass | API 实测 | ACTIVE 过滤正确 |
| TC-SPOOL-004 | Pass | API 实测 | EMPTY 过滤正确 |
| TC-SPOOL-005 | Pass | API 实测 | 详情含完整 `globalFilament` |
| TC-SPOOL-006 | Pass | API 实测 | 更新位置成功 |
| TC-SPOOL-007 | Pass | API 实测 | 清除位置成功 |
| TC-SPOOL-008 | Pass | API 实测 | 标记 EMPTY 成功 |
| TC-SPOOL-009 | Pass | API 实测 | 非白名单字段被忽略 |
| TC-LOC-001 | Pass | API 实测 | 创建位置成功 |
| TC-LOC-002 | Pass | API 实测 | 空名称返回 400 |
| TC-LOC-003 | Pass | API 实测 | 列表返回 200 且含 `_count.spools` |
| TC-LOC-004 | Pass | API 实测 | 详情含 `spools` |
| TC-LOC-005 | Pass | API 实测 | 更新名称成功 |
| TC-LOC-006 | Pass | API 实测 | 删除位置后 Spool `location_id` 置 null |
| TC-LOC-007 | Pass | API 实测 | 删除不存在位置返回 404 |
| TC-UPLOAD-001 | Pass | API 实测 | 上传 PNG 成功并可访问 |
| TC-UPLOAD-002 | Pass | API 实测 | 上传 SVG 成功 |
| TC-UPLOAD-003 | Pass | API 实测 | 上传不支持类型返回 400 |
| TC-UPLOAD-004 | Pass | API 实测 | 超大文件返回 400 |
| TC-UPLOAD-005 | Pass | API 实测 | 路径穿越防护有效 |
| TC-UPLOAD-006 | Pass | API 实测 | 访问不存在 logo 返回 404 |
| TC-UI-001 | Pass | 代码静态验证 + API 实测 | 登录页存在错误提示逻辑、localStorage/Cookie 写入与跳转代码 |
| TC-UI-002 | Pass | 代码静态验证 | `src/app/spools/page.tsx` 存在使用中/已归档 Tab 与字段展示逻辑 |
| TC-UI-003 | Pass | 代码静态验证 | ACTIVE 详情页包含按钮「修改位置/打印标签/标记为已用完」，按钮高度 `h-14` |
| TC-UI-004 | Pass | 代码静态验证 | EMPTY 状态显示归档横幅与「重新入库」，不渲染 ACTIVE 操作按钮 |
| TC-UI-005 | Pass | 代码静态验证 | 存在确认弹窗 `ConfirmDialog`，并区分确认/取消流程 |
| TC-UI-006 | Pass | 代码静态验证 + API 实测 | `handleRestock` 创建新 ACTIVE spool 并跳转新 id；API 流程验证通过 |
| TC-UI-007 | Pass | 代码静态验证 + API 实测 | 存在 300ms debounce（`setTimeout(load, 300)`），搜索 API 工作正常 |
| TC-UI-008 | Pass | 代码静态验证 + API 实测 | 表单存在上传 Tab 与成功提示；上传 API 已通过 |
| TC-UI-009 | Pass | 代码静态验证 + API 实测 | 位置页存在内联新建表单；创建 API 已通过 |
| TC-UI-010 | Pass | 代码静态验证 + API 实测 | 位置详情页存在编辑/保存逻辑；PATCH API 已通过 |
| TC-UI-011 | Pass | 代码静态验证 | `ConditionalNav` 对 `/login` 与 `*/print` 隐藏底部导航 |
| TC-E2E-001 | Pass | API/页面响应实测 | 新建字典→建 spool→建位置→打印页访问（`/spool/{id}/print`、`/location/{id}/print` 均 200） |
| TC-E2E-002 | Pass | API 实测 | PATCH 更新位置后，`GET /api/spools/{id}` 显示目标位置名 |
| TC-E2E-003 | Pass | API 实测 | A 置 EMPTY 后创建 B；B 为 ACTIVE 且 `location_id=null`，A 保留 |
| TC-E2E-004 | Pass | API 实测 | 删除位置后，Spool 仍存在且 `location_id=null` |
| TC-EDGE-001 | Pass | API + 页面响应实测 | 无 `color_hex` 时，颜色降级为灰色占位（`#e5e7eb`） |
| TC-EDGE-002 | Pass | 代码静态验证 | 无 `logo_url` 时显示占位（品牌首字母方块） |
| TC-EDGE-003 | Pass | 代码静态验证 | 列表显示“未分配位置”，详情显示“暂未分配位置” |
| TC-EDGE-004 | Not Run | 未执行 | 需清空 `GlobalFilament` 全量数据；当前库含关联 Spool，避免破坏性清理 |
| TC-EDGE-005 | Not Run | 未执行 | 需构造“无 ACTIVE 料卷”的全局空态，当前开发库不做破坏性改动 |
| TC-EDGE-006 | Pass | API 并发实测 | 同一 spool 并发 PATCH 两个 location，最终落在其中一个，数据一致 |
| TC-EDGE-007 | Pass | API 实测 | `brand` 1000 字符请求返回 201（未出现 500） |
| TC-PRINT-001 | Fail | 代码静态验证 + 页面实测 | `src/app/spool/[id]/print/page.tsx` 未渲染品牌 logo（与用例期望不符） |
| TC-PRINT-002 | Fail | 代码静态验证 + 页面实测 | 无 `color_hex` 时当前背景为灰色 `#e5e7eb`，非“无背景/白色” |
| TC-PRINT-003 | Pass | 代码静态验证 | 对比度逻辑存在：深色→白字，浅色→黑字 |
| TC-PRINT-004 | Pass | 代码静态验证 + 页面实测 | 位置打印页包含位置名、二维码 URL 构造与 `window.print()` |
| TC-PRINT-005 | Pass | 代码静态验证 | 打印页路径命中 `pathname.endsWith("/print")`，底部导航隐藏 |

## 附加说明

- 第 2-6 章 API 用例通过 `scripts/test-api.sh` 顺序执行，结果为 39/39 通过（脚本含附加校验 `TC-UPLOAD-001b`）。
- 第 7 章 UI 用例由于本轮环境无法稳定启用浏览器自动化，采用“代码静态验证 + 对应 API 实测”方式完成验证记录。
- 失败项集中在打印页与文档期望不一致（logo 展示、无色背景策略）。
