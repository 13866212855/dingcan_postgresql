import { NextRequest, NextResponse } from 'next/server';
import { getAllOrders, createOrder, getOrderById, getSettings, verifyStaffSession } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { decodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';
import { sendOrderPaymentEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    // 识别当前请求是否来自本租户接单员（staff会话），执行多接单员数据隔离
    let staffUser: { id: number; phone: string } | null = null;
    const staffPayload = decodeStaffSession(req.cookies.get(STAFF_AUTH_COOKIE)?.value);
    if (staffPayload && staffPayload.tenantId === tenantId) {
      try {
        const staff = await verifyStaffSession(staffPayload);
        if (staff) {
          staffUser = { id: staff.id, phone: staff.phone };
        }
      } catch {
        // 校验异常不阻断
      }
    }

    const orders = await getAllOrders(status, search, tenantId, staffUser);
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

    // 声信协同：等待邮件在安全时限内（最多 3.5 秒）投递，配合 lib/email.ts 60s 去重机制，保证邮件必达且不超时
    try {
      const emailPromise = (async () => {
        const fullOrder = await getOrderById(order.id, tenantId);
        const settings = await getSettings(tenantId);
        if (fullOrder) {
          const triggerNote = paymentStatus === '已支付'
            ? '客户下单时已完成扫码支付 · 后台语音同步播报'
            : '客户提交新订单（餐后结账）· 后台语音同步播报';
          await sendOrderPaymentEmail(fullOrder, {
            restaurantName: settings?.restaurant_name,
            noteTrigger: triggerNote,
          });
        }
      })();
      await Promise.race([
        emailPromise,
        new Promise((resolve) => setTimeout(resolve, 3500)),
      ]);
    } catch (mailErr) {
      console.error('[Order Notice Email Error]', mailErr);
    }

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
