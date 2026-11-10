import { NextRequest, NextResponse } from 'next/server';
import { updateStaffUser, deleteStaffUser } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 接单员账号维护（需管理员登录会话，仅可操作本租户员工）：
 * - PUT    修改姓名/手机号/重置密码/启停
 * - DELETE 删除接单员
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json({ success: false, error: '无管理员权限，请先登录后台' }, { status: 401 });
    }
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ success: false, error: '无效的接单员ID' }, { status: 400 });
    }
    const body = await req.json();
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
      { success: false, error: error?.message || '更新接单员失败' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json({ success: false, error: '无管理员权限，请先登录后台' }, { status: 401 });
    }
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const staffId = parseInt(id, 10);
    if (isNaN(staffId)) {
      return NextResponse.json({ success: false, error: '无效的接单员ID' }, { status: 400 });
    }
    const ok = await deleteStaffUser(tenantId, staffId);
    if (!ok) {
      return NextResponse.json({ success: false, error: '接单员不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '接单员已删除' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '删除接单员失败' },
      { status: 500 }
    );
  }
}
