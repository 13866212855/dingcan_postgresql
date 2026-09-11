import nodemailer, { type Transporter } from 'nodemailer';
import { Order } from '@/types';

let transporterInstance: Transporter | null = null;

export function getTransporter(): Transporter {
  if (!transporterInstance) {
    const host = process.env.SMTP_HOST || 'smtp.qq.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE !== 'false';
    const user = process.env.SMTP_USER || '527194933@qq.com';
    const pass = process.env.SMTP_PASS || 'rvlehugdnsmccajh';

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }
  return transporterInstance;
}

/**
 * 格式化时间为标准的中国本地时间字符串
 */
function formatBeijingTime(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export interface SendOrderEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 客户点击“我已完成扫码支付”后，自动向指定邮箱发送详单提醒
 */
export async function sendOrderPaymentEmail(
  order: Order,
  options?: {
    restaurantName?: string;
    noteTrigger?: string;
  }
): Promise<SendOrderEmailResult> {
  const userEmail = process.env.SMTP_USER || '527194933@qq.com';
  const targetEmail = process.env.NOTIFY_EMAIL_TO || '527194933@qq.com';
  const shopName = options?.restaurantName || '饭店点餐系统';
  const triggerDesc = options?.noteTrigger || '客户已点击【我已完成扫码支付】';

  const orderTimeStr = formatBeijingTime(order.created_at || new Date());
  const finalPrice = Number(order.final_amount !== undefined ? order.final_amount : order.total_amount).toFixed(2);
  const originalPrice = Number(order.total_amount || 0).toFixed(2);
  const discountPrice = Number(order.points_discount || 0).toFixed(2);

  const isDineIn = order.order_type === '堂食';
  const locationTitle = isDineIn ? `堂食 · ${order.table_no || '未指定桌号'}` : `外卖 · ${order.delivery_contact || '顾客'}`;
  const isPaid = order.payment_status === '已支付';

  // 构建邮件主题
  const subjectPrefix = isPaid ? '【新订单已支付】' : '【新点餐提醒】';
  const subject = `${subjectPrefix}${locationTitle} - 订单号: ${order.id} (${isPaid ? '实付' : '待收'}: ¥${finalPrice})`;

  // 状态显示胶囊与卡片
  const statusBadge = isPaid
    ? `<span style="display: inline-block; background: #10b981; color: #ffffff; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px;">✔ 新订单已支付</span>`
    : `<span style="display: inline-block; background: #f59e0b; color: #ffffff; font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.5px;">⏳ 新订单待结账</span>`;

  const statusCard = isPaid
    ? `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px;">
         <div style="font-size: 11px; color: #047857;">支付状态</div>
         <div style="font-size: 13px; font-weight: 800; color: #059669; margin-top: 2px;">✔ 已完成扫码支付</div>
       </div>`
    : `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px;">
         <div style="font-size: 11px; color: #b45309;">支付状态</div>
         <div style="font-size: 13px; font-weight: 800; color: #d97706; margin-top: 2px;">⏳ 餐后付款 / 待结账</div>
       </div>`;

  // 生成菜品表格行
  const itemsHtml = (order.items || [])
    .map((item, index) => {
      const tasteBadge = item.taste
        ? `<div style="display:inline-block;margin-top:2px;padding:1px 6px;background:#fef3c7;color:#92400e;border-radius:4px;font-size:11px;">定制: ${item.taste}</div>`
        : '';
      return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px 8px; font-size: 13px; color: #475569; text-align: center;">${index + 1}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #0f172a; font-weight: 600;">
          ${item.dish_name}
          ${tasteBadge}
        </td>
        <td style="padding: 10px 8px; font-size: 13px; color: #64748b; text-align: right;">¥${Number(item.price).toFixed(2)}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: center;">×${item.quantity}</td>
        <td style="padding: 10px 8px; font-size: 13px; color: #e11d48; font-weight: 700; text-align: right;">¥${Number(item.subtotal || item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `;
    })
    .join('');

  // 配送或桌位详细信息块
  const deliveryInfoHtml = isDineIn
    ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>就餐模式：</strong> 堂食就餐</div>
        <div style="font-size: 13px; color: #0f172a;"><strong>就餐桌号：</strong> <span style="display:inline-block;background:#fef08a;color:#854d0e;padding:2px 8px;border-radius:4px;font-weight:bold;">${order.table_no || '未指定'}</span></div>
      </div>
    `
    : `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>就餐模式：</strong> 外卖配送</div>
        <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>收餐姓名：</strong> ${order.delivery_contact || '未填写'}</div>
        <div style="font-size: 13px; color: #334155; margin-bottom: 4px;"><strong>联系电话：</strong> <a href="tel:${order.delivery_phone}" style="color:#0284c7;font-weight:bold;text-decoration:none;">${order.delivery_phone || '未填写'}</a></div>
        <div style="font-size: 13px; color: #0f172a;"><strong>送餐地址：</strong> <span style="font-weight:bold;color:#b91c1c;">${order.delivery_address || '未填写'}</span></div>
      </div>
    `;

  // 备注信息
  const notesHtml = order.notes
    ? `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px;">
        <span style="font-size: 12px; color: #b45309; font-weight: bold;">顾客特殊要求/备注：</span>
        <div style="font-size: 13px; color: #92400e; margin-top: 2px;">${order.notes}</div>
      </div>
    `
    : '';

  // 完整 HTML 邮件模板
  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 24px; text-align: left;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  ${statusBadge}
                  <h1 style="margin: 8px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">
                    ${shopName} · ${isPaid ? '客户支付详单' : '新点餐备餐详单'}
                  </h1>
                </div>
              </div>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px;">
                ${triggerDesc} · 接收时间：${orderTimeStr}
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 24px;">
              
              <!-- Key Info Grid -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 16px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding-right: 8px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                      <div style="font-size: 11px; color: #64748b;">订单编号</div>
                      <div style="font-size: 13px; font-weight: 700; color: #0f172a; word-break: break-all; margin-top: 2px;">${order.id}</div>
                    </div>
                  </td>
                  <td width="50%" style="vertical-align: top; padding-left: 8px;">
                    ${statusCard}
                  </td>
                </tr>
              </table>

              <!-- Location Details -->
              ${deliveryInfoHtml}

              <!-- Notes -->
              ${notesHtml}

              <!-- Items Table -->
              <div style="margin-bottom: 8px; font-size: 14px; font-weight: 700; color: #0f172a;">
                菜品明细清单（共 ${(order.items || []).reduce((sum, item) => sum + item.quantity, 0)} 件）
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 16px; background: #ffffff;">
                <thead>
                  <tr style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
                    <th style="padding: 8px; font-size: 12px; color: #64748b; text-align: center; width: 36px;">#</th>
                    <th style="padding: 8px; font-size: 12px; color: #64748b; text-align: left;">菜品名称与定制</th>
                    <th style="padding: 8px; font-size: 12px; color: #64748b; text-align: right; width: 60px;">单价</th>
                    <th style="padding: 8px; font-size: 12px; color: #64748b; text-align: center; width: 50px;">数量</th>
                    <th style="padding: 8px; font-size: 12px; color: #64748b; text-align: right; width: 70px;">小计</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Amount Summary -->
              <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size: 13px; color: #57534e; padding: 3px 0;">菜品原总计：</td>
                    <td style="font-size: 13px; color: #57534e; text-align: right; padding: 3px 0;">¥${originalPrice}</td>
                  </tr>
                  ${
                    Number(discountPrice) > 0
                      ? `<tr>
                    <td style="font-size: 13px; color: #b45309; padding: 3px 0;">积分抵扣优惠：</td>
                    <td style="font-size: 13px; color: #b45309; text-align: right; padding: 3px 0;">-¥${discountPrice} (${order.points_used || 0} 积分)</td>
                  </tr>`
                      : ''
                  }
                  <tr style="border-top: 1px dashed #d6d3d1;">
                    <td style="font-size: 15px; font-weight: 800; color: #0f172a; padding-top: 8px;">实付扫码金额：</td>
                    <td style="font-size: 20px; font-weight: 900; color: #dc2626; text-align: right; padding-top: 8px;">
                      ¥${finalPrice}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Quick Action Button -->
              <div style="text-align: center; margin: 20px 0 10px 0;">
                <a href="${process.env.APP_URL || ''}/admin" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(15,23,42,0.2);">
                  打开后台订单看板及时备餐 →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                本邮件由【${shopName}】系统全自动发出，已配置 QQ 邮箱 SMTP 安全服务通知。<br>
                提醒收件人：${targetEmail}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${shopName}订单通知" <${userEmail}>`,
      to: targetEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[Email Notice] 成功向 ${targetEmail} 发送订单支付详单 (Message ID: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('[Email Notice Error] 发送邮件异常:', error);
    return {
      success: false,
      error: error?.message || '邮件发送未知异常',
    };
  }
}

/**
 * 测试邮件发送（用于后台设置页面一键验证 QQ 邮箱联通性）
 */
export async function testSendEmail(targetEmail: string = '527194933@qq.com'): Promise<SendOrderEmailResult> {
  const userEmail = process.env.SMTP_USER || '527194933@qq.com';
  const testOrder: Order = {
    id: `TEST-${Date.now().toString().slice(-6)}`,
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
    notes: '少油少盐，微辣，请尽快上菜',
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
        quantity: 1,
        subtotal: 2.0,
      },
    ],
  };

  return sendOrderPaymentEmail(testOrder, {
    restaurantName: '饭店点餐测试中心',
    noteTrigger: '管理员在后台点击【测试发送通知邮件】',
  });
}
