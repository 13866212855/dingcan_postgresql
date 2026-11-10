import { NextRequest, NextResponse } from 'next/server';
import { getStaffByTenant, createStaffUser } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 子租户接单员管理（需管理员登录会话，仅可管理本租户员工）：
 * - GET  列出本店全部接单员
 * - POST 新增接单员 { name, phone, password? }（初始密码默认 123456）
 */
export async function GET(req: NextRequest) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json({ success: false, error: '无管理员权限，请先登录后台' }, { status: 401 });
    }
    const tenantId = getTenantIdFromRequest(req);
    const staff = await getStaffByTenant(tenantId);
    return NextResponse.json({ success: true, data: staff, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取接单员列表失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json({ success: false, error: '无管理员权限，请先登录后台' }, { status: 401 });
    }
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const role = body?.role === 'kitchen' ? 'kitchen' : 'order_handler';
    const staff = await createStaffUser(tenantId, {
      name: String(body?.name || ''),
      phone: String(body?.phone || ''),
      password: body?.password !== undefined ? String(body.password) : undefined,
      role,
    });
    const roleLabel = staff.role === 'kitchen' ? '后厨备餐员' : '接单配送员';
    return NextResponse.json({
      success: true,
      data: staff,
      message: `员工「${staff.name}」已添加（${roleLabel}），可用手机号 ${staff.phone} 登录后台`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '添加接单员失败' },
      { status: 400 }
    );
  }
}
