import { NextRequest, NextResponse } from 'next/server';
import { testSendEmail, diagnoseSmtpConnection, getEffectiveSmtpConfig } from '@/lib/email';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'send'; // 'send' | 'diagnose'

    const customConfig = body?.customConfig ? {
      host: body.customConfig.host,
      port: body.customConfig.port ? Number(body.customConfig.port) : undefined,
      secure: body.customConfig.secure !== undefined ? Boolean(body.customConfig.secure) : undefined,
      user: body.customConfig.user,
      pass: body.customConfig.pass,
      timeout: body.customConfig.timeout ? Number(body.customConfig.timeout) : undefined,
      notifyTo: body.customConfig.notifyTo,
    } : undefined;

    // 1. 深度诊断模式
    if (action === 'diagnose') {
      const report = await diagnoseSmtpConnection(tenantId, customConfig);
      return NextResponse.json({
        success: report.overallStatus !== 'failed',
        action: 'diagnose',
        data: report,
      });
    }

    // 2. 实际发信测试模式
    const effective = await getEffectiveSmtpConfig(tenantId);
    const targetEmail = body?.toEmail || customConfig?.notifyTo || effective.notifyTo || '527194933@qq.com';

    const result = await testSendEmail(targetEmail, customConfig, tenantId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        action: 'send',
        message: `测试详单邮件已成功发送至 ${targetEmail}`,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          action: 'send',
          error: result.error || '邮件发送失败',
          diagnostics: result.diagnostics,
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
