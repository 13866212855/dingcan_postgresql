import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, createOrder } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    const orders = await getAllOrders(status, search, tenantId);
    return NextResponse.json(
      { success: true, data: orders, tenantId },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Failed to get orders:', error);
    return NextResponse.json(
      { success: false, error: '获取订单失败: ' + (error?.message || '') },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const {
      tableNo,
      orderType = '堂食',
      deliveryAddress,
      deliveryContact,
      deliveryPhone,
      paymentTiming = '餐前付款',
      paymentStatus = '未支付',
      pointsUsed = 0,
      notes,
      userId,
      items,
    } = body;

    if (orderType === '堂食') {
      if (!tableNo || tableNo.trim() === '') {
        return NextResponse.json({ success: false, error: '请选择或填写就餐桌号' }, { status: 400 });
      }
    } else {
      if (!deliveryAddress || deliveryAddress.trim() === '') {
        return NextResponse.json({ success: false, error: '请填写送餐到达地址' }, { status: 400 });
      }
      if (!deliveryPhone || deliveryPhone.trim() === '') {
        return NextResponse.json({ success: false, error: '请填写收餐人联系电话' }, { status: 400 });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: '购物车为空，请选择菜品' }, { status: 400 });
    }

    const order = await createOrder(
      {
        tableNo: tableNo?.trim() || (orderType === '外卖' ? '外卖送餐' : '未定'),
        orderType,
        deliveryAddress: deliveryAddress?.trim(),
        deliveryContact: deliveryContact?.trim(),
        deliveryPhone: deliveryPhone?.trim(),
        paymentTiming: orderType === '外卖' ? '餐前付款' : paymentTiming,
        paymentStatus,
        pointsUsed: Number(pointsUsed) || 0,
        notes: notes?.trim() || '',
        userId: userId?.trim() || undefined,
        items: items.map((i: any) => ({
          dishId: Number(i.dishId),
          quantity: Number(i.quantity) || 1,
          taste: typeof i.taste === 'string' ? i.taste.trim() : undefined,
        })),
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      message: '订单提交成功',
      data: order,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return NextResponse.json(
      { success: false, error: '下单失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
