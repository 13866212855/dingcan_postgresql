---
name: my_create_multenant
description: >
  通用多租户 SaaS 全栈架构构建技能（基于 Next.js App Router + PostgreSQL 原生 SQL）。
  当用户需要新建或重构具备以下核心能力的项目时使用：多租户数据与上下文隔离、
  前后台分离、动态 RBAC 角色权限分配（含防越权护栏）、多租户全角色统一单入口智能登录，
  以及数据库级管理员表与 HMAC-SHA256 签名令牌鉴权。
---

# 多租户全栈架构构建规范（my_create_multenant）

本技能用于指导智能体在 **Next.js App Router + PostgreSQL 原生 SQL** 技术栈下，从零构建一套生产可用的通用多租户 SaaS 系统骨架。所有默认界面、提示文案与注释均使用中文。

---

## 1. 适用场景

当新项目满足以下任意特征时，启用本技能：
1. 系统需要支持多企业、多门店、多团队或独立工作区（租户）的数据物理/逻辑隔离。
2. 需要前后台分离：面向终端客户的公开/半公开门户，与面向商家/企业员工的运营管理后台。
3. 需要灵活的动态 RBAC 权限体系：平台超级管理员、租户管理员以及租户自定义的任意业务岗位员工。
4. 需要简洁统一的登录体验：平台管理员、租户管理员与各租户员工共用同一个登录入口，无暴露后台体系的冗余标签。

---

## 2. 不可妥协的架构红线（8 条铁律）

1. **服务端租户裁决铁律**：任何受保护的读写接口必须由服务端从请求上下文（Query > Header > Cookie > 默认租户）解析并清洗 `tenant_id`，绝不信任客户端请求体中跨租户传入的归属字段。
2. **数据库管理员与签名令牌铁律**：禁止硬编码管理员账号密码或明文自报身份 Cookie。管理员与员工均由数据库持久化存储（`scrypt` 随机盐哈希），会话 Cookie 必须使用服务端密钥进行 `HMAC-SHA256` 签名并设置 `HttpOnly`。
3. **实时回查数据库铁律**：签名校验通过后，鉴权层仍需回查数据库核实账号 `enabled = 1` 及所属角色的最新权限，确保“停用即刻失效、改权下一屏生效”。
4. **会话互斥清理铁律**：同一浏览器或公用设备上，管理员登录成功必须清除员工会话 Cookie；员工登录成功必须清除管理员会话 Cookie，杜绝双身份串号。
5. **Fail-Closed 默认拒绝铁律**：未认证访客或会话作用域与目标租户不匹配的请求，一律返回 401/403，禁止回退到宽松默认权限。
6. **不可下放敏感权限铁律**：支付通道凭据、第三方核心 API Key、大模型密钥等平台高危配置标记为 `nonDelegable`，服务端保存角色时强制剔除，永不可授予普通员工角色。
7. **授权子集铁律**：当员工被授予“管理角色/员工”权限时，其创建或编辑的角色权限集必须是其自身持有权限的子集，从服务端彻底阻断横向或纵向提权。
8. **登录错误脱敏铁律**：单入口登录失败时，返回中性错误提示，绝不向未认证前端泄露“该账号是管理员还是员工”或“账号存在但密码错误”等体系线索。

---

## 3. 标准构建流水线（按顺序实施）

智能体在新项目中落地方案时，按以下 6 个阶段依次推进：

### 阶段 1：环境变量与基础契约
- 在 `.env.example` 中声明：
  - `DATABASE_URL`：PostgreSQL 连接串。
  - `AUTH_SESSION_SECRET`：用于 `HMAC-SHA256` 会话签名的 32 位以上随机密钥。
  - `BOOTSTRAP_MASTER_USER` / `BOOTSTRAP_MASTER_PASS`：仅用于首次空库初始化平台主管理员的引导变量（若未配置，启动初始化时自动生成随机口令并在服务端日志输出一次）。
- 详见 [数据库隔离与模型规范](references/1_database_and_tenant_isolation.md)。

### 阶段 2：多租户上下文解析与 PostgreSQL 底座
- 实现 `lib/tenant.ts`：`normalizeTenantId`（小写、仅保留 `[a-z0-9_-]`，空值回退 `'default'`）与 `getTenantIdFromRequest`（Query `?tenant=`/`?t=` → Header `x-tenant-id` → Cookie `app_tenant_id` → `'default'`）。
- 实现 `lib/db.ts`：单例连接池 + `initDb()` 幂等建表脚本，覆盖 `tenants`、`admin_users`、`staff_users`、`tenant_roles`、`settings`、`tenant_members` 及通用业务表（`resources`、`work_orders`）。
- 所有租户表强制包含 `tenant_id` 字段并建立 `(tenant_id, ...)` 复合主键或复合索引。

### 阶段 3：密码哈希、HMAC 令牌与双轨认证内核
- 实现 `lib/cryptoAuth.ts`：基于 Node.js 原生 `crypto.scryptSync` + `timingSafeEqual` 的密码哈希工具，以及 `signSessionToken` / `verifySessionToken` 工具。
- 实现 `lib/authz.ts`：统一 `resolveActor(req)`，输出 `platform_master`、`tenant_admin`、`staff`、`anon` 四种标准身份，并提供 `requirePerm(req, perm)`、`requirePlatformMaster(req)` 与 `partitionSettingsKeysByPermission(...)` 配置分桶守卫。
- 详见 [签名鉴权与 RBAC 引擎规范](references/2_auth_signing_and_rbac.md)。

### 阶段 4：通用动态 RBAC 目录与角色引擎
- 实现 `lib/permissions.ts`：维护领域可扩展的 `PERMISSION_CATALOG` 单一事实来源，标注 `module`、`sensitive`、`destructive`、`cost`、`nonDelegable`。
- 实现角色管理接口 `/api/admin/roles`（与 `/api/admin/roles/[id]`）及员工管理接口 `/api/admin/staff`（与 `/api/admin/staff/[id]`），强制执行 `sanitizeRolePermissions` 与授权子集检查。

### 阶段 5：单入口智能登录与会话自愈接口
- 实现统一登录路由：
  - `/api/admin/login`（管理员通道：校验 `admin_users` 数据库加盐哈希，识别 `platform_master` 与 `tenant_admin` 作用域，签发管理员签名 Cookie 并清理员工 Cookie）。
  - `/api/admin/staff-login`（员工通道：优先匹配当前租户 `staff_users`；若未命中则跨租户凭据全局唯一自愈定位并纠正租户 Cookie；多租户重名重密冲突则拦截提示，签发员工签名 Cookie 并清理管理员 Cookie）。
  - `/api/admin/check`（会话探活：实时返回 `actorType`、`tenantId`、`adminScope`、`permissions` 及脱敏身份信息）。
  - `/api/admin/logout`（双通道统一注销，同步清空管理员与员工 Cookie）。

### 阶段 6：前后台分离页面与交互落地
- 前台 `/`：服务端 `generateMetadata` 按当前租户动态读取品牌名与宣传语渲染 SEO/分享卡片；前端状态严格隔离在当前 `tenantId` 作用域。
- 后台 `/admin`：
  - 无参访问 `/admin` 时强制清理浏览器残留的前台租户 Cookie 并锁定 `'default'`，保护主控制台视角不被污染。
  - 未认证时渲染“中性单入口登录表单”（不显示身份切换 Tab，前端依据账号是否纯数字自动路由至员工或管理员接口）。
  - 已认证后由 `can(perm)` 驱动全部导航 Tab、页面区块与操作按钮，并在无权停留当前 Tab 时自动回落至首个有权模块。
- 详见 [前后台分离与 UI 交互契约](references/3_frontend_separation_and_ui.md)。

---

## 4. 参考文档索引

| 文档 | 核心内容 | 何时阅读 |
| :--- | :--- | :--- |
| [1. 数据库隔离与通用 SaaS 模型](references/1_database_and_tenant_isolation.md) | 租户解析链、PostgreSQL 全表 DDL、业务表扩展映射指南 | 设计数据库与多租户上下文层时 |
| [2. 签名鉴权与动态 RBAC 引擎](references/2_auth_signing_and_rbac.md) | scrypt 哈希、HMAC 令牌、双轨路由登录、防越权与分桶校验 | 编写认证接口、中间件与权限目录时 |
| [3. 前后台分离与 UI 交互契约](references/3_frontend_separation_and_ui.md) | 动态元数据、无参 `/admin` 自净、单入口表单、权限裁剪与矩阵编辑器 | 开发前端页面、登录页与管理控制台时 |

---

## 5. 交付前验收核对清单

完成新项目代码生成后，必须逐项确认：
- [ ] **零硬编码密码**：代码库中不存在写死的管理员明文账号密码；`admin_users` 使用随机盐哈希。
- [ ] **Cookie 签名防伪**：管理员与员工 Cookie 均携带 HMAC-SHA256 签名与过期时间戳，且经过服务端 `timingSafeEqual` 校验。
- [ ] **会话实时失效**：停用管理员、停用员工或停用角色后，目标会话在下一次请求立即返回 401/403。
- [ ] **跨租户物理隔离**：子租户管理员带上他店 `?tenant=` 参数发起请求时，`resolveActor` 判定作用域不符并返回匿名拒绝。
- [ ] **防越权闭环**：普通员工尝试调用角色接口写入 `settings.payment` 或自身未持有的权限时，服务端返回 403 并拒绝写入。
- [ ] **单入口自愈**：员工在携带错误 `?tenant=` 参数的后台页输入正确手机号与密码，可自动纠正租户上下文并进入所属门店工作台。
- [ ] **前后台无串号**：在前台访问分店 B 后直接打开 `/admin`，自动复位为 `'default'` 总后台视角，不继承分店 B 状态。
- [ ] **全中文展示**：所有页面标题、表单标签、错误提示、状态标签与导航菜单均为中文。
