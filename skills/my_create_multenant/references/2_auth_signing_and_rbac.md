# 参考规范二：HMAC 签名鉴权、单入口分流与动态 RBAC 引擎

本规范定义基于数据库的密码哈希、HMAC-SHA256 签名会话令牌、多租户全角色单入口智能登录以及三层动态 RBAC 权限裁决逻辑。

---

## 1. 密码哈希与签名密钥管理（`lib/cryptoAuth.ts`）

### 密码哈希（Node.js 原生 `crypto.scryptSync`）
- **禁止明文或普通 MD5/SHA256 存储密码**（无论是 `admin_users` 还是 `staff_users`）。
- 存储格式：`${saltHex}:${derivedKeyHex}`（16 字节随机盐 + 64 字节 scrypt 派生）。
- 验证方式：使用 `crypto.timingSafeEqual` 进行恒定时间比对，抵御时序侧信道攻击。

```ts
import crypto from 'crypto';

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${key}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!plain || !stored || !stored.includes(':')) return false;
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(plain, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}
```

### HMAC-SHA256 签名会话令牌
- 密钥来源：优先读取 `process.env.AUTH_SESSION_SECRET`；本地开发未设置时可使用进程级随机生成密钥或从 `DATABASE_URL` 派生的稳定密钥（同时在 `.env.example` 明确要求生产环境配置 `AUTH_SESSION_SECRET`）。
- 令牌结构：`${payloadBase64Url}.${signatureBase64Url}`。
- 载荷（Payload）字段约定：
  - **管理员令牌**：`{ typ: 'admin', uid: number, scope: string, ver: number, exp: number }`
    - `scope`：`'default'` 代表平台超管，其余为具体 `tenant_id` 代表租户管理员。
    - `ver`：对应 `admin_users.token_version`，修改密码或冻结账号后立即使旧 Cookie 失效。
  - **员工令牌**：`{ typ: 'staff', uid: number, tenantId: string, ver: number, exp: number }`
    - **重要**：权限数组不写入 Cookie，防止权限变更后产生陈旧缓存；每次请求验签通过后实时查库解析 `tenant_roles.permissions`。

---

## 2. 统一单入口智能登录与跨租户自愈

管理员与所有租户员工共用同一个登录页与中性表单（仅含“账号”与“密码”两个输入框，不出现“管理员/员工切换开关”）。

### 账号形态自动识别分流
- 前端提交时判断账号格式：
  - 匹配 `/^[0-9]{5,20}$/`（纯数字手机号或工号）→ 请求员工登录接口 `/api/admin/staff-login`。
  - 其他字符格式（用户名或邮箱）→ 请求管理员登录接口 `/api/admin/login`。
- 两条通道的失败响应统一返回 `401` 与脱敏文案（如：`账号或密码错误，或账号已被停用`），不暴露后台账号体系差异。

### 管理员登录通道（`/api/admin/login`）
1. 校验请求租户上下文 `tenantId = getTenantIdFromRequest(req)`。
2. 查询 `admin_users`：
   - 优先查找 `(tenant_id = tenantId AND username = $1 AND enabled = 1)`；
   - 若在子租户页面登录未命中，且存在 `(role_scope = 'platform_master' AND username = $1 AND enabled = 1)`，允许平台超管登录并锁定 `scope = 'default'`（或按需限制平台超管仅可从主控制台登录——推荐策略：无参 `/admin` 登录赋予 `scope = 'default'` 全局权限；带 `?tenant=xxx` 登录时 `scope` 锁定为当前 `tenantId` 或数据库记录的 `tenant_id`，防止子店 URL 意外持有超管全权）。
   - 最清晰的做法：查询该 `username` 在当前 `tenantId` 的记录（若在 `'default'` 则查 `role_scope = 'platform_master'`；若在子租户查 `tenant_id = tenantId`），验证 `verifyPassword(password, user.password_hash)`。
3. 签发 `app_admin_auth` 签名令牌（`HttpOnly`、`SameSite=Lax`），**并立即清空 `app_staff_auth` 员工 Cookie**。

### 员工登录通道（`/api/admin/staff-login`）与跨租户自愈
1. 优先在当前上下文 `tenantId` 下按手机号查找 `enabled = 1` 的员工并校验 `verifyPassword`。
2. **跨租户自愈兜底**：若当前租户未命中（常见于员工误扫/收藏了总店或他店 `/admin` 链接），在全库 `staff_users (enabled = 1)` 中遍历匹配同手机号记录的密码哈希：
   - **唯一命中 1 条**：自动将登录态与 `app_tenant_id` Cookie 纠偏为该员工真实所属 `staff.tenant_id`，返回 `tenant: staff.tenant_id` 供前端同步 URL。
   - **命中多条（跨店同号同密冲突）**：返回 `401`，提示“该手机号在多家工作区均存在，请从所属工作区专属链接登录”。
3. 签发 `app_staff_auth` 签名令牌（`HttpOnly`、`SameSite=Lax`），**并立即清空 `app_admin_auth` 管理员 Cookie**。

### HTTP 预览与局域网 Cookie 兼容性
- 在局域网纯 HTTP 或云端反代 HTTP 场景下，Cookie `secure` 标志应根据实际协议动态判断（`req.nextUrl.protocol === 'https:'` 且非局域网直连，或显式由环境变量 `COOKIE_SECURE=true` 控制），避免浏览器因非 HTTPS 环境静默丢弃 `Secure` Cookie 导致登录后无限跳回登录页。

---

## 3. 三层动态 RBAC 与防越权护栏（`lib/permissions.ts` & `lib/authz.ts`）

### 通用权限目录骨架（`PERMISSION_CATALOG`）

```ts
export interface PermissionDef {
  key: string;
  name: string;
  desc: string;
  module: string;
  sensitive?: boolean;    // 涉资金/成员/角色管理，UI 勾选提示风险
  destructive?: boolean;  // 清空/批量删除等高危操作
  cost?: boolean;         // 消耗第三方付费接口/AI 额度
  nonDelegable?: boolean; // 永不可下放给角色（仅管理员可操作）
}
```

推荐基础权限模块分组：
1. **工作区与业务单据**：`orders.view`、`orders.process`、`orders.billing`（`sensitive`）、`analytics.revenue`（`sensitive`）
2. **业务资源库**：`resources.view`、`resources.manage`、`resources.import_export`、`resources.clear`（`destructive`）、`resources.ai_assist`（`cost`）
3. **客户与会员**：`members.view`、`members.manage`（`sensitive`）
4. **团队与角色**：`staff.view`、`staff.manage`、`roles.manage`（`sensitive`）
5. **品牌与系统设置**：`brand.manage`、`settings.ops`、`settings.payment`（`nonDelegable`）、`integrations.manage`（`nonDelegable`）

### 四项核心防越权守卫

1. **身份裁决 (`resolveActor`)**：
   - `platform_master`：管理员签名有效且 `scope === 'default'` → 对任意 `tenantId` 持有 `ALL_TENANT_PERMS` + 平台专有权限。
   - `tenant_admin`：管理员签名有效且 `scope === tenantId` → 仅对本租户持有 `ALL_TENANT_PERMS`（若 `scope !== tenantId`，立即降级为 `anon` 拒绝操作）。
   - `staff`：员工签名有效且 `payload.tenantId === tenantId` 且数据库 `enabled = 1` 且 `token_version` 一致 → 权限实时取自所属启用中角色 `tenant_roles.permissions`（并再次过滤掉任何 `nonDelegable` 键）。
   - `anon`：其余一切情况返回空权限数组 `[]`。

2. **角色保存净化 (`sanitizeRolePermissions`)**：
   - 创建或更新 `tenant_roles` 时，逐项校验 `PERMISSION_CATALOG`，过滤掉任何未知键与 `nonDelegable: true` 的键。

3. **授权子集铁律（防越权核心）**：
   - 当 `actor.type === 'staff'` 且持有 `roles.manage` 或 `staff.manage` 时：
     - 创建/修改角色的目标 `permissions` 必须满足：`targetPerms.every(p => actor.permissions.includes(p))`；
     - 为员工分配目标角色时，目标角色的权限集也必须满足：`rolePerms.every(p => actor.permissions.includes(p))`。
   - 若超出操作者自身权限集合，服务端立即返回 `403 Forbidden`。

4. **设置项分桶写入 (`partitionSettingsKeysByPermission`)**：
   - 对于统一的 `/api/settings` 写入接口，建立 `SETTINGS_KEY_BUCKETS` 映射表（例如：`payment_*` 归 `settings.payment`、`brand_*` 归 `brand.manage`、`ai_*` 归 `integrations.manage`，其余运营开关归 `settings.ops`）。
   - 仅写入请求体中属于 `actor` 持有权限桶的键值，未授权键静默剔除或拒绝，防止普通运营人员借通用设置接口篡改支付密钥。
