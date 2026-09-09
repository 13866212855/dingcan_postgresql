import { NextRequest, NextResponse } from 'next/server';
import { getAllDishes, createDish } from '@/lib/db';
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
        image: image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
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
