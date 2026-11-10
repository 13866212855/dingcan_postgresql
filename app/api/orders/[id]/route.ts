import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrderStatus, updateOrderPayment, getSettings, verifyStaffSession, deleteOrder } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { decodeStaffSession, STAFF_AUTH_COOKIE } from '@/lib/staffAuth';
import { sendOrderPaymentEmail } from '@/lib/email';

export async function GET(
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
      return NextResponse.json({ success: false, error: '未找到该订单' }, { status: 404 });
    }

    // 接单员数据隔离：后厨可查看全店订单；配送接单员仅能查看待接单或自己领取的订单
    const staffPayload = decodeStaffSession(req.cookies.get(STAFF_AUTH_COOKIE)?.value);
    if (staffPayload && staffPayload.tenantId === tenantId) {
      try {
        const staff = await verifyStaffSession(staffPayload);
        if (staff && staff.role !== 'kitchen') {
          if (order.status !== '待处理' && order.handler_phone && order.handler_phone !== staffPayload.phone) {
            return NextResponse.json(
              { success: false, error: '该订单已由其他接单员处理，您无权查看此订单' },
              { status: 403 }
            );
          }
        }
      } catch {
        // 校验异常忽略
      }
    }

    return NextResponse.json({ success: true, data: order, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取订单详情失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const body = await req.json();
    const { status, paymentStatus, kitchenStatus, deliveryStatus, riderId, riderName, riderPhone } = body;

    // 若操作者为本租户员工（staff会话），记录处理人信息及角色
    let staffInfo: { id: number; name: string; phone: string; role?: string } | null = null;
    const staffPayload = decodeStaffSession(req.cookies.get(STAFF_AUTH_COOKIE)?.value);
    if (staffPayload && staffPayload.tenantId === tenantId) {
      try {
        const staff = await verifyStaffSession(staffPayload);
        if (staff) {
          staffInfo = { id: staff.id, name: staff.name, phone: staff.phone, role: staff.role };
        }
      } catch {
        // 校验异常按非 staff 处理
      }
    }

    if (status || kitchenStatus || deliveryStatus) {
      const validStatuses = ['待处理', '制作中', '已完成', '已取消'];
      let targetStatus = status;

      if (targetStatus && !validStatuses.includes(targetStatus)) {
        return NextResponse.json(
          { success: false, error: '无效的订单状态，允许状态：' + validStatuses.join('、') },
          { status: 400 }
        );
      }

      if (!targetStatus) {
        // 未传主状态时按流转自动计算
        if (deliveryStatus === '已送达') {
          targetStatus = '已完成';
        } else if (kitchenStatus === '已备齐') {
          // 堂食无配送流程时直接完成；外卖进入待取/配送中
          const currentOrder = await getOrderById(id, tenantId);
          targetStatus = currentOrder?.order_type === '堂食' ? '已完成' : '制作中';
        } else {
          targetStatus = '制作中';
        }
      }

      const res = await updateOrderStatus(id, targetStatus as any, tenantId, staffInfo, {
        kitchenStatus,
        deliveryStatus,
        riderId,
        riderName,
        riderPhone,
      });
      if (!res.success) {
        return NextResponse.json(
          { success: false, error: res.error || '更新订单状态失败' },
          { status: 409 }
        );
      }
    }

    if (paymentStatus) {
      const validPaymentStatuses = ['已支付', '未支付'];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return NextResponse.json(
          { success: false, error: '无效的支付状态' },
          { status: 400 }
        );
      }

      // 接单员只能更新本人已认领或公共待处理订单的支付状态
      if (staffInfo) {
        const orderBefore = await getOrderById(id, tenantId);
        if (
          orderBefore &&
          orderBefore.status !== '待处理' &&
          orderBefore.handler_phone &&
          orderBefore.handler_phone !== staffInfo.phone
        ) {
          return NextResponse.json(
            { success: false, error: '该订单已由其他接单员处理，您无权更改其收款状态' },
            { status: 403 }
          );
        }
      }

      await updateOrderPayment(id, paymentStatus, tenantId);

      // 当更新为“已支付”状态时（客户在订单详情页面完成扫码支付），自动发送详单邮件到 527194933@qq.com
      if (paymentStatus === '已支付') {
        try {
          const emailPromise = (async () => {
            const updatedOrder = await getOrderById(id, tenantId);
            const settings = await getSettings(tenantId);
            if (updatedOrder) {
              await sendOrderPaymentEmail(updatedOrder, {
                restaurantName: settings?.restaurant_name,
                noteTrigger: '客户在订单详情/结账页面点击【我已完成扫码支付】',
              });
            }
          })();
          await Promise.race([
            emailPromise,
            new Promise((resolve) => setTimeout(resolve, 3500)),
          ]);
        } catch (mailErr) {
          console.error('[Order Payment Notice Email Error]', mailErr);
        }
      }
    }

    const updated = await getOrderById(id, tenantId);

    return NextResponse.json({
      success: true,
      message: '订单更新成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '更新订单失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

/**
 * DELETE 彻底删除订单（主租户超级管理员专属能力）：
 * 守卫1：必须持管理员登录会话（接单员 staff 会话直接 401）；
 * 守卫2：会话 scope 必须为 'default'（即在总店后台 /admin 登录的超管会话）——
 *        分店管理员（?tenant=xxx 登录）与旧版无 scope 会话一律 403 拒绝（fail-closed）。
 * 删除范围限定在请求租户内（id + tenant_id 双条件），随订单级联删除全部明细。
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token') {
      return NextResponse.json(
        { success: false, error: '无管理员权限，请先登录后台' },
        { status: 401 }
      );
    }

    const rawScope = req.cookies.get('dingcan_admin_scope')?.value?.trim().toLowerCase();
    if (rawScope !== 'default') {
      return NextResponse.json(
        {
          success: false,
          error: '订单删除为主租户(总店)超级管理员专属权限：请在总店后台 /admin 登录后操作；分店后台无权删除任何订单记录',
        },
        { status: 403 }
      );
    }

    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: '订单ID不能为空' }, { status: 400 });
    }

    const ok = await deleteOrder(id, tenantId);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: '未找到该订单（或不属于当前门店）' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `订单 ${id} 及其明细已彻底删除`,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to delete order:', error);
    return NextResponse.json(
      { success: false, error: '删除订单失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
