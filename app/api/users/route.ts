import { NextRequest, NextResponse } from 'next/server';
import { getUser, getOrCreateUser, updateUser, getAllUsers, deleteUser } from '@/lib/db';
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

export async function DELETE(req: NextRequest) {
  try {
    // 权限校验：仅主租户超级管理员（在 /admin 登录，scope === 'default'）拥有最高删除权限！
    // 子租户直接进入后台（scope === 'xxx'）无权删除会员与积分记录
    const adminToken = req.cookies.get('restaurant_admin_auth')?.value;
    if (adminToken !== 'authenticated_admin_token') {
      return NextResponse.json(
        { success: false, error: '无管理员权限，请先登录后台' },
        { status: 401 }
      );
    }

    const rawScope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase();
    if (rawScope !== 'default') {
      return NextResponse.json(
        {
          success: false,
          error: '会员及积分删除为主租户(总店)超级管理员专属最高权限：仅在总店后台 /admin 登录后可跨店操作；分店直接登录无权删除任何会员记录',
        },
        { status: 403 }
      );
    }

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
