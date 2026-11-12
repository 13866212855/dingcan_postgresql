import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/db';
import { decodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { ALL_TENANT_PERMS } from '@/lib/permissions';
import { resolveStaffPermissions } from '@/lib/db';

/**
 * 服务端权限裁决（RBAC 真边界，mymultenant v2）：
 * - platform_master：/admin 无参登录的管理员会话（scope=default）——对任意租户持全部租户级权限
 * - tenant_admin：?tenant=xxx 登录（scope=本店）——仅对登录租户持全部租户级权限（平台超管切店视图同权）
 * - staff：员工会话——权限=所属角色 permissions（实时查库，角色被改下一屏生效；停用/删除即刻失效）
 * - anon：无会话或会话与请求租户不符 → 一律 fail-closed 拒绝
 */
export interface Actor {
  type: 'platform_master' | 'tenant_admin' | 'staff' | 'anon';
  tenantId: string; // 本次请求的目标租户
  permissions: string[];
  staffName?: string;
  staffPhone?: string;
  staffRole?: string;
}

export async function resolveActor(req: NextRequest): Promise<Actor> {
  const tenantId = getTenantIdFromRequest(req);

  // 1. 管理员会话（身份范围 = 登录时定死的 scope，与当前浏览租户无关）
  const adminToken = req.cookies.get('restaurant_admin_auth')?.value;
  if (adminToken === 'authenticated_admin_token') {
    const scope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase() || '';
    if (scope === 'default') {
      // 平台超管：对任意租户持全权（跨店管理）
      return { type: 'platform_master', tenantId, permissions: ALL_TENANT_PERMS };
    }
    if (scope === tenantId) {
      // 分店管理员：仅对登录租户持全权
      return { type: 'tenant_admin', tenantId, permissions: ALL_TENANT_PERMS };
    }
    // scope 与请求租户不符（分店管理员试图操作他店）→ 匿名拒绝（fail-closed）
    return { type: 'anon', tenantId, permissions: [] };
  }

  // 2. 员工会话：静默回查库（enabled=1），再实时解析角色权限
  const staffToken = req.cookies.get(STAFF_AUTH_COOKIE)?.value;
  const payload = decodeStaffSession(staffToken);
  if (payload) {
    try {
      const staff = await verifyStaffSession(payload);
      if (staff && staff.tenant_id === tenantId) {
        const permissions = await resolveStaffPermissions(staff);
        return {
          type: 'staff',
          tenantId,
          permissions,
          staffName: staff.name,
          staffPhone: staff.phone,
          staffRole: staff.role,
        };
      }
    } catch (err) {
      console.warn('[authz] Staff session resolve failed:', err);
    }
  }

  return { type: 'anon', tenantId, permissions: [] };
}

export function actorCan(actor: Actor, perm: string): boolean {
  return actor.permissions.includes(perm);
}

/**
 * 权限守卫：通过返回 { ok: true, actor }；不通过返回 401/403 响应（fail-closed，文案脱敏不泄露身份体系）。
 * 用法：
 *   const auth = await requirePerm(req, 'dishes.manage');
 *   if (!auth.ok) return auth.response;
 *   ... // auth.actor 可用
 */
export async function requirePerm(
  req: NextRequest,
  perm: string
): Promise<{ ok: true; actor: Actor } | { ok: false; response: NextResponse }> {
  const actor = await resolveActor(req);
  if (actor.type === 'anon') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '请先登录后再执行此操作' },
        { status: 401 }
      ),
    };
  }
  if (!actorCan(actor, perm)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '当前账号没有执行此操作的权限，请联系店长开通' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, actor };
}

/** 平台级守卫：仅 /admin 无参登录的平台超管会话可用（连锁分店管理等平台能力） */
export async function requirePlatformMaster(
  req: NextRequest
): Promise<{ ok: true; actor: Actor } | { ok: false; response: NextResponse }> {
  const actor = await resolveActor(req);
  if (actor.type !== 'platform_master') {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '该操作为平台专属权限，请以平台管理员身份在总后台登录' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, actor };
}

/**
 * settings 分桶写入裁决：逐键判定权限桶，返回 { allowed, skipped }。
 * 管理员（platform_master/tenant_admin）全部放行；员工仅保留其持有桶的键，
 * 未授权键被剔除（等同 fail-closed：未授权的配置永不被写入），由路由层回报 skippedKeys。
 */
export function partitionSettingsKeysByPermission(
  actor: Actor,
  presentKeys: string[],
  getBucket: (key: string) => string
): { allowed: Set<string>; skipped: string[] } {
  const allowed = new Set<string>();
  const skipped: string[] = [];
  const isAdmin = actor.type === 'platform_master' || actor.type === 'tenant_admin';
  for (const key of presentKeys) {
    const bucket = getBucket(key);
    if (!bucket) continue; // 非配置键（tenantId 等），交由路由自身忽略
    if (isAdmin || actor.permissions.includes(bucket)) {
      allowed.add(key);
    } else {
      skipped.push(key);
    }
  }
  return { allowed, skipped };
}
