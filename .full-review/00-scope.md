# 审查范围

## 目标

对整个 3D Filament Manager 代码库进行全面的安全与性能审查，包括：
- 性能瓶颈（O(n²) 算法、N+1 查询、内存泄漏、缺失缓存）
- 安全漏洞（硬编码凭证、输入验证缺失、错误处理缺陷）
- 架构问题（组件边界、模块内聚度、依赖管理）

## 文件清单

### 核心基础设施 (6 个文件)
- `prisma/schema.prisma` - 数据库模式定义
- `prisma/backfill-material-type.ts` - 数据迁移脚本
- `src/middleware.ts` - Next.js 中间件
- `src/lib/db.ts` - 数据库连接
- `src/lib/auth.ts` - 认证逻辑
- `src/lib/api-auth.ts` - API 认证中间件

### API 路由 (11 个文件)
- `src/app/api/auth/login/route.ts` - 登录接口
- `src/app/api/auth/logout/route.ts` - 登出接口
- `src/app/api/filaments/route.ts` - 耗材 CRUD + 聚合
- `src/app/api/filaments/[id]/route.ts` - 单个耗材操作
- `src/app/api/filaments/brand-rename/route.ts` - 品牌重命名
- `src/app/api/locations/route.ts` - 位置 CRUD
- `src/app/api/locations/[id]/route.ts` - 单个位置操作
- `src/app/api/spools/route.ts` - 线轴 CRUD
- `src/app/api/spools/[id]/route.ts` - 单个线轴操作
- `src/app/api/upload/logo/route.ts` - Logo 上传
- `src/app/api/logos/[filename]/route.ts` - Logo 读取

### 页面组件 (18 个文件)
- `src/app/page.tsx` - 主页仪表板
- `src/app/(auth)/login/page.tsx` - 登录页
- `src/app/filaments/page.tsx` - 耗材列表
- `src/app/filaments/[id]/page.tsx` - 耗材详情
- `src/app/filaments/[id]/edit/page.tsx` - 耗材编辑
- `src/app/filaments/new/page.tsx` - 新建耗材
- `src/app/filaments/materials/page.tsx` - 材料列表
- `src/app/filaments/material/[material]/page.tsx` - 材料详情
- `src/app/filaments/brand/[brand]/page.tsx` - 品牌详情
- `src/app/locations/page.tsx` - 位置列表
- `src/app/locations/new/page.tsx` - 新建位置
- `src/app/locations/bulk-ams/page.tsx` - 批量 AMS 创建
- `src/app/location/[id]/page.tsx` - 位置详情
- `src/app/location/[id]/edit/page.tsx` - 位置编辑
- `src/app/location/[id]/print/page.tsx` - 位置标签打印
- `src/app/spools/page.tsx` - 线轴列表
- `src/app/spools/[id]/page.tsx` - 线轴详情
- `src/app/spools/details/[id]/page.tsx` - 线轴详细信息

### 核心组件 (30+ 个文件)
- `src/components/CatalogForm.tsx` - 耗材目录表单
- `src/components/GlobalScanDialog.tsx` - 全局扫码对话框
- `src/components/LocationForm.tsx` - 位置表单
- `src/components/QRScanner.tsx` - 二维码扫描器
- `src/components/SideNav.tsx` - 侧边导航
- `src/components/BottomNav.tsx` - 底部导航
- 以及其他 UI 组件和布局组件

### 工具库 (15+ 个文件)
- `src/lib/types.ts` - 类型定义
- `src/lib/utils.ts` - 通用工具函数
- `src/lib/fetch.ts` - HTTP 请求封装
- `src/lib/filaments-query.ts` - 耗材查询工具
- `src/lib/scan-target.ts` - 扫码目标解析
- `src/lib/spool-detail.ts` - 线轴详情工具
- `src/lib/location-types.ts` - 位置类型工具
- `src/lib/brand-logo.ts` - 品牌 Logo 工具
- `src/lib/image-signature.ts` - 图片签名工具
- `src/lib/data-repair.ts` - 数据修复工具
- `src/lib/theme.ts` - 主题工具
- 等等

### 测试文件 (10+ 个文件)
- 各种单元测试和集成测试

**总计：约 95 个 TypeScript/TSX 文件**

## 标志

- 安全重点: **是**
- 性能关键: **是**
- 严格模式: 否
- 框架: **Next.js 15 + React 19 + TypeScript + Prisma + SQLite**

## 审查阶段

1. 代码质量与架构审查
2. 安全与性能审查
3. 测试与文档审查
4. 最佳实践与标准审查
5. 综合报告生成
