import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffLogin, findStaffByCredentials } from '@/lib/db';
import { encodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';
import { getTenantIdFromRequest, normalizeTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 接单员手机号+密码登录：
 * 优先按页面租户上下文精确匹配；失败时跨租户兜底（手机号+密码全局唯一定位）——
 * 保证接单员登录不受 URL 租户参数错误的影响。
 * 校验通过写入 30 天持久会话 Cookie（以接单员真实所属租户为准），同时清除管理员会话避免身份混淆
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body?.tenant ? normalizeTenantId(String(body.tenant)) : getTenantIdFromRequest(req);
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '').trim();

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: '请输入接单员手机号和密码' },
        { status: 400 }
      );
    }

    // 1. 页面租户上下文精确匹配
    let staff = await verifyStaffLogin(tenantId, phone, password);
    let resolvedTenant = tenantId;

    // 2. 兜底：上下文租户不正确时（如 URL 误带参数），凭据全局唯一命中即认
    if (!staff) {
      const candidates = await findStaffByCredentials(phone, password);
      if (candidates.length === 1) {
        staff = candidates[0];
        resolvedTenant = staff.tenant_id;
      } else if (candidates.length > 1) {
        return NextResponse.json(
          { success: false, error: '该手机号在多家门店均存在，请打开对应门店的后台登录页面再登录' },
          { status: 401 }
        );
      }
    }

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '手机号或密码错误，或该接单员已被停用（请联系店长）' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: `欢迎接单，${staff.name}！`,
      staff: { id: staff.id, tenantId: staff.tenant_id, name: staff.name, phone: staff.phone },
      tenant: resolvedTenant,
    });

    // 30 天持久会话（httpOnly 防前端脚本误触），每次后台 check 均回查数据库校验有效性
    response.cookies.set({
      name: STAFF_AUTH_COOKIE,
      value: encodeStaffSession(staff),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    // 记住接单员真实所属租户（以库内记录为准，纠正 URL 误传的租户上下文）
    response.cookies.set({
      name: 'dingcan_tenant_id',
      value: staff.tenant_id,
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });

    // 清除管理员会话与身份范围，防止公用电脑上"管理员+接单员"双身份混淆
    response.cookies.set({
      name: 'restaurant_admin_auth',
      value: '',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set({
      name: 'dingcan_admin_scope',
      value: '',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '接单员登录失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
