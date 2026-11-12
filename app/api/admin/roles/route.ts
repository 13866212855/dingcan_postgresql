import { NextRequest, NextResponse } from 'next/server';
import { getRolesByTenant, createTenantRole, updateTenantRole } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm, resolveActor } from '@/lib/authz';
import { PERMISSION_CATALOG, sanitizeRolePermissions, ALL_TENANT_PERMS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * 租户「角色权限」管理：
 * - GET    列出本店角色+权限目录——持 staff.view（员工管理下拉需要）或 roles.manage 均可读
 * - POST   新建自定义角色（需 roles.manage）
 * - PUT    修改角色 name/permissions/enabled（需 roles.manage；防越权：员工会话所配权限不得超过自身）
 * - DELETE /api/admin/roles/[id]（需 roles.manage）
 *
 * 防越权铁律（服务端强制）：
 * 1. nonDelegable 键（llm.manage / settings.payment）在任何情况下都被剔除，永不下放；
 * 2. 员工会话（创业者等）创建/修改角色时，目标权限集必须是其自身权限集的子集；
 * 3. 天花板：可授予权限永远 ≤ 租户级权限全集（平台能力不在目录内）。
 */
export async function GET(req: NextRequest) {
  // 读权限放宽：员工管理（staff.view）也需要角色列表做分配下拉
  const actor = await resolveActor(req);
  if (!(actor.type !== 'anon' && (actor.permissions.includes('staff.view') || actor.permissions.includes('roles.manage')))) {
    return NextResponse.json(
      { success: false, error: '当前账号没有查看角色列表的权限' },
      { status: 403 }
    );
  }
  try {
    const tenantId = getTenantIdFromRequest(req);
    const roles = await getRolesByTenant(tenantId);
    return NextResponse.json({
      success: true,
      data: roles,
      catalog: PERMISSION_CATALOG,
      allTenantPerms: ALL_TENANT_PERMS,
      actorPermissions: actor.permissions,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取角色列表失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'roles.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();

    // 净化：剔除未知键与 nonDelegable 键（永不下放）
    let permissions = sanitizeRolePermissions(body?.permissions);

    // 防越权子集规则：员工会话（非管理员）所配角色权限不得超过自身
    if (auth.actor.type === 'staff') {
      const own = new Set(auth.actor.permissions);
      const overflow = permissions.filter((p: string) => !own.has(p));
      if (overflow.length > 0) {
        return NextResponse.json(
          { success: false, error: '无权配置：角色的权限不能超过您自己持有的权限' },
          { status: 403 }
        );
      }
    }

    const role = await createTenantRole(tenantId, {
      role_key: String(body?.role_key || ''),
      name: String(body?.name || ''),
      permissions,
    });
    return NextResponse.json({
      success: true,
      data: role,
      message: `角色「${role.name}」已创建，可在「店员配置」中分配给员工`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '创建角色失败' },
      { status: 400 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePerm(req, 'roles.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const roleId = parseInt(String(body?.id || ''), 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ success: false, error: '无效的角色ID' }, { status: 400 });
    }

    const patch: { name?: string; permissions?: string[]; enabled?: number } = {};
    if (body?.name !== undefined) patch.name = String(body.name);
    if (body?.enabled !== undefined) patch.enabled = Number(body.enabled) ? 1 : 0;
    if (body?.permissions !== undefined) {
      patch.permissions = sanitizeRolePermissions(body.permissions);

      // 防越权子集规则（同 POST）
      if (auth.actor.type === 'staff') {
        const own = new Set(auth.actor.permissions);
        const overflow = patch.permissions.filter((p) => !own.has(p));
        if (overflow.length > 0) {
          return NextResponse.json(
            { success: false, error: '无权配置：角色的权限不能超过您自己持有的权限' },
            { status: 403 }
          );
        }
      }
    }

    const updated = await updateTenantRole(tenantId, roleId, patch);
    if (!updated) {
      return NextResponse.json({ success: false, error: '角色不存在' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: updated,
      message: updated.enabled === 1 ? '角色已更新（员工端下一次刷新即生效）' : '角色已停用（其下员工即刻失去全部权限）',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '更新角色失败' },
      { status: 400 }
    );
  }
}
