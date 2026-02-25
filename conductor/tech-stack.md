# Tech Stack — Spool Tracker

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript 5.9（严格模式） |
| 运行时 | React 19 |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide React |
| ORM | Prisma 6 |
| 数据库 | SQLite（本地文件） |
| 扫码/二维码 | html5-qrcode + qrcode.react |
| 标签导出 | html-to-image |
| 鉴权 | HMAC 签名 Token（7 天有效） |
| 部署 | Docker 多阶段构建 + docker-compose |

## 关键依赖版本

| 包 | 版本 |
|---|---|
| `next` | 16.1.6 |
| `react` | 19.2.3 |
| `@prisma/client` | ^6.19.2 |
| `radix-ui` | ^1.4.3 |
| `lucide-react` | ^0.575.0 |
| `tailwindcss` | ^4 |
| `typescript` | ^5.9.3 |

## 目录结构

```
src/
  app/           # Next.js App Router 页面 + API Routes
    api/         # REST API 端点
    (auth)/      # 鉴权路由组
    catalog/     # 耗材字典页面
    spools/      # 料卷列表页面
    spool/       # 料卷详情页面
    locations/   # 位置列表页面
    location/    # 位置详情页面
  components/    # 共享 React 组件
    ui/          # shadcn/ui 基础组件
  lib/           # 工具函数、类型定义、数据库客户端
prisma/          # Schema + 迁移文件
conductor/       # 项目文档（本目录）
```
