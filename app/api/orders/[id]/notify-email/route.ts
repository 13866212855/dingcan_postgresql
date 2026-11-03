import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, getSettings } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { sendOrderPaymentEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * 协同通知端点：当后台客户端触发声音与语音提示时，同步向 527194933@qq.com 确保发送该订单详细邮件通知
 * 内置 60 秒防抖去重机制，防止多端或轮询重复投递。
 */
export async function POST(
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
      return NextResponse.json({ success: false, error: '未找到订单' }, { status: 404 });
    }

    const settings = await getSettings(tenantId);
    const result = await sendOrderPaymentEmail(order, {
      restaurantName: settings?.restaurant_name,
      noteTrigger: '后台订单工作台提示音触发 · 同步邮件送达',
    });

    return NextResponse.json({
      success: result.success,
      message: result.success ? '邮件已成功发送' : result.error,
      tenantId,
    });
  } catch (err: any) {
    console.error('[Notify Email API Error]', err);
    return NextResponse.json(
      { success: false, error: '发送通知邮件异常: ' + (err?.message || '') },
      { status: 500 }
    );
  }
}
