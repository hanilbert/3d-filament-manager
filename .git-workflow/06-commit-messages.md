# Commit Messages

## Recommended: Single Commit

```
feat(security,ui): 安全加固 + 桌面端表格视图与排序

安全改进：
- 登录接口添加 IP 级别速率限制（15 分钟窗口，最多 10 次）
- Token 改为 HttpOnly Cookie（服务端 Set-Cookie）
- 登录流程和中间件添加 open redirect 防护
- next.config 添加安全响应头（CSP、X-Frame-Options 等）
- 禁止 SVG 上传以防止存储型 XSS
- HMAC 签名验证改为 Web Crypto 常量时间比较
- Spool metadata 添加 10KB 大小限制
- 新增 TOKEN_SECRET 环境变量支持独立签名密钥

UI/UX 改进：
- 料卷列表和品牌详情页添加桌面端表格视图
- 支持服务端排序（白名单字段验证）
- 空卷轴支持重新入库和删除操作
- 品牌详情移动端按材料类型分组展示
- 位置表单添加批量创建 AMS 入口
- 位置列表添加错误状态处理

基础设施：
- Dockerfile 直接复制 prisma CLI，避免 npx 网络请求
- 所有环境缓存 Prisma 客户端实例
- 耗材删除 API 改用 Prisma 错误码处理

文档：
- 重写 README 和部署文档

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

## Rationale

Single commit chosen because:
1. Changes are a cohesive improvement batch following security audit
2. Security and UI changes are interrelated (HttpOnly cookies affect both API and client)
3. Splitting would create intermediate states with partial security
4. All changes are on the same branch (main) with no intermediate release needed
