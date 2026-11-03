import { NextRequest, NextResponse } from 'next/server';
import { getAllDishes, createDish, clearAllDishes } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';
    const dishes = await getAllDishes(!all, tenantId);
    return NextResponse.json({ success: true, data: dishes, tenantId });
  } catch (error: any) {
    console.error('Failed to get dishes:', error);
    return NextResponse.json(
      { success: false, error: '获取菜品列表失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const { name, price, category, description, image, status, taste_options } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: '菜品名称不能为空' }, { status: 400 });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ success: false, error: '菜品价格不合法' }, { status: 400 });
    }

    const newId = await createDish(
      {
        name: name.trim(),
        price: numPrice,
        category: category?.trim() || '特色热炒',
        description: description?.trim() || '',
        image: image || '/uploads/dishes/u_ad259a604dda.jpg',
        status: status !== undefined ? Number(status) : 1,
        taste_options: typeof taste_options === 'string' ? taste_options.trim() : '',
      },
      tenantId
    );

    return NextResponse.json({ success: true, id: newId, message: '菜品添加成功', tenantId });
  } catch (error: any) {
    console.error('Failed to create dish:', error);
    return NextResponse.json(
      { success: false, error: '创建菜品失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

/**
 * DELETE 一键清空当前租户的全部菜品（危险操作：需管理员登录会话）
 */
export async function DELETE(req: NextRequest) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json(
        { success: false, error: '无管理员权限，请先登录后台' },
        { status: 401 }
      );
    }

    const tenantId = getTenantIdFromRequest(req);
    const deleted = await clearAllDishes(tenantId);
    return NextResponse.json({
      success: true,
      message: `已清空 ${deleted} 道菜品`,
      deleted,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to clear dishes:', error);
    return NextResponse.json(
      { success: false, error: '清空菜品失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
