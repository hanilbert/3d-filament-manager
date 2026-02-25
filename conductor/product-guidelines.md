# Product Guidelines — Spool Tracker

## 语气与风格

- 简洁直接，面向技术用户
- 中文界面，专业术语保持英文（如 AMS、GTIN、QR Code）
- 错误信息要具体，告知用户下一步操作

## 设计原则

1. **移动端优先**：核心操作（扫码、改位置）必须在手机上一手操作完成
2. **简洁胜于功能**：不添加用户未要求的功能
3. **本地优先**：数据存本地，无需网络依赖
4. **快速响应**：列表页加载 < 1s，扫码识别 < 2s

## UI 规范

- 颜色：遵循 shadcn/ui 主题变量，不硬编码颜色值
- 间距：使用 Tailwind 标准间距（4/8/12/16/24px）
- 图标：统一使用 Lucide React
- 状态徽章：ACTIVE=绿色，EMPTY=灰色

## API 规范

- RESTful 风格，资源名用复数（`/api/spools`, `/api/locations`）
- 错误响应统一格式：`{ error: string }`
- 成功响应直接返回数据对象或数组
- 所有写操作（POST/PUT/DELETE）必须验证 HMAC Token
