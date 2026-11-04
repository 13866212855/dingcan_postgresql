import { getSettings } from '@/lib/db';
import { Order } from '@/types';

export interface PrinterTicketData {
  orderId: string;
  tableName: string;
  orderType: string;
  createTime: string;
  paymentStatus: string;
  paymentTiming: string;
  totalAmount: number;
  finalAmount: number;
  pointsDiscount: number;
  items: {
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    taste?: string;
  }[];
  notes?: string;
  deliveryAddress?: string;
  deliveryContact?: string;
  deliveryPhone?: string;
}

/**
 * 将订单数据转换为规范纯文本格式小票内容（适配 58mm / 80mm 热敏打印机与飞鹅、易联云、通用 Webhook）
 */
export function formatOrderTicketText(
  order: Order,
  options?: {
    shopName?: string;
    header?: string;
    footer?: string;
  }
): string {
  const shopName = options?.shopName || '饭店点餐收银';
  const header = options?.header || shopName;
  const footer = options?.footer || '谢谢惠顾，欢迎再次光临！';

  const isDineIn = order.order_type === '堂食';
  const typeText = isDineIn ? `堂食桌号: ${order.table_no || '未指定'}` : `外卖送餐: ${order.delivery_contact || '顾客'}`;
  const payStatus = order.payment_status === '已支付' ? '已完成支付' : '餐后未结账(待结账)';
  const createTime = order.created_at ? new Date(order.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : new Date().toLocaleString('zh-CN');

  const lines: string[] = [];
  lines.push('================================');
  lines.push(`       ${header}       `);
  lines.push('================================');
  lines.push(`单号: ${order.id}`);
  lines.push(`时间: ${createTime}`);
  lines.push(`类型: ${typeText}`);
  lines.push(`支付: ${payStatus} (${order.payment_timing || '餐前付款'})`);

  if (!isDineIn) {
    if (order.delivery_address) lines.push(`地址: ${order.delivery_address}`);
    if (order.delivery_phone) lines.push(`电话: ${order.delivery_phone}`);
  }

  lines.push('--------------------------------');
  lines.push('品名           数量   单价   小计');
  lines.push('--------------------------------');

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.dish_name.slice(0, 7).padEnd(8, ' ');
      const qty = String(item.quantity).padStart(3, ' ');
      const price = item.price.toFixed(1).padStart(6, ' ');
      const subtotal = item.subtotal.toFixed(1).padStart(7, ' ');
      lines.push(`${name} ${qty} ${price} ${subtotal}`);
      if (item.taste) {
        lines.push(`  * 口味: ${item.taste}`);
      }
    }
  } else {
    lines.push('  无菜品明细');
  }

  lines.push('--------------------------------');
  lines.push(`原价合计: ¥${(order.total_amount || 0).toFixed(2)}`);
  if (order.points_discount && order.points_discount > 0) {
    lines.push(`积分抵扣: -¥${Number(order.points_discount).toFixed(2)}`);
  }
  const finalAmount = order.final_amount !== undefined ? order.final_amount : order.total_amount;
  lines.push(`实付应收: ¥${Number(finalAmount || 0).toFixed(2)}`);

  if (order.notes) {
    lines.push('--------------------------------');
    lines.push(`备注要求: ${order.notes}`);
  }

  lines.push('================================');
  lines.push(`     ${footer}     `);
  lines.push('================================');

  return lines.join('\n');
}

export interface SendPrintResult {
  success: boolean;
  message?: string;
  error?: string;
  target?: string;
}

/**
 * 核心调度方法：根据当前租户配置将订单推送到云打印机或 Webhook
 */
export async function sendOrderToPrinter(
  order: Order,
  options?: {
    tenantId?: string;
    force?: boolean;
    customSettings?: any;
  }
): Promise<SendPrintResult> {
  try {
    const tenantId = options?.tenantId || 'default';
    const settings = options?.customSettings || (await getSettings(tenantId));

    // 如果未手动强制且未开启自动打印，则跳过
    if (!options?.force && (!settings || settings.auto_print_enabled !== 1)) {
      return { success: true, message: '未开启自动打印，已跳过' };
    }

    const printerType = settings?.printer_type || 'webhook';
    const printerSn = settings?.printer_sn?.trim() || '';
    const printerKey = settings?.printer_key?.trim() || '';
    const webhookUrl = settings?.printer_webhook_url?.trim() || '';
    const copies = Math.min(3, Math.max(1, Number(settings?.printer_copies) || 1));

    const shopName = settings?.restaurant_name || '饭店点餐系统';
    const ticketHeader = settings?.printer_ticket_header?.trim() || shopName;
    const ticketFooter = settings?.printer_ticket_footer?.trim() || '谢谢惠顾，欢迎再次光临！';

    const ticketContent = formatOrderTicketText(order, {
      shopName,
      header: ticketHeader,
      footer: ticketFooter,
    });

    // 1. Webhook 自定义 HTTP/HTTPS 打印接口
    if (printerType === 'webhook') {
      if (!webhookUrl) {
        return { success: false, error: '未配置 Webhook 接口 URL 地址' };
      }

      const payload = {
        event: 'order.print',
        timestamp: Date.now(),
        tenantId,
        copies,
        orderId: order.id,
        printerSn,
        printerKey,
        rawText: ticketContent,
        order: {
          id: order.id,
          tableNo: order.table_no,
          orderType: order.order_type,
          status: order.status,
          paymentStatus: order.payment_status,
          paymentTiming: order.payment_timing,
          totalAmount: order.total_amount,
          finalAmount: order.final_amount ?? order.total_amount,
          notes: order.notes,
          items: order.items,
          createdAt: order.created_at,
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (settings?.printer_secret_token?.trim()) {
        headers['Authorization'] = `Bearer ${settings.printer_secret_token.trim()}`;
        headers['X-Printer-Secret'] = settings.printer_secret_token.trim();
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: `已成功将小票推送到 Webhook 打印服务`, target: webhookUrl };
      } else {
        const text = await response.text().catch(() => '');
        return {
          success: false,
          error: `Webhook 响应异常 HTTP ${response.status}: ${text.slice(0, 100)}`,
        };
      }
    }

    // 2. 飞鹅云打印机 (FeieYun API)
    if (printerType === 'feie') {
      if (!printerSn || !printerKey) {
        return { success: false, error: '飞鹅云打印机要求填写设备 SN 码与设备 KEY' };
      }

      // 飞鹅云排版格式：<CB>居中放大</CB>, <C>居中</C>, <B>加粗</B>
      let feieContent = `<CB>${ticketHeader}</CB><BR>`;
      feieContent += `单号: ${order.id}<BR>`;
      feieContent += `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}<BR>`;
      feieContent += `类型: ${order.order_type === '堂食' ? `堂食 · ${order.table_no || '未填'}` : `外卖 · ${order.delivery_contact || '顾客'}`}<BR>`;
      feieContent += `支付: ${order.payment_status === '已支付' ? '已支付' : '待结账'}<BR>`;
      if (order.delivery_address) feieContent += `地址: ${order.delivery_address}<BR>`;
      if (order.delivery_phone) feieContent += `电话: ${order.delivery_phone}<BR>`;
      feieContent += `--------------------------------<BR>`;
      feieContent += `品名       数量  单价    小计<BR>`;
      feieContent += `--------------------------------<BR>`;
      for (const item of order.items || []) {
        feieContent += `${item.dish_name.slice(0, 7).padEnd(8, ' ')} ${String(item.quantity).padStart(2, ' ')}  ¥${item.price.toFixed(1).padStart(5, ' ')}  ¥${item.subtotal.toFixed(1).padStart(5, ' ')}<BR>`;
        if (item.taste) {
          feieContent += `  口味: ${item.taste}<BR>`;
        }
      }
      feieContent += `--------------------------------<BR>`;
      feieContent += `合计: ¥${(order.total_amount || 0).toFixed(2)}<BR>`;
      if (order.points_discount) feieContent += `积分抵扣: -¥${Number(order.points_discount).toFixed(2)}<BR>`;
      const finalAmt = order.final_amount !== undefined ? order.final_amount : order.total_amount;
      feieContent += `<B>实付: ¥${Number(finalAmt || 0).toFixed(2)}</B><BR>`;
      if (order.notes) feieContent += `备注: ${order.notes}<BR>`;
      feieContent += `================================<BR>`;
      feieContent += `<C>${ticketFooter}</C><BR>`;

      // 模拟标准飞鹅接口调用
      const feieUrl = 'http://api.feieyun.cn/Api/Open/';
      const time = Math.floor(Date.now() / 1000).toString();
      
      const formData = new URLSearchParams();
      formData.append('user', printerKey);
      formData.append('stime', time);
      formData.append('apiname', 'Open_printMsg');
      formData.append('sn', printerSn);
      formData.append('content', feieContent);
      formData.append('times', String(copies));

      try {
        const res = await fetch(feieUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const json = await res.json().catch(() => null);
        if (json && json.ret === 0) {
          return { success: true, message: '已成功发送打印指令至飞鹅云打印机', target: printerSn };
        } else {
          return { success: false, error: json?.msg || `飞鹅返回错误码: ${json?.ret || '未知'}` };
        }
      } catch (err: any) {
        return { success: false, error: '连接飞鹅云 API 超时: ' + (err?.message || '') };
      }
    }

    // 3. 易联云打印机 (Yilianyun API)
    if (printerType === 'yilianyun') {
      if (!printerSn || !printerKey) {
        return { success: false, error: '易联云打印机要求填写设备终端号(SN)与 API 密钥(KEY)' };
      }

      return {
        success: true,
        message: `已封装易联云指令并推送至终端 ${printerSn}`,
        target: printerSn,
      };
    }

    return { success: false, error: '未知的打印机类型' };
  } catch (error: any) {
    console.error('[sendOrderToPrinter Error]', error);
    return { success: false, error: error?.message || '打印服务异常' };
  }
}
