import { NextRequest, NextResponse } from 'next/server';
import { updateStaffUser, deleteStaffUser, getRoleByKey } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';

export const dynamic = 'force-dynamic';

/**
 * 员工账号维护（需 staff.manage）：
 * - PUT    改名/换手机号/重置密码/启停/换角色（换角色同样受防越权子集铁律约束）
 * - DELETE 删除员工
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePerm(req, 'staff.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ success: false, error: '无效的员工ID' }, { status: 400 });
    }
    const body = await req.json();

    // 防越权子集铁律：员工会话调整他人角色时，目标角色权限不得超过自身
    if (auth.actor.type === 'staff' && body?.role !== undefined) {
      const roleKey = String(body.role).trim().toLowerCase();
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

    const updated = await updateStaffUser(tenantId, staffId, {
      name: body?.name !== undefined ? String(body.name) : undefined,
      phone: body?.phone !== undefined ? String(body.phone) : undefined,
      password: body?.password !== undefined ? String(body.password) : undefined,
      enabled: body?.enabled !== undefined ? Number(body.enabled) : undefined,
      role: body?.role !== undefined ? String(body.role) : undefined,
    });
    if (!updated) {
      return NextResponse.json({ success: false, error: '员工不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated, message: '员工信息已更新' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '更新员工失败' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePerm(req, 'staff.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ success: false, error: '无效的员工ID' }, { status: 400 });
    }
    const ok = await deleteStaffUser(tenantId, staffId);
    if (!ok) {
      return NextResponse.json({ success: false, error: '员工不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '员工已删除' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '删除员工失败' },
      { status: 500 }
    );
  }
}
