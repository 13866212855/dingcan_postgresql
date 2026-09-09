import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderStatus, updateOrderPayment } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: '订单ID不能为空' }, { status: 400 });
    }
    const order = await getOrderById(id, tenantId);
    if (!order) {
      return NextResponse.json({ success: false, error: '未找到该订单' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: order, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取订单详情失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const body = await req.json();
    const { status, paymentStatus } = body;

    if (status) {
      const validStatuses = ['待处理', '制作中', '已完成', '已取消'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: '无效的订单状态，允许状态：' + validStatuses.join('、') },
          { status: 400 }
        );
      }
      await updateOrderStatus(id, status, tenantId);
    }

    if (paymentStatus) {
      const validPaymentStatuses = ['已支付', '未支付'];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return NextResponse.json(
          { success: false, error: '无效的支付状态' },
          { status: 400 }
        );
      }
      await updateOrderPayment(id, paymentStatus, tenantId);
    }

    const updated = await getOrderById(id, tenantId);

    return NextResponse.json({
      success: true,
      message: '订单更新成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '更新订单失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
