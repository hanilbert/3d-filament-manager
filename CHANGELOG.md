# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-01

### Added

#### 核心功能
- 料卷生命周期管理（ACTIVE/EMPTY 状态切换、重新入库、删除）
- 耗材字典管理（品牌、材料、颜色与完整打印参数档案）
- 品牌与材料分层浏览（品牌页、材料大类页、子材料页）
- 位置管理系统（货架/打印机/AMS 插槽/干燥机/自定义位置）
- 扫码改位置功能（扫描位置二维码直接更新料卷位置）

#### 标签与二维码
- 料卷标签预览与 PNG 导出
- 位置标签 40x30mm 打印页（自动触发打印）
- 二维码扫描器集成（html5-qrcode）
- 二维码生成与显示（qrcode.react）

#### 品牌管理
- 品牌 Logo 上传（MIME/大小校验，最大 5MB）
- Logo 文件持久化存储
- 品牌 Logo 共享机制（同品牌耗材自动继承）

#### 用户体验
- 移动端优先设计
- 桌面侧边导航
- 亮/暗主题支持（系统主题优先 + 手动切换并持久化）
- 完整响应式布局（桌面/平板/手机）
- 简约 Apple-like 视觉风格

#### 技术特性
- HMAC 签名 Token 认证（7 天有效期）
- RESTful API 设计
- 固定窗口限流器
- HTTP 请求体大小限制
- UPC/GTIN 格式校验
- 数据库迁移系统（Prisma）

#### 部署支持
- Docker 多阶段构建优化
- docker-compose 一键部署
- 健康检查配置
- 数据持久化（SQLite + Logo 文件）
- 非 root 用户运行（安全加固）

#### 测试覆盖
- color-hue 模块测试
- theme 模块测试
- api-auth 模块测试
- fetch 模块测试

### Technical Stack
- Next.js 16 (App Router)
- React 19
- TypeScript 5.9+
- Tailwind CSS v4
- shadcn/ui
- Prisma ORM
- SQLite
- Lucide React Icons

### Documentation
- 完整的 README.md（中文）
- API 文档（认证、耗材、线轴、位置、文件上传）
- Docker 部署指南
- 本地开发指南
- 数据模型说明
- 目录结构说明

[1.0.0]: https://github.com/hanilbert/3d-filament-manager/releases/tag/v1.0.0
