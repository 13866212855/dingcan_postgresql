import { NextRequest, NextResponse } from 'next/server';
import { sendOrderToPrinter } from '@/lib/printer';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { Order } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // 构造测试小票订单数据
    const testOrder: Order = {
      id: `TEST-PRINT-${Date.now().toString().slice(-4)}`,
      table_no: '8号桌',
      order_type: '堂食',
      payment_timing: '餐前付款',
      payment_status: '已支付',
      total_amount: 88.0,
      points_used: 10,
      points_discount: 10.0,
      points_earned: 78,
      final_amount: 78.0,
      status: '待处理',
      notes: '微辣，少油少盐，测试出单（云打印机联调）',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          dish_id: 1,
          dish_name: '招牌宫保鸡丁',
          price: 38.0,
          quantity: 1,
          subtotal: 38.0,
          taste: '微辣,免葱花',
        },
        {
          dish_id: 2,
          dish_name: '鲜笋老鸭汤',
          price: 48.0,
          quantity: 1,
          subtotal: 48.0,
          taste: '温热',
        },
        {
          dish_id: 3,
          dish_name: '五常精米饭',
          price: 2.0,
          quantity: 2,
          subtotal: 4.0,
        },
      ],
    };

    // 支持接收前端临时填入的配置项进行即时连通性测试
    const customSettings = body.customSettings ? {
      ...body.customSettings,
      auto_print_enabled: 1,
    } : undefined;

    const result = await sendOrderToPrinter(testOrder, {
      tenantId,
      force: true,
      customSettings,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message || '测试小票已成功推送打印',
        target: result.target,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '测试打印推送失败',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '测试打印接口异常',
      },
      { status: 500 }
    );
  }
}
