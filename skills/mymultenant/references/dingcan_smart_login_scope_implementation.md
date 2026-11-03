# Reference: Identity-Blind Login & Scope Privileges (dingcan_postgresql production implementation)

Battle-tested implementation distilled from a live multi-restaurant ordering SaaS
(Next.js 15 App Router + Neon PostgreSQL, row-level `tenant_id` isolation, 6 tenants).
This is the concrete counterpart to SKILL.md Pillars 4-7 / section 3.3 — copy-adapt these
shapes rather than reinventing them.

## Context snapshot

| Item | Value |
|---|---|
| Staff table | `staff_users(id SERIAL, tenant_id, name, phone, password, role='order_handler', enabled, …)` with `UNIQUE(tenant_id, phone)` |
| Admin credential | single global pair (`admin` / fixed password) shared by master + branch admins |
| Sessions | `admin_auth` cookie (admin), `staff_auth` cookie (staff, httpOnly, 30d, base64url JSON `{id, tenantId, phone}`), `admin_scope` cookie (login-time identity, httpOnly, 7d) |
| Tenants | master = `default`; branches = arbitrary slugs (e.g. `zhou`) |

## 1. Smart single-form login (frontend, React)

State: only `loginAccount`, `loginPass`, `loginError`, `isLoggingIn` — the old dual-tab /
dual-credential states were deleted entirely.

```tsx
// Page chrome is identity-blind: title = store name, subtitle = 欢迎登录, nothing else.
const handleSmartLogin = async (e: React.FormEvent) => {
  const account = loginAccount.trim();
  const pass = loginPass.trim();
  if (!account || !pass) { setLoginError('请输入账号和密码'); return; }
  setLoginError(''); setIsLoggingIn(true);
  try {
    if (/^[0-9]{5,20}$/.test(account)) {
      // ---- staff channel ----
      const res = await fetch('/api/admin/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account, password: pass, tenant: currentTenantId }),
      });
      const data = await res.json();
      if (data.success && data.staff) {
        setStaffInfo(data.staff); setAdminScope(''); setIsAuthenticated(true);
        setActiveTab('orders'); setLoginPass('');
        // tenant self-healing: URL carried a wrong tenant param → snap to the staff's real store
        if (data.staff.tenantId && data.staff.tenantId !== currentTenantId) {
          updateActiveTenant(data.staff.tenantId); // sets state + URL (?tenant=) + cookie
        }
      } else {
        setLoginError(data.error || '手机号或密码错误，请联系店长'); // sanitized: no admin wording
      }
    } else {
      // ---- admin channel ----
      // garbage tenant param (e.g. a phone pasted into tenant=) → log in as master instead
      const knownTenant = tenants.some((t) => t.id === currentTenantId) ? currentTenantId : 'default';
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: account, password: pass, tenant: knownTenant }),
      });
      const data = await res.json();
      if (data.success) {
        setStaffInfo(null); setAdminScope(knownTenant); setIsAuthenticated(true);
        safeSetItem('restaurant_admin_auth', 'true');
        updateActiveTenant(knownTenant); setLoginPass('');
      } else {
        setLoginError('账号或密码错误'); // neutral: never names a channel
      }
    }
  } finally { setIsLoggingIn(false); }
};
```

**Page-level leaks that were removed (byte-verified):** subtitle `管理后台登录 · 验证管理员身份`,
tenant badge (`总店管理后台` / `分店后台`), dual tabs (`管理员登录` / `接单员登录`),
staff hint paragraph, per-channel button labels. Remaining page text: store name, `欢迎登录`,
`账号`, `密码`, `立即登录`, `返回前台点餐页面`.

## 2. Staff login with cross-tenant credential fallback (server route)

```ts
const tenantId = body?.tenant ? normalizeTenantId(String(body.tenant)) : getTenantIdFromRequest(req);

// 1) exact context (fast path)
let staff = await verifyStaffLogin(tenantId, phone, password);

// 2) fallback: page tenant may be wrong (e.g. phone pasted into tenant=) → resolve by credentials
if (!staff) {
  const candidates = await findStaffByCredentials(phone, password); // WHERE phone + password + enabled=1
  if (candidates.length === 1) staff = candidates[0];
  else if (candidates.length > 1) return 401 { error: '该手机号在多家门店均存在，请打开对应门店页面登录' };
}
if (!staff) return 401 { error: '手机号或密码错误，或该接单员已被停用（请联系店长）' };

// session cookie encodes DB-true values (never the URL values)
cookies.set('staff_auth', base64url({ id: staff.id, tenantId: staff.tenant_id, phone: staff.phone }), { httpOnly: true, maxAge: 30d });
cookies.set('dingcan_tenant_id', staff.tenant_id);        // correct the tenant context cookie too
cookies.set('admin_auth', '', { maxAge: 0 });             // dual-session hygiene
cookies.set('admin_scope', '', { maxAge: 0 });
```

DB helpers:

```ts
// exact match
SELECT * FROM staff_users WHERE tenant_id = $1 AND phone = $2 AND password = $3 AND enabled = 1;
// cross-tenant fallback (expect ≤ 1 row; >1 = ambiguous)
SELECT * FROM staff_users WHERE phone = $1 AND password = $2 AND enabled = 1 ORDER BY tenant_id;
// silent re-validation used by /auth/check on EVERY load → instant revocation
SELECT * FROM staff_users WHERE id = $1 AND tenant_id = $2 AND phone = $3 AND enabled = 1;
```

## 3. Login-time scope for master-only destructive operations

```ts
// admin login (server): scope = login-page tenant. /admin → 'default' (superadmin)
const scopeTenant = normalizeTenantId(String(body.tenant || ''));
response.cookies.set({ name: 'dingcan_admin_scope', value: scopeTenant, httpOnly: true, sameSite: 'lax', maxAge: 7d });

// auth-check (server): expose scope for UI gating; missing = '' (legacy → fail-closed)
const rawScope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase() || '';
return res.json({ authenticated: true, role: 'admin', scope: rawScope });

// privileged endpoint (server): DELETE order — double guard + tenant-scoped transaction
if (adminCookie !== TOKEN) return 401;
const rawScope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase();
if (rawScope !== 'default') return 403 { error: '订单删除为主租户(总店)超级管理员专属权限…' };
await deleteOrder(id, tenantId); // tx: DELETE order_items WHERE order_id+tenant_id → DELETE orders WHERE id+tenant_id RETURNING (miss → ROLLBACK → 404)

// frontend UI gating reads scope, NOT the URL tenant:
const canDeleteOrders = !isStaffMode && adminScope === 'default';
```

## 4. Handler attribution

Staff session present on an order-status PATCH → the verified staff name is stamped into
`orders.handler_name`. Admin (no staff session) passes an empty name, so existing stamps are
never overwritten. Order card renders a `接单:<name>` badge from this column.

## 5. Verification matrix (all executed against production DB on a scratch tenant)

| # | Assertion | Result |
|---|---|---|
| 1 | Invalid phone (non-digit) rejected at creation | PASS |
| 2 | Duplicate phone within same tenant blocked by unique index | PASS |
| 3 | Same phone registered under another tenant co-exists (row isolation) | PASS |
| 4 | Correct phone+password+tenant login succeeds | PASS |
| 5 | Wrong password rejected | PASS |
| 6 | Correct credentials against WRONG tenant context rejected | PASS |
| 7 | Disable → login/session verification fails immediately; re-enable → works | PASS |
| 8 | Handler stamp written on operator transition; admin op never overwrites | PASS |
| 9 | deleteOrder: wrong tenant → false + data intact; missing → false; correct → order+items gone | PASS |
| 10 | DELETE guard matrix: no cookie 401 / branch scope 403 / missing scope 403 / staff cookie 401 / master 200 | PASS |
| 11 | Scratch-tenant cleanup leaves real tenants untouched | PASS |

UI text-leak scan after the single-form refactor: page contains zero occurrences of
`管理员登录 / 接单员登录 / 管理后台 / 分店后台 / 总店管理后台` (byte-level search); type-check clean.
