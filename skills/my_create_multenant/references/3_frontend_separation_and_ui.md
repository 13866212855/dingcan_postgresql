# 参考规范三：前后台分离架构与多租户 UI 交互契约

本规范定义前台客户门户、后台管理工作台、单入口登录页以及 RBAC 驱动 UI 裁剪的前端实现契约。所有界面默认全中文展示。

---

## 1. 前后台分离与租户作用域边界

| 维度 | 前台客户门户 (`/`, `/portal/*`) | 后台管理控制台 (`/admin`) |
| :--- | :--- | :--- |
| **服务对象** | 终端客户、访客、会员 | 平台主管理员、租户管理员、租户员工 |
| **租户读取方式** | 读取 URL `?tenant=` / Cookie `app_tenant_id`，支持各分店独立访问与分享 | 显式 `?tenant=xxx` 锁定分店；**无参访问 `/admin` 强制复位为 `'default'`** |
| **认证要求** | 公开浏览与受控提交（如提交订单/预约），仅调用白名单公开接口 | 强依赖 `HttpOnly` 签名 Cookie，全界面与 API 执行 Fail-Closed |
| **导航与元数据** | `generateMetadata` 按当前租户动态注入页面标题、描述与 OpenGraph 分享卡片 | 按权限 `can(perm)` 动态生成模块导航，屏蔽无权模块 |

### 无参 `/admin` 作用域自净规则（防前台 Cookie 污染）
用户在同一个浏览器先浏览了子租户前台（写入了 `app_tenant_id=shop_a` Cookie），随后在地址栏直接输入 `/admin` 期望进入总后台时：
- `/admin` 初始化状态时检查 `window.location.search`：
  - 若存在 `?tenant=` 或 `?t=`，锁定该子租户；
  - **若 URL 无租户参数**，主动将状态、`localStorage` 与 `document.cookie` 中的 `app_tenant_id` 重置为 `'default'`，再发起 `/api/admin/check` 会话探活。

### 租户切换同步器（仅平台主管理员可用）
```ts
const updateActiveTenant = useCallback((newTenantId: string) => {
  const cleanId = (newTenantId || 'default').trim().toLowerCase();
  setCurrentTenantId(cleanId);
  localStorage.setItem('app_tenant_id', cleanId);
  document.cookie = `app_tenant_id=${encodeURIComponent(cleanId)}; path=/; max-age=2592000; SameSite=Lax`;
  const url = new URL(window.location.href);
  if (cleanId !== 'default') {
    url.searchParams.set('tenant', cleanId);
  } else {
    url.searchParams.delete('tenant');
    url.searchParams.delete('t');
  }
  window.history.replaceState({}, '', url.pathname + url.search);
}, []);
```

---

## 2. 前台动态元数据与分享适配（SSR）

在 `app/page.tsx`（或租户根布局）中通过服务端 `generateMetadata` 读取 URL `searchParams.tenant` 与请求头 `cookies()`，从数据库加载对应租户的 `settings` 品牌名、Logo 与标语，生成独立的 `<title>`、`<meta name="description">` 与 `openGraph` 信息，确保不同租户的链接在微信、钉钉或社交平台分享时呈现各自专属品牌卡片。

---

## 3. 中性单入口智能登录界面规范

后台未登录态必须遵守以下界面契约：
1. **中性品牌外观**：顶部展示当前租户 Logo 与名称 + 副标题“欢迎登录”。
2. **禁止身份线索**：页面上不出现“管理员登录 / 员工登录”切换标签，不出现“主后台入口”暗示。
3. **单一表单与智能分流**：
   - 仅包含“账号”（`placeholder="请输入手机号或账号"`）、“密码”与“立即登录”按钮。
   - 提交时检测 `/^[0-9]{5,20}$/.test(account.trim())`：
     - 命中纯数字 → 请求 `POST /api/admin/staff-login`；
     - 未命中 → 请求 `POST /api/admin/login`。
4. **跨租户自愈回跳**：若员工登录接口返回 `res.tenant !== currentTenantId`，前端立即调用 `updateActiveTenant(res.tenant)` 纠正地址栏与 Cookie，然后无缝加载该员工所属租户的管理工作台。
5. **返回前台快捷链**：表单底部提供“返回前台页面”链接，自动携带当前 `?tenant=` 参数（若非 `default`）。

---

## 4. RBAC 驱动 UI 裁剪与管理界面设计

### 动态权限辅助函数与 Tab 回落机制
登录或 `/api/admin/check` 返回 `{ actorType, tenantId, adminScope, permissions, staffInfo }` 后：
- 定义 `const can = (perm: string) => permissions.includes(perm);`
- 导航 Tab 严格按 `can(...)` 显隐，平台级“租户/分店管理”Tab 额外约束 `actorType === 'platform_master'`（即 `adminScope === 'default'` 且非员工会话）。
- 计算有效 `activeTab`：如果当前停留在无权 Tab（例如切换账号或权限被管理员实时缩减后刷新），自动按优先级回落到第一个 `tabAllowed(t) === true` 的模块，避免空白页或死锁。

### 必配核心管理模块（均需全中文界面）
1. **租户管理模块（仅平台超管可见）**：
   - 支持新建子租户（同时录入该租户首个管理员用户名与初始密码，支持一键生成安全初始密码并复制开户链接 `/admin?tenant=xxx` 与前台链接 `/?tenant=xxx`）。
   - 支持切换至任意子租户视角进行代管协助，支持冻结/启用租户状态。
2. **角色权限矩阵编辑器（`roles.manage` 可见）**：
   - 按 `PERMISSION_CATALOG` 的 `module` 分组平铺权限复选框。
   - 明确隐藏或锁定标记为 `nonDelegable` 的平台级敏感权限，并标注原因（“平台专属，不可下放”）。
   - 对 `sensitive` / `destructive` / `cost` 权限展示清晰中文警示标签。
   - 若当前操作者为员工账号，自动置灰禁用操作者自身未持有的权限项，与服务端“授权子集铁律”保持前后端一致。
3. **员工账号管理模块（`staff.view` / `staff.manage` 可见）**：
   - 支持新增员工（手机号、姓名、初始密码、所属角色下拉框，角色列表来自 `GET /api/admin/roles`）。
   - 支持启停开关、重置密码（强制递增 `token_version` 使旧设备立即下线）与删除账号。
4. **管理员安全中心（`platform_master` / `tenant_admin` 可见）**：
   - 支持当前管理员修改自身登录密码，平台超管支持重置指定子租户管理员密码或增设分店副管理员。
