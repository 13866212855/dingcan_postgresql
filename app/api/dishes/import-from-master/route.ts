import { NextRequest, NextResponse } from 'next/server';
import { getAllDishes, importDishesFromTenant } from '@/lib/db';
import { getTenantIdFromRequest, DEFAULT_TENANT_ID } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';


export const dynamic = 'force-dynamic';

/**
 * GET 预览接口：拉取前向子租户后台展示主租户菜品规模与本次将导入的数量
 * 返回 { masterTotal, tenantTotal, toImport, skipped }
 */
export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, 'dishes.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    if (tenantId === DEFAULT_TENANT_ID) {
      return NextResponse.json(
        { success: false, error: '当前是主租户后台，主租户菜品库即为数据源，无需拉取' },
        { status: 400 }
      );
    }

    const [masterDishes, tenantDishes] = await Promise.all([
      getAllDishes(false, DEFAULT_TENANT_ID),
      getAllDishes(false, tenantId),
    ]);

    const existingNames = new Set(tenantDishes.map((d) => d.name.trim()));
    const toImport = masterDishes.filter((d) => !existingNames.has(d.name.trim()));

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        masterTotal: masterDishes.length,
        tenantTotal: tenantDishes.length,
        toImport: toImport.length,
        skipped: masterDishes.length - toImport.length,
      },
    });
  } catch (error: any) {
    console.error('Failed to preview dish import:', error);
    return NextResponse.json(
      { success: false, error: '获取拉取预览失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

/**
 * POST 执行接口：将主租户(default)菜品库的全部菜品按名称去重后一键复制到当前子租户
 * 仅子租户可用（default 直接拒绝）；需管理员登录会话
 */
export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'dishes.manage');
  if (!auth.ok) return auth.response;
  try {

    const tenantId = getTenantIdFromRequest(req);
    if (tenantId === DEFAULT_TENANT_ID) {
      return NextResponse.json(
        { success: false, error: '当前已是主租户后台，无需从自身拉取菜品' },
        { status: 400 }
      );
    }

    const result = await importDishesFromTenant(DEFAULT_TENANT_ID, tenantId);
    return NextResponse.json({
      success: true,
      message: `拉取完成：新增导入 ${result.imported} 道菜品，同名跳过 ${result.skipped} 道`,
      data: result,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to import dishes from master tenant:', error);
    return NextResponse.json(
      { success: false, error: '拉取主租户菜品失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
