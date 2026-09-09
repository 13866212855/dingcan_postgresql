import { NextRequest, NextResponse } from 'next/server';
import { getUser, getOrCreateUser, updateUser, getAllUsers } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const user = await getOrCreateUser(id, tenantId);
      return NextResponse.json({ success: true, data: user, tenantId });
    }

    // Return all users for this tenant (for admin panel)
    const users = await getAllUsers(tenantId);
    return NextResponse.json({ success: true, data: users, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取会员信息失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID不能为空' }, { status: 400 });
    }

    await updateUser(id, data, tenantId);
    const updated = await getUser(id, tenantId);

    return NextResponse.json({
      success: true,
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '更新用户信息失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
