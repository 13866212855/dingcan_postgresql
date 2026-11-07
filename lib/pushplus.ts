import { Order } from '@/types';
import { getSettings } from '@/lib/db';

interface PushPlusSendOptions {
  restaurantName?: string;
  tenantId: string;
  triggerNote?: string;
}

/**
 * 微信新订单强提醒（PushPlus 0元免费微信消息直推）
 * 当顾客下单或支付成功后，主动调用 PushPlus 官方 API 向接单员个人微信发送服务通知
 * 无论接单员在看视频、打游戏还是手机锁屏，微信都会弹出带声音的系统通知
 */
export async function sendOrderPushPlusNotification(
  order: Order,
  options: PushPlusSendOptions
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const settings = await getSettings(options.tenantId);

    if (!settings.pushplus_token || settings.pushplus_enabled === 0) {
      return { success: false, message: 'PushPlus 未开启或未配置 Token，已跳过' };
    }

    const token = settings.pushplus_token.trim();
    const topic = settings.pushplus_topic?.trim() || undefined;
    const storeName = options.restaurantName?.trim() || settings.restaurant_name || '康乐美';

    // 格式化顾客信息
    const customerName = order.customer_name?.trim() || order.delivery_contact?.trim() || '点餐顾客';
    const customerPhone = order.customer_phone?.trim() || order.delivery_phone?.trim() || '未填手机号';
    const deliveryAddress = order.customer_address?.trim() || order.delivery_address?.trim() || '';
    const orderType = order.order_type || (deliveryAddress ? '外卖配送' : '店内堂食');
    const tableInfo = order.table_no && order.table_no !== '自取/未指定桌位' && order.table_no !== '未定' ? ` (${order.table_no})` : '';

    // 构造菜品列表 HTML
    const items = order.items || [];
    const itemsHtml = items.length > 0
      ? items
          .map((i) => {
            const tasteStr = i.taste ? ` <span style="color:#d97706;font-size:12px;">[${i.taste}]</span>` : '';
            return `<li style="margin-bottom: 4px;"><strong>${i.dish_name}</strong> × ${i.quantity}份 (小计: ¥${(i.subtotal || i.price * i.quantity).toFixed(2)})${tasteStr}</li>`;
          })
          .join('')
      : '<li>点餐明细已生成</li>';

    // 构造后台直达链接
    const customDomain = settings.custom_domain?.trim();
    const baseHost = customDomain ? customDomain.replace(/\/+$/, '') : 'https://dingcan-postgresql.onrender.com';
    const adminUrl = `${baseHost}/admin?tenant=${encodeURIComponent(options.tenantId)}`;

    // 标题：醒目加粗，带店名、类型和实收金额
    const title = `🔔【${storeName}】新${orderType}！实付:¥${order.final_amount.toFixed(2)}`;

    // 正文：卡片式排版，重点突出地址、电话和菜品
    const content = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; padding: 14px; border: 1px solid #fed7aa; border-radius: 14px; background: #fffaf5;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fb923c; padding-bottom: 8px; margin-bottom: 12px;">
    <h3 style="color: #c2410c; margin: 0; font-size: 16px;">🔔【${storeName}】新订单到来！</h3>
    <span style="background: #ea580c; color: #fff; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 20px;">${order.payment_status || '已支付'}</span>
  </div>

  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="color: #6b7280; width: 75px; padding: 3px 0;">订单编号：</td>
      <td style="font-family: monospace; font-weight: bold; color: #111827;">${order.id}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">就餐方式：</td>
      <td style="color: #2563eb; font-weight: bold;">${orderType}${tableInfo}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">实付金额：</td>
      <td style="color: #dc2626; font-size: 16px; font-weight: 900;">¥${order.final_amount.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">下单顾客：</td>
      <td style="font-weight: bold; color: #111827;">${customerName}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">联系电话：</td>
      <td><a href="tel:${customerPhone}" style="color: #0284c7; font-weight: bold; text-decoration: none;">${customerPhone} (点击拨打)</a></td>
    </tr>
    ${
      deliveryAddress
        ? `<tr>
      <td style="color: #6b7280; padding: 3px 0; vertical-align: top;">送餐地址：</td>
      <td style="color: #059669; font-weight: bold; font-size: 13px; line-height: 1.4;">${deliveryAddress}</td>
    </tr>`
        : ''
    }
    ${
      order.notes
        ? `<tr>
      <td style="color: #b45309; padding: 3px 0; vertical-align: top;">顾客备注：</td>
      <td style="color: #b45309; font-weight: bold; background: #fef3c7; padding: 3px 6px; border-radius: 4px;">${order.notes}</td>
    </tr>`
        : ''
    }
  </table>

  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
    <div style="font-size: 12px; font-weight: bold; color: #374151; margin-bottom: 6px;">🍱 菜品清单：</div>
    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4b5563;">
      ${itemsHtml}
    </ul>
  </div>

  <div style="text-align: center; margin-top: 14px;">
    <a href="${adminUrl}" style="display: block; background: #059669; color: #ffffff; padding: 10px 16px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; text-align: center; box-shadow: 0 2px 4px rgba(5,150,105,0.2);">
      👉 点击进入后台直接接单处理
    </a>
    <div style="font-size: 10px; color: #9ca3af; margin-top: 6px;">
      微信锁屏与后台免漏单提醒服务 · Powered by PushPlus
    </div>
  </div>
</div>
`.trim();

    const pushPayload: any = {
      token,
      title,
      content,
      template: 'html',
    };

    if (topic) {
      pushPayload.topic = topic;
    }

    const res = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushPayload),
    });

    const data = await res.json();
    if (data.code === 200) {
      return { success: true, message: data.msg || '微信强提醒推送成功' };
    } else {
      console.warn('[PushPlus Warning]', data);
      return { success: false, error: data.msg || `PushPlus 错误码: ${data.code}` };
    }
  } catch (err: any) {
    console.error('[PushPlus Error]', err?.message || err);
    return { success: false, error: err?.message || '网络连接超时' };
  }
}

/**
 * 测试发送一条 PushPlus 微信通知
 */
export async function sendTestPushPlusNotification(
  token: string,
  topic?: string,
  restaurantName?: string,
  tenantId = 'default'
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!token?.trim()) {
    return { success: false, error: '请先填入有效的 PushPlus Token' };
  }

  const storeName = restaurantName?.trim() || '康乐美订餐系统';
  const nowStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const adminUrl = `https://dingcan-postgresql.onrender.com/admin?tenant=${encodeURIComponent(tenantId)}`;

  const title = `🔔【${storeName}】微信接单声音提醒测试成功！`;
  const content = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; padding: 14px; border: 1px solid #86efac; border-radius: 14px; background: #f0fdf4;">
  <div style="border-bottom: 2px solid #22c55e; padding-bottom: 8px; margin-bottom: 12px;">
    <h3 style="color: #15803d; margin: 0; font-size: 16px;">🎉【${storeName}】微信通知配置成功！</h3>
  </div>
  <p style="font-size: 13px; color: #166534; line-height: 1.5;">
    恭喜！当您在微信中看到这条消息时，说明新订单微信强提醒已配置完毕。
  </p>
  <div style="background: #ffffff; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 12px; color: #374151;">
    <p style="margin: 3px 0;">• <strong>发送时间：</strong>${nowStr}</p>
    <p style="margin: 3px 0;">• <strong>提示音验证：</strong>微信已发出提示音并弹出横幅</p>
    <p style="margin: 3px 0;">• <strong>免漏单保障：</strong>以后即使在手机上看视频、刷聊天或锁屏放口袋，新订单到来时都会像这条消息一样准时叮咚提醒！</p>
  </div>
  <div style="text-align: center; margin-top: 14px;">
    <a href="${adminUrl}" style="display: block; background: #16a34a; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px;">
      👉 点击返回管理后台
    </a>
  </div>
</div>
`.trim();

  const pushPayload: any = {
    token: token.trim(),
    title,
    content,
    template: 'html',
  };

  if (topic?.trim()) {
    pushPayload.topic = topic.trim();
  }

  try {
    const res = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushPayload),
    });

    const data = await res.json();
    if (data.code === 200) {
      return { success: true, message: '测试消息已成功发送至您的微信，请留意手机微信提示音！' };
    } else {
      return { success: false, error: data.msg || `PushPlus 错误码: ${data.code}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接超时' };
  }
}
