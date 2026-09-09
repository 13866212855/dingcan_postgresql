import { NextRequest, NextResponse } from 'next/server';
import { updateDish, deleteDish, getDishById } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const dishId = parseInt(id, 10);
    if (isNaN(dishId)) {
      return NextResponse.json({ success: false, error: '无效菜品ID' }, { status: 400 });
    }
    const dish = await getDishById(dishId, tenantId);
    if (!dish) {
      return NextResponse.json({ success: false, error: '菜品不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: dish, tenantId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '获取菜品失败' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const dishId = parseInt(id, 10);
    if (isNaN(dishId)) {
      return NextResponse.json({ success: false, error: '无效菜品ID' }, { status: 400 });
    }
    const body = await req.json();
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.price !== undefined) updateData.price = Number(body.price);
    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.image !== undefined) updateData.image = body.image;
    if (body.status !== undefined) updateData.status = Number(body.status);
    if (body.taste_options !== undefined) updateData.taste_options = typeof body.taste_options === 'string' ? body.taste_options.trim() : '';

    await updateDish(dishId, updateData, tenantId);
    return NextResponse.json({ success: true, message: '菜品更新成功', tenantId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '更新菜品失败' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const dishId = parseInt(id, 10);
    if (isNaN(dishId)) {
      return NextResponse.json({ success: false, error: '无效菜品ID' }, { status: 400 });
    }
    const body = await req.json();
    if (body.status !== undefined) {
      await updateDish(dishId, { status: Number(body.status) }, tenantId);
      return NextResponse.json({ success: true, message: '菜品状态已更新', tenantId });
    }
    return NextResponse.json({ success: false, error: '未提供更新参数' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '更新状态失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const dishId = parseInt(id, 10);
    if (isNaN(dishId)) {
      return NextResponse.json({ success: false, error: '无效菜品ID' }, { status: 400 });
    }
    await deleteDish(dishId, tenantId);
    return NextResponse.json({ success: true, message: '菜品已删除', tenantId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || '删除菜品失败' }, { status: 500 });
  }
}
