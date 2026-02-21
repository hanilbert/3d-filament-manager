角色与任务目标
你现在是一个全栈高级工程师。请帮我从零开发一个**「3D打印耗材位置与生命周期管理系统」**。
该系统主打极简的移动端交互、二维码物理资产追踪，以及高适配性的标签打印。最终产物需要可以打包为单 Docker 镜像，部署在我的公网 VPS 上。

一、 系统核心业务逻辑 (业务架构)
系统采用类似电商 SPU 与 SKU 的“双层数据结构”：

全局耗材字典 (Global Catalog / SPU)：记录耗材的客观通用属性（品牌、材质、颜色、推荐温度等）。包含品牌 Logo 资源。

我的料卷 (My Spools / SKU)：代表物理世界中真实存在的那一卷耗材。它必须关联一条“全局字典”数据，拥有独立的唯一 ID (UUID)，记录当前状态（使用中/已用完）和当前存放位置。

位置管理 (Locations)：物理存放点（如“防潮箱A”、“货架B”），拥有独立的二维码。

二、 数据库表结构设计 (Schema 建议使用 SQLite 以方便 Docker 单挂载)
请预留拓展性字段，但目前实现以下核心字段即可：

Table: GlobalFilament

id: UUID (Primary Key)

brand: String (e.g., "Bambu Lab", "eSUN")

material: String (e.g., "PLA Matte", "PETG", "ABS")

color_name: String (e.g., "Grass green 11500")

nozzle_temp: String (e.g., "190-230°C")

bed_temp: String (e.g., "35-45°C")

print_speed: String (e.g., "≤300 mm/s")

logo_url: String (品牌 Logo 图片的本地或外部链接)

created_at: Timestamp

Table: Location

id: UUID (Primary Key)

name: String (e.g., "防潮箱 1 号")

Table: Spool

id: UUID (Primary Key, 极为重要，用于生成贴在色卡上的二维码)

global_filament_id: Foreign Key -> GlobalFilament.id

location_id: Foreign Key -> Location.id (Nullable，初始可为空)

status: Enum/String ("ACTIVE" 使用中, "EMPTY" 已用完)

created_at: Timestamp

三、 核心用户工作流 (User Workflows)
Workflow 1：入库与标签生成

用户在前端查询 GlobalFilament 库，若无则新建。

选中特定字典项，点击“加入我的料卷”。

系统在 Spool 表生成一条新记录（状态默认为 ACTIVE，位置为空），并跳转至该 Spool 的专属前端详情页（例如 /spool/{spool_id}）。

在详情页点击“打印标签”，调用前端排版页面，用户通过热敏打印机打印并贴在色卡上。

Workflow 2：扫码改位置 (核心交互，必须适配移动端)

用户用手机扫描色卡上的二维码，浏览器打开 /spool/{spool_id} 详情页。

页面上有一个明显的“修改位置”按钮。点击后，通过 HTML5 Camera API (推荐使用 html5-qrcode 或类似轻量库) 直接调起手机后置摄像头。

用户扫描位置实体上的二维码 (解码结果为 /location/{location_id} 或纯 UUID)。

前端捕获该 Location ID，自动提交到后端，将该 Spool 的 location_id 更新，并在页面提示“位置已更新”。

Workflow 3：生命周期归档

扫码进入 Spool 详情页。

点击“标记为已用完 (Mark as Empty)”。

数据库将该 Spool 的 status 改为 EMPTY。

前端展示列表需分为两个 Tab：「使用中 (Active)」和「已归档 (Archived/Empty)」，该料卷将只在已归档列表中显示。

四、 标签打印排版规约 (极度重要)
生成的标签必须适配 40mm (宽) × 30mm (高) 的热敏标签纸。

实现方式：请提供一个专用的打印路由（如 /spool/{id}/print）。必须使用 CSS @media print 媒体查询，将页面 @page 的 size 严格设定为 40mm 30mm，并且 margin: 0。

排版布局参考：

左侧 (约占 60-70% 宽度)：顶部为品牌 Logo 和 Material 名称（加粗大写，背景可反黑反白）。下方小字密集排列：温度、速度、颜色。

右侧 (约占 30-40% 宽度)：一个清晰的二维码（内容为该 Spool 详情页的完整 URL）。

请确保在纯前端（如使用 qrcode.react 或原生 JS QR 库）动态渲染该二维码。

五、 部署与安全要求
Docker 化：提供完整的 Dockerfile 和 docker-compose.yml。

持久化：数据库必须使用 Volume 挂载到宿主机（例如 ./data:/app/data），防止容器重启数据丢失。如果是存放图片的目录（存放 Logo），也需要挂载。

环境：将部署在公网 VPS 上。

访问鉴权 (简易)：由于暴露在公网，请在应用层面加一个极其简单的全局密码保护（例如所有页面路由都需要通过简单的 Password Check 或设置一个固定 Token 存在 localStorage 里），不需要复杂的注册登录系统，只要能挡住闲杂人等即可。

六、 你的执行步骤
请理解以上需求后，向我汇报你的技术选型（推荐 Next.js 极简全栈，或者 Python FastAPI + Vue3/React 纯静态分离），在获得我确认后，按照：

搭建基础框架与 SQLite 数据库模型。

实现核心增删改查 API。

实现移动端优先的 Web 页面（特别是 HTML5 扫码功能）。

实现 40x30mm 的 CSS 打印排版页。

编写 Docker 部署脚本。
逐步为我输出代码。现在，请告诉我你的技术栈建议，并给出第一步的数据库 Schema 代码。