import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/db';
import { decodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';

export const dynamic = 'force-dynamic';

/**
 * 后台会话检测（双角色）：
 * 1. 管理员 Cookie → { authenticated: true, role: 'admin' }
 * 2. 接单员 Cookie → 回查数据库校验（停用/删除立即失效）→ { authenticated: true, role: 'staff', staff: {...} }
 * 前端依据 role 做权限裁剪：接单员仅见订单中心。
 */
export async function GET(req: NextRequest) {
  // 1. 管理员会话优先
  const token = req.cookies.get('restaurant_admin_auth')?.value;
  if (token === 'authenticated_admin_token') {
    return NextResponse.json({
      authenticated: true,
      role: 'admin',
      user: { username: 'admin', role: '管理员' },
    });
  }

  // 2. 接单员会话：静默回查数据库验证（技能 Pillar 3：被停用/删除即刻失效）
  const staffToken = req.cookies.get(STAFF_AUTH_COOKIE)?.value;
  const payload = decodeStaffSession(staffToken);
  if (payload) {
    try {
      const staff = await verifyStaffSession(payload);
      if (staff) {
        return NextResponse.json({
          authenticated: true,
          role: 'staff',
          staff: {
            id: staff.id,
            tenantId: staff.tenant_id,
            name: staff.name,
            phone: staff.phone,
            role: staff.role,
          },
        });
      }
    } catch (err) {
      console.warn('[Admin Check] Staff session verify failed:', err);
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
