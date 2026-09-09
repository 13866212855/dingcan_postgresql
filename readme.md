# 客来香·智能扫码点餐与多租户餐厅连锁运营管理系统 (dingcan)

本项目是一套现代化的全功能餐厅扫码点餐、桌位协同、会员积分与多租户连锁运营管理系统，采用 Next.js 15 (App Router)、React 19、Tailwind CSS 以及高可靠 PostgreSQL 数据库构建，支持严格的租户数据隔离、单域名多租户接入、生产级容器化部署与自动化一键发布。

---

## 🌟 核心功能特性

### 1. 多租户架构与严格数据隔离 (Multi-Tenant Architecture)
- **严格行级数据隔离**：所有核心数据表（菜品 `dishes`、订单 `orders`、餐桌 `dining_tables`、会员 `app_users`、门店配置 `app_settings`）均统一建立 `tenant_id` 联合索引与过滤约束，确保跨门店、跨租户数据绝对物理隔离、不可越权访问。
- **租户解析机制**：后端 API 及前端路由支持多维租户识别：
  1. **URL 参数优先**：`?tenant=<tenant_id>` 或 `?t=<tenant_id>`；
  2. **HTTP 头部**：`x-tenant-id: <tenant_id>`；
  3. **Cookie 凭据**：`dingcan_tenant_id`；
  4. **默认安全回退**：未指定时回退至 `default` 主店租户。
- **连锁门店管理中心**：运营后台内置「连锁分店」管理模块，可快捷创建门店租户、维护门店编码、绑定专属独立域名/子路径、启用或暂停营业状态。

### 2. 顾客端（前台智能扫码点餐）
- **门店自适应与品牌定制**：根据租户自动加载该门店专属的招牌名称、Logo、宣传语、菜单、分类与收款码。
- **桌位识别与扫码直达**：支持 URL 参数直接带入门店与桌号（例如 `/?tenant=branch_1&desk=A01`），自动锁定桌位并校验空闲状态。
- **菜品浏览与多维分类**：支持特色热炒、精选凉菜、主食主饮、养生靓汤等多分类筛选、模糊搜索与售罄/在售状态感知。
- **购物车与即时结算**：数量增减、一键清空、就餐方式（到店堂食 / 送餐外卖）、就餐备注与会员积分抵扣。
- **就餐流水与订单追踪**：下单后实时跟踪订单制作状态（待处理 -> 制作中 -> 已完成），支持查看当前门店历史就餐记录。

### 3. 管理端（后台连锁运营管理 `/admin`）
- **安全认证管理**：支持管理员快捷登录，默认账号：`admin`，密码：`admin123`。
- **多门店一键切换**：顶部导航栏自带门店快速切换下拉菜单，切换后订单中心、菜品库、餐桌、会员与配置即时刷新为目标门店数据。
- **订单实时处理中心**：
  - 自动轮询最新订单，支持真人语音与提示音提醒（支持开启/静音测试）；
  - 订单状态流转（待处理 -> 制作中 -> 已完成 / 已取消）；
  - 支付状态确认与结账核销；
  - 统计当日营业额、订单总数、待处理单量与实收金额。
- **菜品库管理**：支持按门店录入菜品、修改价格、编辑配图与口感说明、一键上下架与删除。
- **餐桌与桌码管理**：维护各门店餐桌编号与容纳人数，自动生成携带当前门店租户与桌号的专属点餐二维码（支持导出与即时扫码预览）。
- **会员与积分体系**：手机号快速认证，按门店记录会员消费、可用积分与历史累计。
- **收款与品牌设置**：独立配置各门店名称、店标 Logo、宣传语、收款二维码（微信/支付宝）、起送费与满减优惠等。

---

## 🏢 如何使用本项目的多租户功能 (Multi-Tenant User Guide)

本项目采用**单实例 + 严格行级隔离**的企业级多租户架构，一套系统即可同时支撑数百家连锁分店、加盟商或不同餐饮子品牌独立运营。每个租户均拥有完全独立的数据空间、菜品库、餐桌编码、订单流水、会员积分体系及品牌收款配置。

---

### 1. 多租户核心概念与隔离原理

| 维度 | 单体模式 (传统) | 本项目多租户模式 (Multi-Tenant) |
| :--- | :--- | :--- |
| **门店规模** | 仅支持单一门店，无法连锁管理 | 支持无限扩展独立门店（主店、各区分店、联营店） |
| **数据隔离** | 数据平铺在单表中，无租户维度 | 全表建立 `tenant_id` 联合索引与复合主键，逻辑与物理双重隔离 |
| **菜品与分类** | 全局唯一，无法按店定制 | 每家分店拥有独立的菜单、价格、上下架状态与推荐特色 |
| **餐桌与二维码** | 仅根据桌号识别，易串台 | 桌贴二维码内置 `tenant` 与 `desk` 双重参数，精准定向所属门店 |
| **财务收款** | 全局统一收款账户 | 各分店可独立上传所属微信/支付宝收款码，资金账目互不交叉 |
| **就餐订单** | 所有订单混在一起 | 订单实时处理中心仅显示当前门店订单，支持各店独立语音叫单 |

#### 系统内置预设租户
系统在首次启动时已自动准备了三家风格各异的体验门店：
1. **默认主店 (`default`)**：`客来香·家常菜馆`（地道现炒、老少咸宜）
2. **川味分店 (`chuan`)**：`蜀香阁·地道川菜`（麻辣鲜香、川味招牌）
3. **粤式分店 (`yue`)**：`粤品轩·精致早茶`（蒸点生滚、正宗广式早茶）

---

### 2. 运营后台管理多租户操作手册

#### ① 登录后台管理中心
- 打开浏览器访问管理后台：`http://localhost:3000/admin`
- 默认管理员账号：`admin`
- 默认管理员密码：`admin123`

#### ② 顶部一键切换当前管理门店
- 登录后，顶部导航栏左侧常驻显示 **「当前管理门店」下拉选择框**；
- 点击下拉框即可在所有已启用的分店之间秒级切换；
- **自动全局联动**：切换门店后，无需刷新网页，下方的「订单处理中心」、「菜品库」、「餐桌管理」、「会员列表」以及「收款与品牌配置」将即时自动重载为目标门店的私有数据。

#### ③ 手把手创建全新分店 / 租户（详细步骤）
当需要为新开业的分店开通点餐系统时，操作步骤如下：
1. 点击后台顶部导航栏的 **「连锁分店」** 标签页；
2. 点击页面右上角醒目的 **「+ 添加新门店」** 按钮，打开创建门店弹窗；
3. **填写门店核心配置项**：
   - **租户唯一标识代码 (Tenant ID)**：
     - *必填*，由小写字母、数字或下划线组成（例如：`branch_high_tech`、`branch_east`、`wanda_01`）；
     - 该代码是数据库中用于隔离所有数据的唯一物理主键，一旦创建不可随意更改。
   - **门店名称 (Store Name)**：
     - *必填*，对外展示的品牌全称（例如：`客来香·高新科技园店`）；
     - 将直接显示在顾客手机端顶部招牌、收银对账单及小票明细中。
   - **品牌宣传语 (Slogan)**：
     - 选填（例如：`现点现炒 · 商务快餐 · 暖胃更暖心`）；
     - 展示在顾客端顶部店标下方。
   - **门店专属 Logo**：
     - 支持在弹窗中**一键点选预设的 6 种高清餐饮图标**（中式正餐、川湘麻辣、烧烤夜市、粤式点心、日料轻食、西式快餐）；
     - 也可直接粘贴外部图片或对象存储图片 URL。
   - **联系电话与详细地址**：
     - 填写分店订餐电话与具体门牌地址，方便顾客外卖联系与到店就餐。
   - **营业状态**：
     - 选择「正常营业 (已启用)」或「暂停营业 (已停用)」。
4. 点击 **「确认创建」**：
   - 后端服务将在 PostgreSQL 中插入租户记录；
   - **智能数据初始化**：系统会**自动为新门店克隆一套开箱即用的基础数据**（包括初始餐桌 A01~A08、分类及基础配置），无需管理员从零逐个敲键盘录入，大幅缩短开店时间！
5. 创建完成后，顶部下拉菜单即刻出现新门店，选择该分店即可开始上架专属新菜品。

#### ④ 生成分店专属扫码点餐二维码
1. 在顶部下拉框中切换到对应分店（或在「连锁分店」表格中找到目标行）；
2. 点击操作栏中的 **「点餐码」** 图标（或进入「餐桌管理」标签点击任意桌号的 **「查看二维码」**）；
3. 系统将弹出高清动态生成的二维码图片，其链接格式规范如下：
   - **门店入口总码**：`http://<您的域名或IP>:7846/?tenant=branch_east`
   - **带桌号的桌贴码**：`http://<您的域名或IP>:7846/?tenant=branch_east&desk=A06`
4. 管理员可直接右键复制图片、截图或点击「复制点餐链接」，制作成餐桌亚克力桌贴张贴使用。

#### ⑤ 编辑或停用分店
- 在「连锁分店」列表中，点击任意门店的「编辑」按钮可修改店名、电话、地址与宣传语；
- 若某门店临时闭店装修，可将其状态切换为「暂停营业」，系统将自动拦截进入该门店的顾客端点餐请求。
- 系统具备安全防误删防护：默认系统主店（`default`）禁止删除。

---

### 3. 顾客端（前台扫码点餐）使用指南

顾客的使用体验完全无需任何注册下载流程，纯扫码 H5 即开即点：

1. **桌贴扫码直达**：
   - 顾客使用手机微信、支付宝或系统相机扫描桌上二维码（例如包含 `?tenant=chuan&desk=A02`）；
   - 前端自动锁定当前租户为 `chuan`，桌号为 `A02`，并在界面顶部显示「蜀香阁·地道川菜 - A02 号桌」；
   - 菜单展示该店专属的麻辣香锅、水煮牛肉等川味特色，完全看不到其他门店菜品。
2. **就餐与加菜**：
   - 顾客挑选菜品放入购物车，选填口味备注（如“微辣少盐”）；
   - 点击「立即下单」，订单即时传输至后端 PostgreSQL 并打上 `tenant_id = 'chuan'` 标签；
   - 蜀香阁后台的电脑端实时语音播报：“您有新的订单，请及时处理”，后厨随即开始制作。
3. **手机端多店漫游与体验切换**：
   - 若顾客在非扫码场景直接访问主页（`http://localhost:3000/`），顶部导航会显示**门店切换胶囊按钮**；
   - 顾客可自由切换进入不同分店查看各自特色招牌菜单；
   - 顾客所选的当前分店会自动持久化存储于浏览器的 `localStorage` 与 `Cookie` 中，下次访问无需重复选择。

---

### 4. 开发者与系统集成 API 规范

若您需要对接第三方收银机、扫码手持机或小程序前端，可按照以下规范调用多租户 API：

#### ① 租户识别优先级规则
所有 API 接口均通过 `lib/tenant.ts` 中的统一解析器提取目标租户，识别顺序为：
1. **URL 参数**：`?tenant=<tenant_id>` 或 `?t=<tenant_id>`（最高优先级）
2. **HTTP Header**：`X-Tenant-Id: <tenant_id>`
3. **Cookie 凭据**：`dingcan_tenant_id=<tenant_id>`
4. **默认降级**：`default`

#### ② 常用 API 接口清单
| 功能 | 请求方式与路由 | 携带租户参数示例 | 说明 |
| :--- | :--- | :--- | :--- |
| **获取门店列表** | `GET /api/tenants` | 无需租户（返回全量公开门店清单） | 供客户端切换门店或后台渲染分店列表 |
| **创建新门店** | `POST /api/tenants` | Body: `{ id, name, slogan, logo, phone, address, status }` | 新建租户，自动初始化基础数据 |
| **获取分店菜单** | `GET /api/dishes` | `GET /api/dishes?tenant=chuan` | 获取 `chuan` 门店在售菜品与分类 |
| **录入新菜品** | `POST /api/dishes` | Body: `{ tenant_id: "chuan", name, price, ... }` | 菜品绑定至指定租户 |
| **查询分店桌位** | `GET /api/tables` | `GET /api/tables?tenant=yue` | 获取 `yue` 门店的所有桌台与占用状态 |
| **顾客提交订单** | `POST /api/orders` | Body: `{ tenant_id: "chuan", table_num, items, ... }` | 提交订单至对应分店，触发该店叫单 |
| **分店订单流转** | `PUT /api/orders` | Body: `{ tenant_id: "chuan", id, status: "completed" }` | 变更订单状态（制作中/已完成/已取消） |
| **分店品牌配置** | `GET /api/settings` | `GET /api/settings?tenant=chuan` | 获取该店的店名、Logo、收款二维码配置 |
| **更新品牌配置** | `PUT /api/settings` | Body: `{ tenant_id: "chuan", settings: { ... } }` | 保存该分店专属收款码与宣传文案 |

---

### 5. 基于 `mysingledomain2mul` 技能的单域名反向代理部署

结合本项目的 `mysingledomain2mul` 技能，您无需为每家分店购买多套域名，利用单域名配合 Nginx 反向代理即可实现多种灵活的路由映射策略：

#### 方案 A：URL 路径前缀映射租户 (Path-based Routing)
通过 Nginx 根据访问路径直接向后端附加 `X-Tenant-Id` 请求头，对用户透明：
```nginx
server {
    listen 80;
    server_name order.example.com;

    # 1. 默认主店 (客来香)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Tenant-Id default;
    }

    # 2. 川菜分店 (访问 order.example.com/chuan/)
    location /chuan/ {
        rewrite ^/chuan/(.*) /$1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Id chuan;
    }

    # 3. 粤菜分店 (访问 order.example.com/yue/)
    location /yue/ {
        rewrite ^/yue/(.*) /$1 break;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Tenant-Id yue;
    }
}
```

#### 方案 B：泛域名子域名映射租户 (Subdomain-based Routing)
如果配置了泛域名解析（如 `*.order.example.com`），可通过正则提取子域名并直接作为租户 ID：
```nginx
server {
    listen 80;
    server_name ~^(?<subdomain>.+)\.order\.example\.com$;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Tenant-Id $subdomain;
    }
}
```

#### 远程 Docker 数据库与多租户宿主环境自动诊断修补
本项目在 `skills/mysingledomain2mul/scripts/diagnose_and_fix_remote.py` 中提供了自动化远程服务器诊断脚本，可自动检测并修复远程服务器上容器宿主网络、PostgreSQL 端口连通性及多租户环境配置：
```bash
python skills/mysingledomain2mul/scripts/diagnose_and_fix_remote.py --host 172.29.173.42 --user gpzx --password ****** --port 22
```

---

## 🛠️ 本地开发与调试运行

### 环境准备
- Node.js 20+
- npm 或 pnpm / yarn
- PostgreSQL 数据库（本地或远程容器运行）

### 环境变量配置 (`.env.local`)
```env
POSTGRES_URL=postgresql://gpzx:9520111@172.29.173.42:5432/dingcan
# 或使用本地 PostgreSQL:
# POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/dingcan
PORT=3000
```

### 本地启动步骤
```bash
# 1. 安装项目依赖
npm install

# 2. 启动开发调试服务器 (默认端口 3000)
npm run dev

# 3. 在浏览器中打开访问
# 前台点餐端：http://localhost:3000
# 某分店点餐：http://localhost:3000/?tenant=branch_1
# 后台管理端：http://localhost:3000/admin （账号: admin / 密码: admin123）
```

---

## 🐳 Docker 容器化与一键部署说明

本项目已配置标准生产级 Docker 镜像构建，并针对 Windows 批处理环境提供了本地与远程双重一键部署方案。

### 1. 本地 Docker 快速部署 (`redeploy.bat`)
在 Windows 环境下直接双击运行项目根目录下的 `redeploy.bat`：
1. 自动构建本地 Docker 镜像 `dingcan_postgresql_tenant:latest`；
2. 停止并移除已有的旧同名容器；
3. 清理虚悬无标签悬空镜像；
4. 自动创建本地挂载数据目录 `D:\docker\dingcan_postgresql_tenant\data`；
5. 启动容器并将内部 3000 端口映射到宿主机 **7846** 端口；
6. 访问地址：`http://localhost:7846`。

### 2. 远程 Linux 服务器自动化部署 (`upload2remote.bat`)
在 Windows 环境下双击运行项目根目录下的 `upload2remote.bat`：
1. 本地快速构建 Docker 镜像 `dingcan_postgresql_tenant`；
2. 将镜像导出打包为 `d:\temp\tar\dingcan_postgresql_tenant.tar`；
3. 通过 `scp` 安全上传至目标服务器 `172.29.173.42`（用户 `gpzx`）的 `/bak/tar/` 目录；
4. 通过 `ssh` 远程执行 `docker load` 载入镜像；
5. 自动在远程服务器创建持久化数据目录 `/bak/docker/dingcan_postgresql_tenant/data` 并设置完全读写权限；
6. 停止并重启远程 Docker 容器 `dingcan_postgresql_tenant`，网络绑定 `mynet`，端口映射宿主机 **7846**；
7. 远程访问地址：`http://172.29.173.42:7846`。

---

## 📁 核心项目结构
```text
├── app/
│   ├── admin/page.tsx       # 运营后台管理主界面（多门店切换、订单、菜品、桌位、会员、分店）
│   ├── api/                 # 服务端多租户数据路由
│   │   ├── dishes/          # 菜品管理 (按 tenant_id 隔离)
│   │   ├── orders/          # 订单管理 (按 tenant_id 隔离)
│   │   ├── tables/          # 餐桌管理 (按 tenant_id 隔离)
│   │   ├── tenants/         # 租户门店管理 (CRUD 与租户清单)
│   │   ├── users/           # 会员积分 (按 tenant_id 隔离)
│   │   ├── settings/        # 门店品牌与收款配置 (按 tenant_id 隔离)
│   │   └── admin/           # 管理员登录鉴权
│   ├── page.tsx             # 顾客扫码点餐主页面 (支持 ?tenant=... 参数)
│   ├── layout.tsx           # 全局根布局
│   └── globals.css          # 全局样式
├── components/              # 核心交互组件
│   ├── admin/               # 后台模块 (TenantManagement, StoreManagement, TableManagement, etc.)
│   ├── OrderingClient.tsx   # 顾客点餐客户端主驱动
│   ├── CartDrawer.tsx       # 购物车抽屉与结算
│   └── TableSelectModal.tsx # 桌号选择弹窗
├── lib/
│   ├── db.ts                # PostgreSQL 数据库连接池与严格多租户 CRUD 操作
│   ├── tenant.ts            # 多租户解析工具 (Query / Header / Cookie)
│   └── storage.ts           # 兼容受限沙箱与多端的安全缓存工具
├── skills/
│   ├── mysingledomain2mul/  # 单域名多租户架构与远程容器网络诊断补丁技能
│   │   ├── SKILL.md         # 技能指南
│   │   └── scripts/         # 远程诊断补丁脚本 (diagnose_and_fix_remote.py)
│   └── myusellm/            # 统一大模型与双部署集成脚本技能规范
├── Dockerfile               # 生产环境 Docker 构建配置
├── redeploy.bat             # 本地 Docker 一键构建运行脚本 (端口 7846)
├── upload2remote.bat        # 远程 Linux 服务器一键打包传输运行脚本 (端口 7846)
└── readme.md                # 项目全中文多租户架构与操作说明文档
```

