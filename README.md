# Spool Tracker — 3D 打印耗材管理系统

Spool Tracker 是一个面向 3D 打印用户的耗材管理应用，解决“料卷在哪”和“料卷是否已用完”两个高频问题。系统通过二维码将实物料卷、位置标签与 Web 数据绑定，支持移动端扫码更新和桌面端批量浏览。

---

## 功能特性

- 料卷生命周期管理：`ACTIVE / EMPTY`、重新入库、删除料卷
- 耗材字典管理：品牌、材料、颜色与完整打印参数档案
- 品牌与材料分层浏览：品牌页、材料大类页、子材料页
- 位置管理：支持货架/打印机/AMS 插槽/干燥机/自定义位置
- 扫码改位置：扫描位置二维码后直接更新料卷 `location_id`
- 标签能力：
  - 料卷标签预览 + PNG 下载
  - 位置标签 40x30mm 打印页（自动触发打印）
- 品牌 Logo 上传：MIME/大小校验，文件落盘并通过 API 读取
- 移动端优先 + 桌面侧边导航

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router） |
| 语言 | TypeScript |
| 运行时 | React 19 |
| UI | Tailwind CSS v4 + shadcn/ui + Lucide React |
| ORM | Prisma |
| 数据库 | SQLite |
| 扫码/二维码 | html5-qrcode + qrcode.react |
| 标签导出 | html-to-image |
| 鉴权 | HMAC 签名 Token（7 天有效） |
| 部署 | Docker 多阶段构建 + docker-compose |

---

## 快速开始（本地开发）

### 前置要求

- Node.js 20+
- npm

### 安装与运行

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

---

## Docker 部署（推荐）

```bash
cp .env.example .env
docker compose up -d --build
```

- 数据目录挂载为 `./data`（数据库与 Logo 文件持久化）
- 容器启动会自动执行 `prisma migrate deploy`

---

## 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `APP_PASSWORD` | 访问密码（必填） | `your_secret_password` |
| `NEXT_PUBLIC_BASE_URL` | 生成二维码跳转链接的基础地址 | `https://spools.example.com` |
| `DATABASE_URL` | SQLite 数据库路径 | `file:/app/data/spool_tracker.db` |
| `TOKEN_SECRET` | Token 签名密钥（可选；不填则回退 `APP_PASSWORD`） | `a-strong-secret` |

---

## 数据模型

```text
GlobalFilament（耗材字典/SPU）
  └── Spool（料卷/SKU）
        └── Location（位置）
```

- `GlobalFilament`：品牌、材料、颜色、打印参数、Logo 等
- `Spool`：状态、位置、创建时间，绑定单个字典项
- `Location`：位置类型、短码、AMS 插槽信息

---

## 目录结构

```text
src/
  app/
    (auth)/login
    api/
    spools/
    spool/[id]/
    catalog/
    locations/
    location/[id]/
  components/
  lib/
prisma/
docs/
```

---

## 常用命令

```bash
npm run dev
npm run build
npm start
npm run lint
npx prisma studio
```

---

## 注意事项

- 扫码依赖 HTTPS 或 localhost（浏览器摄像头权限限制）
- SQLite 适合个人/小规模并发场景
- 当前为单密码模式，不含多用户权限体系

---

## License

MIT

### Third-Party Licenses

This project includes the following third-party assets:

- **Font**: LXGW Neo XiHei Screen Full
  - License: IPA Font License 1.0
  - Location: `/fonts/LXGWNeoXiHeiScreenFull.ttf`
  - Full license text: `/fonts/LICENSE`
  - Source: https://github.com/lxgw/LxgwNeoXiHei
