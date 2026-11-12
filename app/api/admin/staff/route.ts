import { NextRequest, NextResponse } from 'next/server';
import { getStaffByTenant, createStaffUser, getRoleByKey } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';

export const dynamic = 'force-dynamic';

/**
 * 本店员工账号管理：
 * - GET  列出员工（需 staff.view）
 * - POST 新增员工 { name, phone, password?, role }（需 staff.manage）
 *
 * 防越权（服务端强制）：员工会话（如创业者）创建账号时，只能分配
 * "权限集不超过自身" 的角色——禁止造出比自己权限更大的账号（子集铁律）。
 */
export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, 'staff.view');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const staff = await getStaffByTenant(tenantId);
    return NextResponse.json({ success: true, data: staff, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取员工列表失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'staff.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const roleKey = String(body?.role || 'order_handler').trim().toLowerCase();

    // 防越权子集铁律：员工会话只能分配权限不多于自身的角色
    if (auth.actor.type === 'staff') {
      const targetRole = await getRoleByKey(tenantId, roleKey);
      if (!targetRole) {
        return NextResponse.json({ success: false, error: `角色 ${roleKey} 不存在` }, { status: 400 });
      }
      const own = new Set(auth.actor.permissions);
      const overflow = (targetRole.permissions || []).filter((p: string) => !own.has(p));
      if (overflow.length > 0) {
        return NextResponse.json(
          { success: false, error: '无权分配：该角色的权限超过您自己持有的权限' },
          { status: 403 }
        );
      }
    }

    const staff = await createStaffUser(tenantId, {
      name: String(body?.name || ''),
      phone: String(body?.phone || ''),
      password: body?.password !== undefined ? String(body.password) : undefined,
      role: roleKey,
    });
    const roleLabel = staff.role_name || (staff.role === 'kitchen' ? '后厨备餐员' : staff.role);
    return NextResponse.json({
      success: true,
      data: staff,
      message: `员工「${staff.name}」已添加（${roleLabel}），可用手机号 ${staff.phone} 登录后台`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '添加员工失败' },
      { status: 400 }
    );
  }
}
