# 参考规范一：数据库多租户隔离与通用 SaaS 模型

本规范定义 **Next.js App Router + PostgreSQL 原生 SQL（`pg`）** 下的租户解析链、共享数据库分区 Schema 以及通用业务域映射方法。

---

## 1. 租户上下文解析契约（`lib/tenant.ts`）

服务端在每一个 API Route 与 Server Component 中，必须使用统一的租户提取器，严禁各接口自行拼接或信任未清洗的客户端输入。

### 解析优先级链
1. **URL 查询参数**：`?tenant=xxx` 或 `?t=xxx`（最高优先级，用于分店/工作区直达链接、扫码入口与管理后台切换）。
2. **自定义请求头**：`x-tenant-id`（用于 API 网关、反向代理子路径或 Webhook 转发）。
3. **浏览器 Cookie**：`app_tenant_id`（用于页面刷新与同租户后续异步请求保持会话上下文）。
4. **默认主租户**：`'default'`（兜底平台主租户）。

### 标准化参考实现

```ts
import { NextRequest } from 'next/server';

export const DEFAULT_TENANT_ID = 'default';
export const TENANT_COOKIE_NAME = 'app_tenant_id';

export function normalizeTenantId(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_TENANT_ID;
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || DEFAULT_TENANT_ID;
}

export function getTenantIdFromRequest(req: NextRequest): string {
  const queryTenant = req.nextUrl.searchParams.get('tenant') || req.nextUrl.searchParams.get('t');
  if (queryTenant && queryTenant.trim()) return normalizeTenantId(queryTenant);

  const headerTenant = req.headers.get('x-tenant-id');
  if (headerTenant && headerTenant.trim()) return normalizeTenantId(headerTenant);

  const cookieTenant = req.cookies.get(TENANT_COOKIE_NAME)?.value;
  if (cookieTenant && cookieTenant.trim()) return normalizeTenantId(cookieTenant);

  return DEFAULT_TENANT_ID;
}
```

### 写入接口的租户绑定铁律
- 任何需要写入数据的受保护接口（`POST` / `PUT` / `PATCH` / `DELETE`），**必须以鉴权守卫返回的 `auth.actor.tenantId` 作为 SQL `WHERE tenant_id = $1` 的唯一依据**。
- 即使请求 JSON Body 中携带 `tenantId` 字段，也一律忽略或校验其必须与 `auth.actor.tenantId` 一致，防止水平越权。

---

## 2. PostgreSQL 共享库分区表 Schema 模板

采用 **Shared Database, Shared Schema with `tenant_id` Discriminator** 模式，兼顾无限横向开户（毫秒级开通新租户）与极低运维成本。

### 核心底座表（所有项目通用必建）

```sql
-- 1. 租户主表
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  plan VARCHAR(32) NOT NULL DEFAULT 'standard',
  status SMALLINT NOT NULL DEFAULT 1, -- 1=正常运营, 0=已冻结
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 数据库管理员表（支持平台超管与分店/工作区管理员）
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username VARCHAR(80) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL, -- scrypt "salt:hash"
  role_scope VARCHAR(32) NOT NULL DEFAULT 'tenant_admin', -- 'platform_master' | 'tenant_admin'
  enabled SMALLINT NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 1, -- 改密或强制下线时递增
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, username)
);

-- 3. 租户动态角色表（RBAC）
CREATE TABLE IF NOT EXISTS tenant_roles (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_key VARCHAR(64) NOT NULL,
  name VARCHAR(80) NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]', -- JSON 字符串数组
  is_system SMALLINT NOT NULL DEFAULT 0, -- 1=内置预设角色（不可删 key，可调权限）
  enabled SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, role_key)
);

-- 4. 租户员工账号表（使用纯数字/手机号登录）
CREATE TABLE IF NOT EXISTS staff_users (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL,
  password_hash TEXT NOT NULL, -- scrypt "salt:hash"
  role_key VARCHAR(64) NOT NULL,
  role_id INTEGER REFERENCES tenant_roles(id) ON DELETE SET NULL,
  enabled SMALLINT NOT NULL DEFAULT 1,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

-- 5. 租户级键值配置表（品牌、开关、通道配置分桶存储）
CREATE TABLE IF NOT EXISTS settings (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);

-- 6. 租户终端客户/会员表（复合主键防止跨租户 ID 碰撞）
CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id VARCHAR(64) NOT NULL,
  name VARCHAR(80) NOT NULL DEFAULT '',
  phone VARCHAR(32) NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);
```

### 通用 SaaS 业务扩展表（按项目领域裁剪或重命名）

```sql
-- 7. 通用业务资源/目录表（如：商品、菜品、服务项目、课程、SaaS模板）
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL DEFAULT '默认分类',
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- 领域扩展字段（如库存/时长/规格）
  status SMALLINT NOT NULL DEFAULT 1, -- 1=上架/启用, 0=下架/停用
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resources_tenant ON resources(tenant_id, status, category);

-- 8. 通用业务单据/工单表（如：订单、预约单、工单、任务单）
CREATE TABLE IF NOT EXISTS work_orders (
  id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id VARCHAR(64),
  order_type VARCHAR(32) NOT NULL DEFAULT '标准',
  workflow_status VARCHAR(32) NOT NULL DEFAULT '待处理',
  payment_status VARCHAR(32) NOT NULL DEFAULT '未支付',
  assignee_staff_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, -- 明细快照与扩展字段
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_status ON work_orders(tenant_id, workflow_status, created_at DESC);
```

---

## 3. 幂等初始化与引导种子规范

1. **单例初始化锁**：在 `lib/db.ts` 中使用全局 Promise 锁（`let initPromise: Promise<void> | null = null`），确保并发请求下仅执行一次 `CREATE TABLE IF NOT EXISTS` 与种子初始化。
2. **默认主租户兜底**：自动插入 `tenants(id='default', name='平台总控制台')`（`ON CONFLICT DO NOTHING`）。
3. **首个平台主管理员引导**：
   - 检查 `admin_users` 中是否存在 `role_scope = 'platform_master'` 记录。
   - 若不存在，读取 `process.env.BOOTSTRAP_MASTER_USER`（默认 `master`）与 `process.env.BOOTSTRAP_MASTER_PASS`；若环境变量未设密码，则使用 `crypto.randomBytes(9).toString('base64url')` 生成随机强口令写入哈希，并在控制台输出一次性引导提示，同时支持在首次登录后修改密码。
4. **新建子租户事务化开户**：
   - 平台主管理员创建新租户时，在一个数据库事务中完成：
     1. 插入 `tenants` 记录；
     2. 为该租户创建至少 1 个默认 `tenant_admin` 管理员账号（由平台管理员指定用户名与初始密码，强哈希存库）；
     3. 初始化该租户的预设 `tenant_roles`（如：`operator` 运营专员、`viewer` 只读观察员）；
     4. 写入默认 `settings`（如店名/品牌名、默认运营开关）。

---

## 4. 通用业务域适配映射参考

| 目标业务领域 | `resources` 映射为 | `work_orders` 映射为 | 预设员工角色示例 |
| :--- | :--- | :--- | :--- |
| **多门店餐饮/零售** | 菜品/商品 SKU | 堂食/外带/外卖订单 | 备餐员、接单配送员、收银员 |
| **美业/医疗/场馆预约** | 服务项目/医生排班 | 到店预约单与核销单 | 技师/顾问、前台接待 |
| **B2B 企业客服工单** | 服务目录/SLA 模板 | 客户问题工单 | 一线客服、二线技术支持、审核主管 |
| **在线教育/知识付费** | 课程/专栏目录 | 学员报名与作业批改单 | 助教、班主任、教务运营 |
| **多团队协作 SaaS** | 项目空间/模板库 | 任务单/审批单 | 项目成员、审批主管 |
