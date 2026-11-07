import { NextRequest, NextResponse } from 'next/server';
import { sendTestPushPlusNotification } from '@/lib/pushplus';
import { getSettings } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token?.trim();
    const topic = body.topic?.trim() || '';
    const tenantId = (body.tenantId || 'default').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: '请先输入有效的 PushPlus Token' }, { status: 400 });
    }

    const settings = await getSettings(tenantId);
    const restaurantName = settings?.restaurant_name || (tenantId === 'zhou' ? '康乐美' : '客来香·家常菜馆');

    const result = await sendTestPushPlusNotification(token, topic, restaurantName, tenantId);
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.error || '测试消息发送失败' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '服务器内部错误' }, { status: 500 });
  }
}
