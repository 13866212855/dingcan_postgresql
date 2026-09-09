import { NextRequest, NextResponse } from 'next/server';

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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // If a specific tenant is specified, persist it in cookie as well
      if (tenant && typeof tenant === 'string' && tenant.trim()) {
        response.cookies.set({
          name: 'dingcan_tenant_id',
          value: tenant.trim().toLowerCase(),
          path: '/',
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
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
