/**
 * 接单员（order_handler）会话 Cookie 编解码工具
 * Cookie 载荷为 base64url(JSON)，服务端每次校验时回查数据库（staff_users 表
 * 是否仍存在且 enabled=1），管理员停用/删除账号后立即失效。
 */
export interface StaffSessionPayload {
  id: number;
  tenantId: string;
  phone: string;
}

export const STAFF_AUTH_COOKIE = 'restaurant_staff_auth';

export function encodeStaffSession(rec: {
  id: number;
  tenant_id: string;
  phone: string;
}): string {
  const payload: StaffSessionPayload = {
    id: rec.id,
    tenantId: rec.tenant_id,
    phone: rec.phone,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeStaffSession(token?: string | null): StaffSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const obj = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (
      typeof obj?.id === 'number' &&
      typeof obj?.tenantId === 'string' &&
      typeof obj?.phone === 'string' &&
      obj.tenantId &&
      obj.phone
    ) {
      return { id: obj.id, tenantId: obj.tenantId, phone: obj.phone };
    }
    return null;
  } catch {
    return null;
  }
}
