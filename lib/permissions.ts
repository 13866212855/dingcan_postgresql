/**
 * 租户级权限目录（RBAC 单一事实来源）
 *
 * 设计约定（2026-11-12 定稿）：
 * - 管理员（admin cookie 会话）隐式持有 ALL_TENANT_PERMS 全集；
 * - 员工（staff 会话）权限 = 所属角色 tenant_roles.permissions（实时查库，不进 cookie）；
 * - nonDelegable 键（llm.manage / settings.payment）永不进角色——保存角色时服务端强制剔除；
 * - sensitive 键在角色编辑器中勾选需强警告；destructive 键默认不勾；cost 键消耗大模型 token；
 * - 平台级能力（跨租户删单 / 连锁分店管理）不进本目录，由 dingcan_admin_scope cookie 机制独立守卫。
 */

export interface PermissionDef {
  key: string;
  name: string;
  desc: string;
  module: string; // 分组名（角色编辑器按此分组展示）
  sensitive?: boolean; // 勾选时 UI 强警告（涉钱/涉凭证）
  destructive?: boolean; // 破坏性操作，默认不勾
  cost?: boolean; // 消耗大模型 token / 产生费用
  nonDelegable?: boolean; // 永不可授予角色（仅管理员会话可执行）
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  // ---- 订单中心 ----
  { key: 'orders.view', name: '查看订单', desc: '进入订单中心，查看本店全部订单与明细', module: '订单中心' },
  { key: 'orders.process', name: '订单流转', desc: '接单制作、出餐完成、取消订单等状态推进', module: '订单中心' },
  { key: 'orders.payment', name: '切换收款状态', desc: '在订单上手动标记已收款/未收款', module: '订单中心', sensitive: true },
  { key: 'orders.revenue', name: '营收统计可见', desc: '查看后台"实付流水营收"汇总卡（逐单金额随订单可见，本键只控聚合统计）', module: '订单中心', sensitive: true },
  // ---- 后厨 / 配送 ----
  { key: 'kitchen.view', name: '后厨备餐大屏', desc: '进入后厨备餐视图，汇总待做菜品、开火制作、一键齐餐', module: '后厨与配送' },
  { key: 'delivery.claim', name: '接单配送', desc: '外卖单抢单接单、到店提货、去送货、送达完成', module: '后厨与配送' },
  // ---- 菜品库 ----
  { key: 'dishes.view', name: '查看菜品库', desc: '进入菜品库查看本店菜品', module: '菜品库' },
  { key: 'dishes.manage', name: '菜品管理', desc: '新增/编辑/上下架/删除菜品，批量创建，从总店拉取菜品', module: '菜品库' },
  { key: 'dishes.batch_ai', name: '智能批量添加(AI)', desc: '粘贴文本由大模型解析菜名价格并 AI 生成配图（消耗大模型额度）', module: '菜品库', cost: true },
  { key: 'dishes.export_import', name: '菜品导入导出', desc: '导出菜品 JSON 包（可含图片）、从 JSON 包导入菜品', module: '菜品库' },
  { key: 'dishes.clear', name: '清空菜品库', desc: '一键删除本店全部菜品（不可恢复）', module: '菜品库', destructive: true },
  // ---- 餐桌 ----
  { key: 'tables.view', name: '查看餐桌', desc: '查看本店餐桌列表与占用状态', module: '餐桌管理' },
  { key: 'tables.manage', name: '餐桌管理', desc: '增删改餐桌、桌码生成', module: '餐桌管理' },
  // ---- 会员 ----
  { key: 'members.view', name: '查看会员', desc: '查看本店会员列表与积分余额', module: '会员积分' },
  { key: 'members.manage', name: '会员管理', desc: '会员充值、积分调整（涉资金，谨慎授予）', module: '会员积分', sensitive: true },
  // ---- 员工与角色 ----
  { key: 'staff.view', name: '查看员工账号', desc: '查看本店员工列表', module: '员工与角色' },
  { key: 'staff.manage', name: '管理员工账号', desc: '添加/启停/重置密码/删除本店员工（只能分配权限不多于自身的角色）', module: '员工与角色' },
  { key: 'roles.manage', name: '配置角色权限', desc: '创建/编辑本店角色及其权限（防越权：角色权限不得超过自身）', module: '员工与角色', sensitive: true },
  // ---- 品牌与配置 ----
  { key: 'store.manage', name: '店面品牌设置', desc: '修改店名、Logo、宣传语', module: '品牌与配置' },
  { key: 'settings.ops', name: '运营配置', desc: '就餐方式开关、桌号规则、外卖费用、扫码返回即亮、打印与通知配置', module: '品牌与配置' },
  { key: 'settings.payment', name: '收款与支付配置', desc: '收款码、积分比例、虎皮椒支付通道凭据（永不下放，仅管理员可改）', module: '品牌与配置', nonDelegable: true },
  { key: 'llm.manage', name: 'AI大脑配置', desc: '大模型 API Key 等核心配置（永不下放，仅管理员可改）', module: '品牌与配置', nonDelegable: true },
];

export const ALL_TENANT_PERMS: string[] = PERMISSION_CATALOG.map((p) => p.key);

const CATALOG_MAP = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));

export function getPermissionDef(key: string): PermissionDef | undefined {
  return CATALOG_MAP.get(key);
}

/** 保存角色时的服务端净化：剔除未知键与 nonDelegable 键（永不下放铁律） */
export function sanitizeRolePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    const key = String(raw);
    const def = CATALOG_MAP.get(key);
    if (def && !def.nonDelegable) seen.add(key); // nonDelegable 永不可入角色
  }
  return Array.from(seen);
}

/** 系统种子角色的权限预设（tenant_roles 种子回填用） */
export const SYSTEM_ROLE_PRESETS: Record<string, { name: string; permissions: string[] }> = {
  order_handler: {
    name: '接单配送员',
    permissions: ['orders.view', 'orders.process', 'orders.payment', 'delivery.claim'],
  },
  kitchen: {
    name: '后厨备餐员',
    permissions: ['orders.view', 'orders.process', 'kitchen.view'],
  },
};

/** settings 写接口的键 → 权限桶映射（POST 只写出现的键，逐键判定归属） */
const SETTINGS_KEY_BUCKETS: Record<string, string> = {
  // settings.payment 桶（nonDelegable：角色永远拿不到，仅管理员可写）
  payment_qr_code: 'settings.payment',
  points_ratio: 'settings.payment',
  pay_mode: 'settings.payment',
  xhu_appid: 'settings.payment',
  xhu_secret: 'settings.payment',
  xhu_gateway: 'settings.payment',
  pay_notify_base: 'settings.payment',
  // store.manage 桶
  restaurant_name: 'store.manage',
  restaurant_logo: 'store.manage',
  restaurant_slogan: 'store.manage',
  // llm.manage 桶
  llm_base_url: 'llm.manage',
  llm_api_key: 'llm.manage',
  llm_text_model: 'llm.manage',
  llm_image_model: 'llm.manage',
  llm_auto_process_images: 'llm.manage',
  llm_max_image_dimension: 'llm.manage',
  llm_image_quality: 'llm.manage',
  // 其余出现即归 settings.ops（在 getSettingsKeyBucket 内兜底）
};

export function getSettingsKeyBucket(key: string): string {
  if (SETTINGS_KEY_BUCKETS[key]) return SETTINGS_KEY_BUCKETS[key];
  if (key === 'tenantId') return ''; // 路由参数键，非配置键
  return 'settings.ops'; // enable_* / table_* / takeout_* / scan_return_confirm / printer_* / smtp_* / 通知推送 / amap_web_key / custom_domain 等
}
