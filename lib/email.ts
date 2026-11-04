import nodemailer, { type Transporter } from 'nodemailer';
import dns from 'dns';
import net from 'net';
import tls from 'tls';
import { Order } from '@/types';
import { getSettings } from '@/lib/db';

export interface SmtpConfigOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  timeout?: number; // 秒
  notifyTo?: string;
}

/**
 * 获取当前租户或系统生效的 SMTP 配置
 */
export async function getEffectiveSmtpConfig(tenantId?: string): Promise<{
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  timeout: number;
  notifyTo: string;
  source: 'database' | 'environment' | 'default';
}> {
  let dbConfig: any = null;
  if (tenantId) {
    try {
      dbConfig = await getSettings(tenantId);
    } catch {
      // 降级使用环境变量
    }
  }

  const host = (dbConfig?.smtp_host || process.env.SMTP_HOST || 'smtp.qq.com').trim();
  const port = Number(dbConfig?.smtp_port || process.env.SMTP_PORT) || 465;
  const secure = dbConfig?.smtp_secure !== undefined
    ? dbConfig.smtp_secure === 1
    : (process.env.SMTP_SECURE === 'false' ? false : port === 465);
  const user = (dbConfig?.smtp_user || process.env.SMTP_USER || '527194933@qq.com').trim();
  const pass = (dbConfig?.smtp_pass || process.env.SMTP_PASS || 'rvlehugdnsmccajh').trim();
  const timeout = Math.max(5, Math.min(60, Number(dbConfig?.smtp_timeout) || 15));
  const notifyTo = (dbConfig?.notify_email_to || process.env.NOTIFY_EMAIL_TO || '527194933@qq.com').trim();

  const source = dbConfig?.smtp_user ? 'database' : (process.env.SMTP_PASS ? 'environment' : 'default');

  return { host, port, secure, user, pass, timeout, notifyTo, source };
}

/**
 * 创建 Nodemailer 发信实例（针对境外云服务器如 Render / AWS 做了超时扩容与 TLS 兼容）
 */
export function createTransporter(options?: SmtpConfigOptions): Transporter {
  const host = options?.host || process.env.SMTP_HOST || 'smtp.qq.com';
  const defaultPort = Number(process.env.SMTP_PORT) || 465;
  const port = options?.port ?? defaultPort;
  const secure = options?.secure ?? (port === 465);
  const user = options?.user || process.env.SMTP_USER || '527194933@qq.com';
  const pass = options?.pass || process.env.SMTP_PASS || 'rvlehugdnsmccajh';
  const timeoutMs = (options?.timeout || 15) * 1000;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user,
      pass,
    },
    // 跨国公网连接优化配置：设置15秒充足连接握手窗口
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs + 5000,
    tls: {
      // 避免境外容器中因 CA 根证书链缺失导致 SSL 握手挂起或连接中断
      rejectUnauthorized: false,
      ciphers: 'DEFAULT',
      minVersion: 'TLSv1.2',
    },
  });
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
  diagnostics?: any;
}

// 内存防重复发信缓存（60秒内同一单号同一状态不重复发送，杜绝并发轰炸）
const sentOrderEmailTimestamps = new Map<string, number>();

/**
 * 客户点击“我已完成扫码支付”或后台新单声音播报时，自动向指定邮箱发送详单提醒
 */
export async function sendOrderPaymentEmail(
  order: Order,
  options?: {
    restaurantName?: string;
    noteTrigger?: string;
    force?: boolean;
    tenantId?: string;
    customConfig?: SmtpConfigOptions;
  }
): Promise<SendOrderEmailResult> {
  const cacheKey = `${order.tenant_id || options?.tenantId || 'default'}_${order.id}_${order.payment_status}`;
  const now = Date.now();
  const lastSent = sentOrderEmailTimestamps.get(cacheKey);

  if (!options?.force && lastSent && now - lastSent < 60000) {
    return {
      success: true,
      messageId: 'cached_dedup',
    };
  }

  const effective = await getEffectiveSmtpConfig(order.tenant_id || options?.tenantId);
  const host = options?.customConfig?.host || effective.host;
  const port = options?.customConfig?.port || effective.port;
  const secure = options?.customConfig?.secure !== undefined ? options.customConfig.secure : effective.secure;
  const userEmail = options?.customConfig?.user || effective.user;
  const pass = options?.customConfig?.pass || effective.pass;
  const targetEmail = options?.customConfig?.notifyTo || effective.notifyTo;
  const timeoutSec = options?.customConfig?.timeout || effective.timeout;

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

  const primaryConfig: SmtpConfigOptions = {
    host,
    port,
    secure,
    user: userEmail,
    pass,
    timeout: timeoutSec,
  };

  try {
    let info: any;
    let usedPort = port;

    try {
      console.log(`[Email Notice] 准备向 ${targetEmail} 发送订单邮件，优先通道: ${host}:${port} (secure: ${secure}, timeout: ${timeoutSec}s)`);
      const transporter = createTransporter(primaryConfig);
      info = await transporter.sendMail({
        from: `"${shopName}订单通知" <${userEmail}>`,
        to: targetEmail,
        subject,
        html: htmlContent,
      });
    } catch (primaryError: any) {
      const errMsg = String(primaryError?.message || '');
      const errCode = String(primaryError?.code || '');
      console.warn(`[Email Notice] 主端口 ${port} 发信失败:`, errCode, errMsg);

      // 若处于境外云主机环境（如 Render / AWS / GCP），宿主机云防火墙或跨国网络可能导致 465 或 587 端口出站丢包
      // 若出现超时或连接拒绝，自动切换备用端口（465 <-> 587）进行二次无缝重试
      const isNetworkIssue =
        errMsg.includes('timeout') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('ECONNREFUSED') ||
        errCode === 'ETIMEDOUT' ||
        errCode === 'ECONNREFUSED';

      if (isNetworkIssue) {
        const fallbackPort = port === 465 ? 587 : 465;
        const fallbackSecure = fallbackPort === 465;
        console.warn(`[Email Notice] 检测到网络连接超时/受阻，立即启动备用端口 ${fallbackPort} (secure: ${fallbackSecure}) 降级重试...`);

        const fallbackTransporter = createTransporter({
          ...primaryConfig,
          port: fallbackPort,
          secure: fallbackSecure,
          timeout: timeoutSec + 5, // 备用端口多给5秒握手余量
        });

        usedPort = fallbackPort;
        info = await fallbackTransporter.sendMail({
          from: `"${shopName}订单通知" <${userEmail}>`,
          to: targetEmail,
          subject,
          html: htmlContent,
        });
      } else {
        throw primaryError;
      }
    }

    console.log(`[Email Notice] ✔ 成功通过端口 ${usedPort} 向 ${targetEmail} 发送订单支付详单 (Message ID: ${info.messageId})`);
    sentOrderEmailTimestamps.set(cacheKey, now);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    const errorDetails = formatEmailError(error, { host, port, user: userEmail });
    console.error('[Email Notice Error] 发送邮件异常:', errorDetails.summary, error);
    return {
      success: false,
      error: errorDetails.summary,
      diagnostics: errorDetails,
    };
  }
}

/**
 * 测试邮件发送（用于后台设置页面一键验证 QQ 邮箱联通性）
 */
export async function testSendEmail(
  targetEmail: string = '527194933@qq.com',
  customConfig?: SmtpConfigOptions,
  tenantId?: string
): Promise<SendOrderEmailResult> {
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
    noteTrigger: '管理员在后台点击【发送一封测试详单邮件】',
    force: true,
    tenantId,
    customConfig: {
      ...customConfig,
      notifyTo: targetEmail,
    },
  });
}

/**
 * 探测指定主机和端口的 TCP 连通性（带超时控制，不依赖外部库）
 */
function probeSocket(host: string, port: number, timeoutMs = 8000): Promise<{ ok: boolean; duration: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const sock = new net.Socket();
    let settled = false;

    sock.setTimeout(timeoutMs);

    sock.on('connect', () => {
      if (!settled) {
        settled = true;
        const duration = Date.now() - start;
        sock.destroy();
        resolve({ ok: true, duration });
      }
    });

    sock.on('timeout', () => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve({ ok: false, duration: Date.now() - start, error: `连接超时（${timeoutMs}ms内未完成TCP握手）` });
      }
    });

    sock.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve({ ok: false, duration: Date.now() - start, error: err.message || 'TCP连接被拒绝' });
      }
    });

    try {
      sock.connect(port, host);
    } catch (e: any) {
      if (!settled) {
        settled = true;
        resolve({ ok: false, duration: Date.now() - start, error: e.message });
      }
    }
  });
}

/**
 * 探测 465 端口的 TLS 握手连通性与加密套件
 */
function probeTls(host: string, port: number, timeoutMs = 8000): Promise<{ ok: boolean; duration: number; cipher?: any; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;

    const sock = tls.connect(
      {
        host,
        port,
        servername: host,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      () => {
        if (!settled) {
          settled = true;
          const duration = Date.now() - start;
          const cipher = sock.getCipher();
          sock.destroy();
          resolve({ ok: true, duration, cipher });
        }
      }
    );

    sock.on('timeout', () => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve({ ok: false, duration: Date.now() - start, error: `TLS握手超时（${timeoutMs}ms）` });
      }
    });

    sock.on('error', (err: any) => {
      if (!settled) {
        settled = true;
        sock.destroy();
        resolve({ ok: false, duration: Date.now() - start, error: err.message || 'TLS握手异常' });
      }
    });
  });
}

export interface DiagnosticStep {
  name: string;
  status: 'success' | 'warning' | 'error' | 'info';
  title: string;
  durationMs?: number;
  details: string;
  solution?: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallStatus: 'passed' | 'warning' | 'failed';
  summary: string;
  steps: DiagnosticStep[];
  configSummary: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    passMasked: string;
    notifyTo: string;
    source: string;
    timeoutSec: number;
  };
  recommendations: string[];
}

/**
 * 深度诊断生产环境与云平台（如 Render / AWS / GCP）下的 SMTP 邮件服务连通性
 */
export async function diagnoseSmtpConnection(
  tenantId?: string,
  customConfig?: SmtpConfigOptions
): Promise<DiagnosticReport> {
  const effective = await getEffectiveSmtpConfig(tenantId);
  const host = (customConfig?.host || effective.host).trim();
  const port = Number(customConfig?.port || effective.port) || 465;
  const secure = customConfig?.secure !== undefined ? customConfig.secure : effective.secure;
  const user = (customConfig?.user || effective.user).trim();
  const pass = (customConfig?.pass || effective.pass).trim();
  const notifyTo = (customConfig?.notifyTo || effective.notifyTo).trim();
  const timeoutSec = Math.max(5, Math.min(60, Number(customConfig?.timeout || effective.timeout)));

  const maskPass = pass
    ? pass.length > 8
      ? `${pass.slice(0, 4)}****${pass.slice(-4)}`
      : '********'
    : '未配置(空)';

  const steps: DiagnosticStep[] = [];
  const recommendations: string[] = [];

  // 1. 凭据合法性检查
  const isAuthCodeFormatValid = /^[a-z]{16}$/i.test(pass);
  const isUserValidEmail = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(user);

  if (!pass) {
    steps.push({
      name: 'credentials_check',
      status: 'error',
      title: '发信授权码配置缺失',
      details: '系统未检测到 SMTP 发信授权码 (SMTP_PASS 为空)。',
      solution: '请在上方输入框或 Render 面板添加 16 位 QQ 邮箱独立授权码。',
    });
    recommendations.push('请在 QQ 邮箱网页端【设置 -> 账户】生成 16 位 POP3/SMTP 授权码并填入。');
  } else if (!isAuthCodeFormatValid) {
    steps.push({
      name: 'credentials_check',
      status: 'warning',
      title: '授权码格式异常（疑似非16位纯英文字母）',
      details: `当前授权码为 ${pass.length} 位字符。QQ 邮箱 SMTP 授权码必须是 16 位纯英文小写字母（例如 rvlehugdnsmccajh），切勿直接使用 QQ 登录密码。`,
      solution: '请进入 QQ 邮箱电脑网页端【设置 -> 账户 -> 生成授权码】重新获取 16 位独立授权码。',
    });
    recommendations.push('请检查是否误将 QQ 账号登录密码填入了授权码位置，必须使用 16 位独立授权码。');
  } else {
    steps.push({
      name: 'credentials_check',
      status: 'success',
      title: '发信账号与授权码格式校验通过',
      details: `发信账号: ${user}，授权码: ${maskPass}（16位有效格式验证通过）。`,
    });
  }

  // 2. DNS 解析测试
  const dnsStart = Date.now();
  let resolvedIps: string[] = [];
  try {
    resolvedIps = await dns.promises.resolve4(host);
    const dnsDuration = Date.now() - dnsStart;
    steps.push({
      name: 'dns_resolution',
      status: 'success',
      title: `DNS 域名解析成功 (${dnsDuration}ms)`,
      durationMs: dnsDuration,
      details: `发信服务器 ${host} 成功解析为 ${resolvedIps.length} 个 IP 地址: [${resolvedIps.join(', ')}]。`,
    });
  } catch (dnsErr: any) {
    const dnsDuration = Date.now() - dnsStart;
    steps.push({
      name: 'dns_resolution',
      status: 'error',
      title: `DNS 解析失败 (${dnsDuration}ms)`,
      durationMs: dnsDuration,
      details: `无法解析发信服务器 ${host}: ${dnsErr.message}。`,
      solution: '请检查发信域名是否拼写有误，或宿主机 DNS 缓存异常。',
    });
    recommendations.push(`宿主机无法解析域名 ${host}，请检查云平台 DNS 设置。`);
  }

  // 3. 端口 465 (SSL) 连通性探测
  const probe465 = await probeSocket(host, 465, 8000);
  if (probe465.ok) {
    steps.push({
      name: 'port_465_tcp',
      status: 'success',
      title: `端口 465 (SSL Direct) TCP 连通成功 (${probe465.duration}ms)`,
      durationMs: probe465.duration,
      details: `宿主机到 ${host}:465 的 TCP 三次握手耗时 ${probe465.duration}ms，无阻断。`,
    });
  } else {
    steps.push({
      name: 'port_465_tcp',
      status: 'error',
      title: `端口 465 (SSL) 连接受阻/超时 (${probe465.duration}ms)`,
      durationMs: probe465.duration,
      details: `尝试连接 ${host}:465 失败: ${probe465.error}。`,
      solution: '云厂商（如 Render / AWS / GCP）通常限制或严密审查 465 端口跨国出站流量。建议切换为 587 端口 (STARTTLS)。',
    });
    recommendations.push('海外服务器连接 QQ 邮箱 465 端口被防火墙超时拦截时，强烈建议切换至 587 端口 (STARTTLS)。');
  }

  // 4. 端口 587 (STARTTLS) 连通性探测
  const probe587 = await probeSocket(host, 587, 8000);
  if (probe587.ok) {
    steps.push({
      name: 'port_587_tcp',
      status: 'success',
      title: `端口 587 (STARTTLS) TCP 连通成功 (${probe587.duration}ms)`,
      durationMs: probe587.duration,
      details: `宿主机到 ${host}:587 的 TCP 连接耗时 ${probe587.duration}ms，支持 STARTTLS 传输加密。`,
    });
  } else {
    steps.push({
      name: 'port_587_tcp',
      status: 'warning',
      title: `端口 587 (STARTTLS) 连接超时/拒绝 (${probe587.duration}ms)`,
      durationMs: probe587.duration,
      details: `尝试连接 ${host}:587 失败: ${probe587.error}。`,
      solution: '请确认宿主机防火墙是否放行了 587 端口出站。',
    });
  }

  // 5. TLS 握手测试（针对当前配置）
  if (port === 465 && probe465.ok) {
    const tlsTest = await probeTls(host, 465, 8000);
    if (tlsTest.ok) {
      steps.push({
        name: 'tls_handshake',
        status: 'success',
        title: `TLS 握手协商成功 (${tlsTest.duration}ms)`,
        durationMs: tlsTest.duration,
        details: `已协商密码套件: ${tlsTest.cipher?.name || 'AES-GCM'}, 协议版本: ${tlsTest.cipher?.version || 'TLSv1.2'}。`,
      });
    } else {
      steps.push({
        name: 'tls_handshake',
        status: 'error',
        title: `TLS 握手失败 (${tlsTest.duration}ms)`,
        durationMs: tlsTest.duration,
        details: `TLS 握手异常: ${tlsTest.error}。`,
        solution: '系统已启用 rejectUnauthorized: false，仍失败可能是网络包被篡改或阻断。',
      });
    }
  }

  // 6. SMTP AUTH 认证实际握手校验 (verify)
  const authStart = Date.now();
  let authSuccess = false;
  let authErrorMsg = '';

  try {
    const testTransporter = createTransporter({
      host,
      port,
      secure,
      user,
      pass,
      timeout: timeoutSec,
    });

    await testTransporter.verify();
    const authDuration = Date.now() - authStart;
    authSuccess = true;
    steps.push({
      name: 'smtp_verify',
      status: 'success',
      title: `QQ 邮箱 SMTP 身份认证成功 (${authDuration}ms)`,
      durationMs: authDuration,
      details: `成功与 ${host}:${port} 建立 SMTP 会话，发件人账号与 16 位授权码校验全部通过！`,
    });
  } catch (verifyErr: any) {
    const authDuration = Date.now() - authStart;
    authErrorMsg = verifyErr?.message || '身份认证失败';
    const errCode = String(verifyErr?.code || '');
    const resp = String(verifyErr?.response || '');

    const formatted = formatEmailError(verifyErr, { host, port, user });
    steps.push({
      name: 'smtp_verify',
      status: 'error',
      title: `SMTP 会话认证失败 (${authDuration}ms)`,
      durationMs: authDuration,
      details: formatted.summary,
      solution: formatted.solution,
    });

    if (formatted.solution) {
      recommendations.push(formatted.solution);
    }
  }

  // 针对 Render 等海外公网环境的专属建议汇总
  if (probe465.ok === false && probe587.ok === true) {
    recommendations.unshift('【重要推荐】当前服务器到 465 端口超时，但 587 端口畅通！请在下方将端口改为「587」，并取消勾选 SSL (使用 STARTTLS)，然后点击保存。');
  }

  recommendations.push(
    '【Render 生产环境配置规范】在 Render 后台控制台 -> 点击您的 Web Service -> 进入「Environment」页面，确保添加了环境变量：SMTP_USER="527194933@qq.com"，SMTP_PASS="rvlehugdnsmccajh"，SMTP_PORT="465"（或 587）。'
  );

  recommendations.push(
    '【QQ 邮箱异地安全风控提醒】由于 Render 服务器位于美国或欧洲，首次发信可能会触发腾讯异地登录提醒，若收到腾讯安全提醒邮件，请在微信或 QQ 邮箱中点击「确认是本人操作/信任该设备」。'
  );

  const hasErrors = steps.some((s) => s.status === 'error');
  const hasWarnings = steps.some((s) => s.status === 'warning');

  let overallStatus: 'passed' | 'warning' | 'failed' = 'passed';
  let summary = '恭喜！SMTP 发信通道、网络握手及授权码身份校验全部正常，服务随时就绪！';

  if (hasErrors) {
    overallStatus = 'failed';
    summary = `检测到关键错误：${steps.find((s) => s.status === 'error')?.details || '网络或凭据异常'}，请参考诊断建议处理。`;
  } else if (hasWarnings) {
    overallStatus = 'warning';
    summary = '网络基本连通，但存在格式或备用通道警告，建议根据指引优化。';
  }

  return {
    timestamp: new Date().toISOString(),
    overallStatus,
    summary,
    steps,
    configSummary: {
      host,
      port,
      secure,
      user,
      passMasked: maskPass,
      notifyTo,
      source: effective.source,
      timeoutSec,
    },
    recommendations,
  };
}

/**
 * 智能翻译与格式化 Nodemailer 底层错误码，生成面向运维与商户的精准中文分析
 */
function formatEmailError(
  err: any,
  context: { host: string; port: number; user: string }
): { summary: string; solution: string; category: string } {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  const response = String(err?.response || '');

  // 1. 超时错误 (Render / AWS 最常见)
  if (msg.includes('Connection timeout') || code === 'ETIMEDOUT' || msg.includes('ETIMEDOUT')) {
    return {
      category: 'TIMEOUT',
      summary: `公网网络连接超时 (Connection timeout: 无法在限时内连通 ${context.host}:${context.port})`,
      solution: `原因多为宿主机（Render/云平台）出站防火墙拦截了 ${context.port} 端口或中美跨国骨干网握手丢包。建议：1. 切换端口为 587 (STARTTLS) 重试；2. 适当将连接超时由 15 秒调高至 20 秒；3. 检查 Render 容器网络策略。`,
    };
  }

  // 2. 连接被拒绝
  if (msg.includes('ECONNREFUSED') || code === 'ECONNREFUSED') {
    return {
      category: 'CONN_REFUSED',
      summary: `连接被拒绝 (ECONNREFUSED: 端口 ${context.port} 拒绝建立连接)`,
      solution: `目标端口 ${context.port} 未开放或受到安全组阻断。建议将端口切换至 587 或 465。`,
    };
  }

  // 3. QQ 邮箱 SMTP 授权码认证失败 (535)
  if (response.includes('535') || msg.includes('535') || msg.includes('authentication failed') || code === 'EAUTH') {
    return {
      category: 'AUTH_FAILED',
      summary: `QQ 邮箱 SMTP 身份验证失败 (535 Error: 授权码错误或服务未开通)`,
      solution: `请检查：1. 填入的不是 QQ 密码，而是网页端生成的 16 位独立授权码；2. 登录 mail.qq.com -> 设置 -> 账户 -> 确认【POP3/SMTP服务】为开启状态；3. 重新点击「生成授权码」并更新到后台。`,
    };
  }

  // 4. DNS 解析失败
  if (code === 'ENOTFOUND' || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return {
      category: 'DNS_FAIL',
      summary: `无法解析发信主机地址 (ENOTFOUND: ${context.host})`,
      solution: `宿主机无法解析 ${context.host}，请确认发信服务器是否填写为 smtp.qq.com。`,
    };
  }

  // 5. 异地安全拦截 / 频率限制 (550 / 554 / 542)
  if (response.includes('550') || response.includes('554') || response.includes('spam') || response.includes('frequently')) {
    return {
      category: 'SPAM_OR_FREQUENCY',
      summary: `QQ 邮件服务器拒信或触发安全风控 (${response})`,
      solution: `境外 IP 频繁发信触发了腾讯反垃圾风控或异地拦截。请在 QQ 邮箱安全中心中将发件 IP 加入信任设备，或稍候再试。`,
    };
  }

  // 6. 其他未知错误
  return {
    category: 'UNKNOWN',
    summary: `发信异常: ${msg || '未知错误'}`,
    solution: `建议检查 SMTP 发信服务器域名、端口号、授权码以及网络连通性。`,
  };
}
