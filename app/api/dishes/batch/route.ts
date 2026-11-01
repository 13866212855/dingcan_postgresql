import { NextRequest, NextResponse } from 'next/server';
import { createDishesBatch, BatchDishInput } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * POST 批量创建菜品（需管理员登录会话）：
 * Body: { dishes: [{ name, price, category, description, image, status, taste_options }], tenantId? }
 * 按名称去重（同名已存在自动跳过），事务原子，返回 created / skipped / invalid 数量
 */
export async function POST(req: NextRequest) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json(
        { success: false, error: '无管理员权限，请先登录后台' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const tenantId = body.tenantId || getTenantIdFromRequest(req);
    const rawList = body.dishes;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有可添加的菜品数据' },
        { status: 400 }
      );
    }
    if (rawList.length > 200) {
      return NextResponse.json(
        { success: false, error: '单次批量添加不能超过 200 道菜品' },
        { status: 400 }
      );
    }

    const items: BatchDishInput[] = rawList.map((it: any) => ({
      name: String(it?.name || ''),
      price: Number(it?.price),
      category: it?.category !== undefined ? String(it.category) : undefined,
      description: it?.description !== undefined ? String(it.description) : undefined,
      image: it?.image !== undefined ? String(it.image) : undefined,
      status: it?.status !== undefined ? Number(it.status) : 1,
      taste_options: it?.taste_options !== undefined ? String(it.taste_options) : undefined,
    }));

    const result = await createDishesBatch(items, tenantId);
    return NextResponse.json({
      success: true,
      message: `批量添加完成：成功 ${result.created} 道，同名跳过 ${result.skipped} 道${
        result.invalid > 0 ? `，无效 ${result.invalid} 道` : ''
      }`,
      data: result,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to batch create dishes:', error);
    return NextResponse.json(
      { success: false, error: '批量添加失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
