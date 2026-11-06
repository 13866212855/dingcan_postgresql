import { NextRequest, NextResponse } from 'next/server';
import { testSendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetEmail = body?.toEmail || process.env.NOTIFY_EMAIL_TO || '527194933@qq.com';

    const result = await testSendEmail(targetEmail);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `测试详单邮件已成功发送至 ${targetEmail}`,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '邮件发送失败',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '测试邮件接口调用异常',
      },
      { status: 500 }
    );
  }
}
