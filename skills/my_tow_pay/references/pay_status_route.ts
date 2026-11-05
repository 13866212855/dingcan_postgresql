import { NextRequest, NextResponse } from 'next/server';
import { getOrderById } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

/**
 * 支付状态轮询（前端每 2.5s 调一次）：
 * 回调到账后订单 payment_status 变为已支付，前端据此自动关闭支付弹窗。
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const orderId = (searchParams.get('orderId') || '').trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: '缺少订单号 orderId' }, { status: 400 });
    }

    const order = await getOrderById(orderId, tenantId);
    if (!order) {
      return NextResponse.json({ success: false, error: '未找到该订单' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          paymentStatus: order.payment_status,
          orderStatus: order.status,
        },
        tenantId,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '查询支付状态失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
