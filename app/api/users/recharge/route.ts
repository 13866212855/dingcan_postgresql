import { NextRequest, NextResponse } from 'next/server';
import { rechargeUser } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const { id, pointsDelta = 0, balanceDelta = 0 } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少用户标识' }, { status: 400 });
    }

    const pointsNum = Number(pointsDelta) || 0;
    const balanceNum = Number(balanceDelta) || 0;

    const updated = await rechargeUser(id, pointsNum, balanceNum, tenantId);
    if (!updated) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '充值成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '充值失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
