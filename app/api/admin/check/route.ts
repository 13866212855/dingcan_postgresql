import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('restaurant_admin_auth')?.value;
  if (token === 'authenticated_admin_token') {
    return NextResponse.json({ authenticated: true, user: { username: 'admin', role: '管理员' } });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
