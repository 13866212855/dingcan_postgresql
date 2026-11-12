import { NextRequest, NextResponse } from 'next/server';
import { deleteTenantRole } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';

export const dynamic = 'force-dynamic';

/** 删除自定义角色（需 roles.manage；系统角色不可删，有在职员工的角色不可删） */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePerm(req, 'roles.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return NextResponse.json({ success: false, error: '无效的角色ID' }, { status: 400 });
    }
    const result = await deleteTenantRole(tenantId, roleId);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || '删除失败' }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: '角色已删除' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '删除角色失败' },
      { status: 500 }
    );
  }
}
