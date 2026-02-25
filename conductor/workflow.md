# Workflow — Spool Tracker

## Git 工作流

- 原子化提交：每完成一个小功能点即提交
- 提交规范：Conventional Commits（`feat:`, `fix:`, `refactor:`, `test:`, `chore:`）
- 无需确认：代码无报错即直接提交

## 开发规范

- TypeScript 严格模式，禁止 `any` 类型
- Tailwind CSS v4 样式，禁止内联 style
- shadcn/ui 组件库，优先复用现有组件
- Prisma ORM 数据访问，禁止裸 SQL
- Next.js App Router 路由，Server Component 优先

## 测试策略

- 单元测试：Vitest（lib/ 工具函数）
- 集成测试：API Routes 关键路径
- 以 `npm run build` 验证编译通过为基准
- 测试文件放在 `src/__tests__/` 目录

## TDD 策略

- 灵活模式：复杂逻辑优先写测试
- 新增 API Route 必须有对应测试
- 工具函数（lib/）必须有单元测试

## 验证检查点

- 每个 Track 完成后手动验证
- 每次提交前运行 `npm run build`
- 重要功能变更后运行 `npm run lint`

## Track 生命周期

```
pending → in_progress → review → completed
```
