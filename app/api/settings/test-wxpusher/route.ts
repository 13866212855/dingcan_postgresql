import { NextRequest, NextResponse } from 'next/server';
import { sendTestWxPusherNotification } from '@/lib/pushplus';
import { getSettings } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const appToken = body.appToken?.trim();
    const uid = body.uid?.trim() || '';
    const topicId = body.topicId?.trim() || '';
    const tenantId = (body.tenantId || 'default').trim();

    if (!appToken) {
      return NextResponse.json({ success: false, error: '请先输入有效的 WxPusher AppToken (以 AT_ 开头)' }, { status: 400 });
    }
    if (!uid && !topicId) {
      return NextResponse.json({ success: false, error: '请至少输入接收人 UID (以 UID_ 开头) 或主题 TopicId' }, { status: 400 });
    }

    const settings = await getSettings(tenantId);
    const restaurantName = settings?.restaurant_name || (tenantId === 'zhou' ? '康乐美' : '客来香·家常菜馆');

    const result = await sendTestWxPusherNotification(appToken, uid, topicId, restaurantName, tenantId);
    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, error: result.error || '测试消息发送失败' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || '服务器内部错误' }, { status: 500 });
  }
}
