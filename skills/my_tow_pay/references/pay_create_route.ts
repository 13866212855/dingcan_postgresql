import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOrderById, getSettings, getPayChannelConfig, createPayRecord, getReusablePendingPayRecord } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { xunhuCreatePayment } from '@/lib/xunhupay';

export const dynamic = 'force-dynamic';

/**
 * 创建虎皮椒动态支付（幂等）：
 * - 同一订单 3.5 分钟内已有 pending 支付记录 → 直接复用（防双击重复下单到通道）
 * - 通道未启用/未配置完整 → fallback:'static'，前端自动回退静态收款码模式
 * - 金额一律取服务端订单落库金额（final_amount），绝不信任客户端传参
 */
export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const orderId: string = String(body?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: '缺少订单号 orderId' }, { status: 400 });
    }

    const config = await getPayChannelConfig(tenantId);
    if (!config.ready) {
      return NextResponse.json(
        { success: false, error: '在线支付通道未启用或配置不完整', fallback: 'static' },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId, tenantId);
    if (!order) {
      return NextResponse.json({ success: false, error: '未找到该订单' }, { status: 404 });
    }
    if (order.payment_status === '已支付') {
      return NextResponse.json({ success: true, data: { alreadyPaid: true } });
    }

    const amount = Number(order.final_amount !== undefined ? order.final_amount : order.total_amount) || 0;
    if (amount <= 0) {
      // 积分全额抵扣等 0 元订单无需拉起支付
      return NextResponse.json({ success: true, data: { freeOrder: true } });
    }

    // 幂等复用：3.5 分钟内的 pending 记录直接返回（二维码有效期 5 分钟）
    const reusable = await getReusablePendingPayRecord(tenantId, orderId);
    if (reusable && (reusable.url || reusable.url_qrcode)) {
      const createdMs = new Date(reusable.created_at).getTime();
      return NextResponse.json({
        success: true,
        data: {
          payUrl: reusable.url,
          qrCodeUrl: reusable.url_qrcode,
          tradeOrderId: reusable.trade_order_id,
          amount,
          expiresAt: createdMs + 5 * 60 * 1000,
          reused: true,
        },
      });
    }

    // 商户单号 = 平台订单号 + 6位随机（订单号已内嵌租户前缀，≤32字符且仅含 0-9A-Za-z-_）
    const tradeOrderId = `${orderId}-${randomBytes(3).toString('hex')}`;
    const settings = await getSettings(tenantId);
    const restaurantName = settings?.restaurant_name || '餐饮订单';

    const result = await xunhuCreatePayment({
      gateway: config.gateway,
      appid: config.appid,
      secret: config.secret,
      tradeOrderId,
      totalFee: amount,
      title: `${restaurantName} 订单 ${orderId}`,
      notifyUrl: `${config.notifyBase}/api/pay/notify`,
      returnUrl: `${req.nextUrl.origin}/?tenant=${encodeURIComponent(tenantId)}`,
      attach: tenantId,
    });

    if (!result.ok) {
      console.error('[Pay Create] XunhuPay gateway error:', result.errcode, result.errmsg);
      return NextResponse.json(
        { success: false, error: result.errmsg || '支付通道下单失败', fallback: 'static' },
        { status: 502 }
      );
    }

    const record = await createPayRecord({
      tenantId,
      orderId,
      tradeOrderId,
      amount,
      url: result.url || '',
      urlQrcode: result.urlQrcode || '',
    });

    return NextResponse.json({
      success: true,
      data: {
        payUrl: record.url,
        qrCodeUrl: record.url_qrcode,
        tradeOrderId: record.trade_order_id,
        amount,
        expiresAt: Date.now() + 5 * 60 * 1000, // 虎皮椒二维码有效期 5 分钟
      },
    });
  } catch (error: any) {
    console.error('[Pay Create] Failed:', error);
    return NextResponse.json(
      { success: false, error: '创建支付失败: ' + (error?.message || ''), fallback: 'static' },
      { status: 500 }
    );
  }
}
