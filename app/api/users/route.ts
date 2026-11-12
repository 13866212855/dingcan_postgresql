import { NextRequest, NextResponse } from 'next/server';
import { getUser, getOrCreateUser, updateUser, getAllUsers, deleteUser } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePlatformMaster } from '@/lib/authz';

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

export async function DELETE(req: NextRequest) {
  const auth = await requirePlatformMaster(req);
  if (!auth.ok) return auth.response;
  try {
    // 平台超管专属（scope cookie 判定，authz 统一守卫；原 cookie+scope 手写检查等价收敛）

    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {
        // ignore
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少会员ID' }, { status: 400 });
    }

    const deleted = await deleteUser(id, tenantId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '未找到该会员或该会员记录已不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `会员 ${id} 及其积分资产记录已成功删除`,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '删除会员失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
