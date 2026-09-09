import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const { id, phone, name } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少用户标识' }, { status: 400 });
    }

    if (!phone || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      return NextResponse.json({ success: false, error: '请输入正确的11位手机号码' }, { status: 400 });
    }

    if (!name || name.trim().length < 1) {
      return NextResponse.json({ success: false, error: '请输入真实姓名或称呼' }, { status: 400 });
    }

    const updated = await verifyUser(id, phone.trim(), name.trim(), tenantId);

    return NextResponse.json({
      success: true,
      message: '实名认证绑定成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '实名认证失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
