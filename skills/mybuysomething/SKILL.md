---
name: mybuysomething
description: >
  全面的全栈电商与个人商户在线营销商城构建规范（涵盖多租户架构、Neon PostgreSQL云数据库、Render公网部署、UptimeRobot保活冷启动预防、配置驱动UI与/admin管理后台、高转化消费级电商购物车与会员积分体系）。当需要为个人门店、品牌餐饮、零售商户或营销平台搭建低成本、高可用、秒开体验的电商系统时使用此技能。
---

# mybuysomething 极速全栈电商/门店营销平台构建指南

本技能总结了生产级全栈商城与智慧门店系统经实战检验的核心技术体系。旨在帮助开发者为个人店铺、餐饮门店、零售品牌或营销活动，极速构建高可用、零成本云运维、微信极速秒开、支持多门店独立运营的现代化电商平台。

---

## 核心技术矩阵概览

| 维度 | 关键技术 / 平台 | 解决的核心痛点 |
| :--- | :--- | :--- |
| **1. 多租户架构** | 单实例 + 单库 + 行级 `tenant_id` 物理隔离 | 一套代码同时支持多个分店/商户，独立品牌、菜品、订单与配置 |
| **2. 免费云数据库** | Neon Serverless PostgreSQL (`neon.tech`) | 免费免运维、自动扩缩容、全自动幂等数据表迁移与种子数据防覆写锁 |
| **3. 公网固定域名** | Render.com Web Service (`dashboard.render.com`) | GitHub 自动构建部署、自带免费全局 HTTPS 证书、微信内置浏览器无阻碍访问 |
| **4. 极速秒开保活** | UptimeRobot (`uptimerobot.com`) 心跳守护 | 解决免费容器 15 分钟休眠冷启动痛点，每 5 分钟健康心跳，确保微信扫码秒开 |
| **5. 配置驱动与后台** | 前后端分离 + `/admin` 独立工作台 (`admin/admin123`) | 前端所有展示模块（桌号/外卖/支付时机）全由后端后台动态开关决定；集成语音实时播报 |
| **6. 消费级电商体验** | 移动端优先 + 响应式抽屉购物车 + 扫码入座 + 会员积分 | 分类联动搜索、规格备注、微信扫码桌位锁定、积分抵扣流水、极简下单 |

---

## 目录索引

- [1. 多租户架构 (Multi-Tenant Architecture)](#1-多租户架构)
- [2. Neon Serverless PostgreSQL 数据库接入与幂等迁移](#2-neon-postgresql-数据库设计)
- [3. Render.com Web 部署与固定公网域名配置](#3-render-部署与公网域名)
- [4. UptimeRobot 保活守护与微信秒开优化](#4-uptimerobot-保活机器人)
- [5. 配置驱动 UI 与 `/admin` 超级管理后台](#5-配置驱动-ui-与-admin-管理后台)
- [6. 消费级电商购物与会员积分体验](#6-消费级电商购物与会员体验)
- [7. 新项目快速接入与落地检查清单 (Checklist)](#7-落地接入清单)

---

## 1. 多租户架构

### 1.1 架构策略
采用**单实例应用 + 共享数据库 + 行级租户隔离 (Shared Database, Separate Rows)**：
- 每个核心表均包含 `tenant_id VARCHAR(64) NOT NULL DEFAULT 'default'`；
- 支持总店超级管理员（`tenant_id = 'default'`）具备跨店总览、分店创建与切换能力；
- 各分店独立后台仅可操作本门店资源（商品、分类、订单、会员、流水、桌位/区域），防范越权数据泄露。

### 1.2 租户识别多层优先级解析链
```
客户端请求
   │
   ├─► 1. URL Query 参数 (?tenant=xxx 或 ?t=xxx)        [最高优先级，用于扫码/直达链接]
   ├─► 2. HTTP Header (x-tenant-id)                     [供 API 代理、Nginx 子路径转发]
   ├─► 3. 客户端 Cookie (dingcan_tenant_id)              [持久化保持用户所选门店]
   ├─► 4. 客户端 LocalStorage (dingcan_tenant_id)        [离线备用]
   └─► 5. 兜底默认值 ('default')                          [保障系统永不崩溃]
```

#### 标准实现代码 (`lib/tenant.ts`)
```typescript
import { NextRequest } from 'next/server';

export const DEFAULT_TENANT_ID = 'default';

export function normalizeTenantId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_TENANT_ID;
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || DEFAULT_TENANT_ID;
}

export function getTenantIdFromRequest(req: NextRequest): string {
  // 1. Query 参数
  const queryTenant = req.nextUrl.searchParams.get('tenant') || req.nextUrl.searchParams.get('t');
  if (queryTenant?.trim()) return normalizeTenantId(queryTenant);

  // 2. Request Header
  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant?.trim()) return normalizeTenantId(headerTenant);

  // 3. Cookie
  const cookieTenant = req.cookies.get('dingcan_tenant_id')?.value;
  if (cookieTenant?.trim()) return normalizeTenantId(cookieTenant);

  return DEFAULT_TENANT_ID;
}
```

---

## 2. Neon PostgreSQL 数据库设计

### 2.1 推荐选型：Neon Serverless (`neon.tech`)
- **优势**：免费额度充足、Serverless 按需唤醒、原生分支机制（Branching）、免去自建运维麻烦。
- **连接串规范**：连接池需显式支持最新的 SSL 模式：
  ```
  postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<dbname>?sslmode=verify-full&channel_binding=require
  ```

### 2.2 连接池与驱动配置 (`lib/db.ts`)
```typescript
import { Pool } from 'pg';

let poolInstance: Pool | null = null;

export function getPool(): Pool {
  if (!poolInstance) {
    let connStr = process.env.DATABASE_URL || FALLBACK_DATABASE_URL;
    // 规整连接串，避免过时的 sslmode 告警
    if (connStr.includes('sslmode=require')) {
      connStr = connStr.replace('sslmode=require', 'sslmode=verify-full');
    }
    poolInstance = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
    });
  }
  return poolInstance;
}
```

### 2.3 核心数据表结构 (DDL)
```sql
-- 1. 租户表
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  logo TEXT DEFAULT '',
  slogan VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 商品/菜品表
CREATE TABLE IF NOT EXISTS dishes (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(128) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  status INT NOT NULL DEFAULT 1,  -- 1 上架, 0 下架
  taste_options TEXT DEFAULT '',   -- 规格/口味标签 JSON 或逗号分隔
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dishes_tenant ON dishes(tenant_id);

-- 3. 餐桌/区域表 (零售或外卖模式下可选)
CREATE TABLE IF NOT EXISTS tables (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(64) NOT NULL,
  sort_order INT DEFAULT 0,
  is_occupied INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables(tenant_id);

-- 4. 会员用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  name VARCHAR(64) DEFAULT '顾客',
  phone VARCHAR(32) DEFAULT '',
  points NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) DEFAULT 0,
  total_spent NUMERIC(10,2) DEFAULT 0,
  delivery_address TEXT DEFAULT '',
  delivery_contact VARCHAR(64) DEFAULT '',
  delivery_phone VARCHAR(32) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. 订单主表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  table_no VARCHAR(64) NOT NULL DEFAULT '自取/未指定桌位',
  order_type VARCHAR(32) NOT NULL DEFAULT '堂食', -- 堂食 / 外卖 / 自取
  delivery_address TEXT DEFAULT '',
  delivery_contact VARCHAR(64) DEFAULT '',
  delivery_phone VARCHAR(32) DEFAULT '',
  total_price NUMERIC(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT '待处理', -- 待处理 / 制作中 / 已完成 / 已取消
  payment_status VARCHAR(32) NOT NULL DEFAULT '待支付',
  payment_timing VARCHAR(32) DEFAULT '餐前付款',
  payment_proof_url TEXT DEFAULT '',
  points_used NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  user_id VARCHAR(128) DEFAULT '',
  items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);

-- 6. 系统动态配置键值表
CREATE TABLE IF NOT EXISTS settings (
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
  key VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key)
);
```

### 2.4 关键坑点：种子数据锁 (Seed Lock)
> [!CAUTION]
> **切忌在每次启动时仅根据 `count === 0` 重新灌入默认示例数据！**  
> 否则管理员在后台清空所有商品或餐桌后，系统重新请求会再次复原，造成“无法清空”的严重 Bug。
- **解决方案**：使用 `settings` 表存储持久化标记（如 `tables_seeded = '1'`，`dishes_seeded = '1'`）。只要该标记已写入，即便数据表记录数为 0，系统也绝不重复注入示例数据。

---

## 3. Render 部署与公网域名

### 3.1 创建 Render Web Service
1. 打开 [https://dashboard.render.com/web/new](https://dashboard.render.com/web/new) 并连接 GitHub 仓库；
2. 关键配置项参数：
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (或 Next.js 的生产启动命令)
   - **Plan**: `Free`
3. 环境变量注入 (`Environment Variables`)：
   - `DATABASE_URL`: `postgresql://neondb_owner:***@***-pooler.neon.tech/neondb?sslmode=verify-full`
   - `NODE_ENV`: `production`

### 3.2 微信生态适配与自定义域名
- Render 自动分配永久免费 HTTPS 域名：`https://your-shop-name.onrender.com`；
- 该域名在微信中打开具有高信任度，可直接进行微信内扫码点餐与分享；
- **绑定自有独立域名**：在 Render 控制台 -> Settings -> Custom Domains 中添加 `shop.yourdomain.com`，并在 DNS 服务商处添加 CNAME 指向即可，Render 会全自动签发 Let's Encrypt SSL 证书。

---

## 4. UptimeRobot 保活机器人

### 4.1 为什么必须配置保活机器人？
Render、Fly.io、Koyeb 等免费 PaaS 服务具有 **Scale-to-Zero（15分钟无访问自动休眠）** 机制。当没有流量时，容器进入冷休眠，顾客扫码首次打开往往需要等待 30-60 秒加载容器。

### 4.2 保活配置步骤
1. 打开 [https://uptimerobot.com](https://uptimerobot.com)，注册并创建新监控 (`Add New Monitor`)；
2. **Monitor Type**: `HTTP(s)`；
3. **Friendly Name**: `店铺在线保活机器人`；
4. **URL (or IP)**: `https://your-shop-name.onrender.com/api/health` 或首页 `https://your-shop-name.onrender.com/`；
5. **Monitoring Interval**: `5 minutes`（每 5 分钟发送一次轻量 HTTP GET 请求）；
6. 保存生效。

### 4.3 轻量心跳端点标准写法 (`app/api/health/route.ts`)
```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
```
*注：心跳接口应极其轻量，避免在保活心跳中执行高耗时 SQL，从而节约数据库连接。*

---

## 5. 配置驱动 UI 与 `/admin` 管理后台

### 5.1 配置驱动界面哲学 (Config-Driven UI)
前端界面的交互形态全部由后端 `settings` 动态控制，无需修改代码即可灵活切换经营形态：
- **无桌位/快餐零售模式**：当后台清空餐桌或设置 `require_table_no = 0` 时，前端顶栏**彻底隐藏【选择桌号】按钮**，购物车结算彻底移除桌位区块，订单自动归为“自取/外带”。
- **纯外卖模式**：关闭 `enable_dine_in`，开启 `enable_takeout`，结算界面仅展示收货地址录入，不展示堂食桌号。
- **双模/多模经营**：堂食、外送自由切换；支持“餐前立付”与“餐后结账”开关。

### 5.2 `/admin` 独立后台工作台体系
- **默认超级管理员入口**：`/admin`，初始账号 `admin`，初始密码 `admin123`；
- **核心模块集成**：
  1. **订单实时处理中心**：订单卡片卡流流转（待接单 ➔ 制作中 ➔ 已完成 ➔ 已取消）；
  2. **商品与分类库管理**：菜品 CRUD、上下架、价格修改、规格口味标签设定；
  3. **桌位/区域管理**：批量生成桌号、一键生成专属点餐桌贴二维码、一键清空与状态置空；
  4. **会员与积分中心**：顾客实名电话查询、积分余额调整、消费流水追溯；
  5. **收款与运营配置**：上传微信/支付宝个人收款码、设置积分抵扣比例、就餐模式组合。

### 5.3 实时订单语音与声音播报规范 (`lib/sound.ts`)
由于移动端与现代浏览器对网页自动播放音频的限制（`Autoplay Policy`），必须提供用户显式手势激活：
```typescript
let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!audioCtx && AudioContextClass) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function playOrderChime() {
  // 使用 Web Audio API 动态合成双音节清脆蜂鸣提示音，无需依赖外部 mp3 静态文件
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
  osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}
```

---

## 6. 消费级电商购物与会员体验

### 6.1 极致体验的核心组件清单
1. **分类联动导航**：左侧品类垂直切换 + 右侧商品滚动定位，支持分类角标实时统计；
2. **多规格与口味弹窗 (`DishModal`)**：支持规格单选（大份/中份/小份）与口味多选（免葱/微辣/少冰）；
3. **响应式抽屉购物车 (`CartDrawer`)**：
   - 底部常驻悬浮结算条（带总价动画、商品数量角标）；
   - 上滑展开抽屉，支持每项菜品数量加减、单项移除与一键清空；
   - 购物车状态持久化存储于客户端 `localStorage`，刷新页面不丢失购物车。
4. **桌号/场景自动锁定**：
   - URL 携带 `?desk=5号桌` 时，界面自动锁定为“5号桌”，显示“已扫码入座”标签；
   - 若后台无桌号，则自然降级为自取号生成（如 `A-012`）。
5. **会员中心与积分抵扣**：
   - 顾客输入手机号即可一键成为会员并关联历史资产；
   - 下单自动累计积分（默认每消费 1 元积 1 分）；
   - 结账页支持积分 1:1 抵扣现金，直观提升复购留存率。

---

## 7. 落地接入清单

当在全新项目中使用 `mybuysomething` 技能时，按以下顺序执行即可：

- [ ] **步骤 1：初始化 Next.js App Router 项目**
  - 安装核心依赖：`pg`、`@types/pg`、`lucide-react`、`tailwindcss`。
- [ ] **步骤 2：创建 `lib/db.ts` 与 `lib/tenant.ts`**
  - 复制多租户解析方法与 Neon PostgreSQL 连接池；
  - 在 `ensureDatabase()` 中写入建表脚本并注入 `_seeded` 初始化防覆写锁。
- [ ] **步骤 3：搭建 `/admin` 管理后台与 API 路由**
  - `/api/dishes`、`/api/orders`、`/api/tables`、`/api/settings`、`/api/users` 均强制附带 `tenantId` 过滤。
- [ ] **步骤 4：构建前端消费级购物端**
  - 接入 `Navbar`、`OrderingClient`、`CartDrawer`；
  - 根据 `settings` 与 `tables.length` 联动隐藏/展示桌号按钮。
- [ ] **步骤 5：上线部署至 Render**
  - 连接 GitHub，在 Render Dashboard 配置 `DATABASE_URL`。
- [ ] **步骤 6：配置 UptimeRobot 守护**
  - 添加 `5 minutes` HTTP(s) 心跳探测，保障微信 1 秒内秒开体验。
