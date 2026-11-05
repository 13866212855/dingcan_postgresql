import { NextRequest, NextResponse } from 'next/server';
import { normalizeTenantId } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, tenant } = body;

    if (username === 'admin' && password === 'admin123') {
      const response = NextResponse.json({
        success: true,
        message: '登录成功',
        user: { username: 'admin', role: '管理员' },
        tenant: tenant || 'default',
      });

      // Set cookie for session
      response.cookies.set({
        name: 'restaurant_admin_auth',
        value: 'authenticated_admin_token',
        path: '/',
        httpOnly: true,
        secure: false, // 纯 HTTP 部署：非 localhost 的 http 源（如局域网 IP）浏览器会丢弃 Secure cookie
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // 记录登录时的管理身份范围（scope）：
      // 在 /admin（无参）登录 → 'default' = 主租户超级管理员（独享跨租户订单删除权）
      // 在 /admin?tenant=xxx 登录 → 'xxx' = 该分店管理员（仅本店运营，无删除权）
      // 服务端后续以该 cookie 为准做权限判定，浏览器切换租户视图不会改变身份范围
      const scopeTenant = normalizeTenantId(typeof tenant === 'string' ? tenant : '');
      response.cookies.set({
        name: 'dingcan_admin_scope',
        value: scopeTenant,
        path: '/',
        httpOnly: true,
        secure: false, // 纯 HTTP 部署：非 localhost 的 http 源（如局域网 IP）浏览器会丢弃 Secure cookie
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days，与管理员会话同生命周期
      });

      // If a specific tenant is specified, persist it in cookie as well
      if (tenant && typeof tenant === 'string' && tenant.trim()) {
        response.cookies.set({
          name: 'dingcan_tenant_id',
          value: tenant.trim().toLowerCase(),
          path: '/',
          httpOnly: false,
          secure: false, // 纯 HTTP 部署：非 localhost 的 http 源（如局域网 IP）浏览器会丢弃 Secure cookie
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      return response;
    }

    return NextResponse.json(
      { success: false, error: '用户名或密码错误，请检查输入' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '登录服务异常: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
