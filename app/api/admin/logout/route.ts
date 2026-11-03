import { NextRequest, NextResponse } from 'next/server';
import { STAFF_AUTH_COOKIE } from '@/lib/staffAuth';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: '已成功退出登录',
  });

  response.cookies.delete('restaurant_admin_auth');
  response.cookies.delete(STAFF_AUTH_COOKIE);
  response.cookies.delete('dingcan_admin_scope');
  return response;
}
