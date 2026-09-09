import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({
    success: true,
    message: '已成功退出登录',
  });

  response.cookies.delete('restaurant_admin_auth');
  return response;
}
