import { NextRequest, NextResponse } from 'next/server';
import {
  findPayRecordByTradeOrderId,
  getPayChannelConfig,
  markPayRecordPaid,
  updateOrderPayment,
  getOrderById,
  getSettings,
} from '@/lib/db';
import { xunhuVerify } from '@/lib/xunhupay';
import { sendOrderPaymentEmail } from '@/lib/email';
import { sendOrderPushPlusNotification } from '@/lib/pushplus';

export const dynamic = 'force-dynamic';

/**
 * 虎皮椒支付成功异步回调（POST form 表单）：
 * 1. 按商户单号定位支付记录 → 由记录反查租户 → 取该租户 appsecret 验签
 * 2. status 必须为 OD（已支付）；金额必须与支付记录一致（防改价）
 * 3. 幂等：重复回调直接返回 success，不重复入账
 * 4. 首次到账：pay_records 置 paid + 订单置已支付 + 发送支付确认邮件
 * 5. 必须返回纯文本 "success"，否则虎皮椒会重试回调 6 次
 */
export async function POST(req: NextRequest) {
  try {
    // 解析 form 表单（application/x-www-form-urlencoded）
    const text = await req.text();
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(text).entries()) {
      params[k] = v;
    }

    const tradeOrderId = params.trade_order_id || '';
    if (!tradeOrderId) {
      return new NextResponse('fail: missing trade_order_id', { status: 200 });
    }

    const record = await findPayRecordByTradeOrderId(tradeOrderId);
    if (!record) {
      console.warn('[Pay Notify] Unknown trade_order_id:', tradeOrderId);
      return new NextResponse('fail: unknown order', { status: 200 });
    }

    // 用记录所属租户的密钥验签（多租户各自绑定虎皮椒账号）
    const config = await getPayChannelConfig(record.tenant_id);
    if (!config.secret || !xunhuVerify(params, config.secret)) {
      console.error('[Pay Notify] Invalid hash for', tradeOrderId);
      return new NextResponse('fail: invalid sign', { status: 200 });
    }

    // 只认 OD（已支付）；CD/RD/UD 为退款类状态，确认收到但不做入账动作
    const status = (params.status || '').toUpperCase();
    if (status !== 'OD') {
      console.log('[Pay Notify] Non-paid status ignored:', status, tradeOrderId);
      return new NextResponse('success', { status: 200 });
    }

    // 金额比对：回调金额必须与支付记录一致（误差 < 0.005 元）
    const paidAmount = parseFloat(params.total_fee || '0');
    if (isNaN(paidAmount) || Math.abs(paidAmount - record.amount) >= 0.005) {
      console.error(
        `[Pay Notify] Amount mismatch for ${tradeOrderId}: expected ${record.amount}, got ${params.total_fee}`
      );
      return new NextResponse('fail: amount mismatch', { status: 200 });
    }

    // 幂等入账：pending → paid 首次转换才更新订单
    const { record: updated, firstTime } = await markPayRecordPaid(
      tradeOrderId,
      params.transaction_id || '',
      JSON.stringify(params)
    );

    if (firstTime && updated) {
      await updateOrderPayment(updated.order_id, '已支付', updated.tenant_id);

      // 支付确认邮件（限时 3.5s，失败不影响回调 ack——必须返回 success 否则会被重试 6 次）
      try {
        const emailPromise = (async () => {
          const fullOrder = await getOrderById(updated.order_id, updated.tenant_id);
          const settings = await getSettings(updated.tenant_id);
          if (fullOrder) {
            await sendOrderPaymentEmail(fullOrder, {
              restaurantName: settings?.restaurant_name,
              noteTrigger: '客户已通过在线支付完成付款（虎皮椒通道自动确认到账）',
            });
          }
        })();
        await Promise.race([emailPromise, new Promise((r) => setTimeout(r, 3500))]);
      } catch (mailErr) {
        console.error('[Pay Notify] Payment confirm email error:', mailErr);
      }

      // 微信新订单强提醒（PushPlus 0元微信直推）
      try {
        const pushPromise = (async () => {
          const fullOrder = await getOrderById(updated.order_id, updated.tenant_id);
          const settings = await getSettings(updated.tenant_id);
          if (fullOrder) {
            await sendOrderPushPlusNotification(fullOrder, {
              restaurantName: settings?.restaurant_name,
              tenantId: updated.tenant_id,
            });
          }
        })();
        await Promise.race([pushPromise, new Promise((r) => setTimeout(r, 3500))]);
      } catch (pushErr) {
        console.error('[Pay Notify] PushPlus notify error:', pushErr);
      }
    }

    return new NextResponse('success', { status: 200 });
  } catch (error: any) {
    console.error('[Pay Notify] Failed:', error);
    // 异常也尽量按虎皮椒协议返回非 success 文本，让其按策略重试
    return new NextResponse('fail: ' + (error?.message || 'internal'), { status: 200 });
  }
}

/** GET 探活：回调地址健康检查（也可用于后台连通性测试） */
export async function GET() {
  return NextResponse.json({ success: true, message: 'xunhupay notify endpoint is alive' });
}
