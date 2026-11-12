import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession, resolveStaffPermissions } from '@/lib/db';
import { decodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';
import { ALL_TENANT_PERMS } from '@/lib/permissions';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 后台会话检测（双角色 + 权限集下发）：
 * 1. 管理员 Cookie → { authenticated, role: 'admin', scope, permissions: 租户级全集 }
 * 2. 员工 Cookie → 回查库验证（停用/删除立即失效）+ 实时解析角色权限
 *    → { authenticated, role: 'staff', staff: {...}, permissions: [...] }
 * 前端以 permissions 做 can() 驱动渲染；权限实时取库，角色被编辑后下一屏生效。
 */
export async function GET(req: NextRequest) {
  // 1. 管理员会话优先
  const token = req.cookies.get('restaurant_admin_auth')?.value;
  if (token === 'authenticated_admin_token') {
    // scope = 登录时所在租户（/admin 登录为 'default' 主租户超管；?tenant=xxx 登录为分店管理员）。
    // 缺失（旧版本会话）按 '' 处理 → 前端无删除权，重新登录即可获得，fail-closed
    const rawScope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase() || '';
    return NextResponse.json({
      authenticated: true,
      role: 'admin',
      scope: rawScope,
      permissions: ALL_TENANT_PERMS,
      user: { username: 'admin', role: '管理员' },
    });
  }

  // 2. 员工会话：静默回查数据库验证（技能 Pillar 3：被停用/删除即刻失效）
  const staffToken = req.cookies.get(STAFF_AUTH_COOKIE)?.value;
  const payload = decodeStaffSession(staffToken);
  if (payload) {
    try {
      const staff = await verifyStaffSession(payload);
      if (staff) {
        const permissions = await resolveStaffPermissions(staff);
        return NextResponse.json({
          authenticated: true,
          role: 'staff',
          staff: {
            id: staff.id,
            tenantId: staff.tenant_id,
            name: staff.name,
            phone: staff.phone,
            role: staff.role,
            role_id: staff.role_id ?? null,
          },
          permissions,
          tenantId: getTenantIdFromRequest(req),
        });
      }
    } catch (err) {
      console.warn('[Admin Check] Staff session verify failed:', err);
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
