import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * 虎皮椒（XunhuPay）个人聚合支付通道封装
 * 文档：https://www.xunhupay.com/doc/api/pay.html
 *
 * 签名规则（官方 PHP 参考实现 generate_xh_hash 的 JS 等价物）：
 * 1. 过滤掉 hash 字段本身、值为 null/undefined/空字符串 的参数
 * 2. 参数名按 ASCII 字典序升序排序
 * 3. 按 key1=value1&key2=value2 拼接（值不做 URL 编码）
 * 4. 末尾直接拼接 APPSECRET（无任何连接符）
 * 5. MD5 取 32 位小写 hex
 */

export interface XunhuCreateResult {
  ok: boolean;
  url?: string; // 手机端支付跳转链接（自动识别微信/支付宝）
  urlQrcode?: string; // 二维码图片地址（PC 端展示，有效期 5 分钟）
  errcode?: number;
  errmsg?: string;
  raw?: Record<string, string>;
}

export function xunhuSign(params: Record<string, string | number | undefined | null>, secret: string): string {
  const keys = Object.keys(params)
    .filter((k) => {
      if (k === 'hash') return false;
      const v = params[k];
      return v !== undefined && v !== null && String(v) !== '';
    })
    .sort(); // JS 默认 sort 即按 UTF-16 码单元升序，对 ASCII 参数名等价于 ASCII 字典序

  const base = keys.map((k) => `${k}=${params[k]}`).join('&') + secret;
  return createHash('md5').update(base, 'utf8').digest('hex');
}

export function xunhuVerify(params: Record<string, string>, secret: string): boolean {
  const provided = (params.hash || '').toLowerCase();
  if (!provided) return false;
  const expected = xunhuSign(params, secret);
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
  } catch {
    return false;
  }
}

/** 去掉标题中虎皮椒不允许的字符：% 表情符号（非 BMP）与控制字符，并截断到 40 字符（上限 42 汉字） */
export function sanitizePayTitle(title: string): string {
  return title
    .replace(/[%\u0000-\u001F\u007F]/g, '')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .trim()
    .slice(0, 40) || '餐饮订单';
}

/**
 * 调用虎皮椒「发起付款接口」
 * 网关固定 POST JSON；成功返回 errcode=0 且带 url / url_qrcode
 */
export async function xunhuCreatePayment(opts: {
  gateway: string;
  appid: string;
  secret: string;
  tradeOrderId: string; // 商户订单号（每门店内唯一，字符集 0-9A-Za-z_-，≤32位）
  totalFee: number; // 金额（元）
  title: string;
  notifyUrl: string; // 支付成功异步回调地址（必须公网可达）
  returnUrl?: string; // 支付完成浏览器跳转地址
  attach?: string; // 备注，回调时原样返回（携带 tenantId）
  timeoutMs?: number;
}): Promise<XunhuCreateResult> {
  const {
    gateway, appid, secret, tradeOrderId, totalFee, title,
    notifyUrl, returnUrl, attach, timeoutMs = 10000,
  } = opts;

  const payload: Record<string, string | number> = {
    version: '1.1',
    appid,
    trade_order_id: tradeOrderId,
    total_fee: totalFee.toFixed(2),
    title: sanitizePayTitle(title),
    time: Math.floor(Date.now() / 1000),
    notify_url: notifyUrl,
    nonce_str: randomBytes(8).toString('hex'),
  };
  if (returnUrl) payload.return_url = returnUrl;
  if (attach) payload.attach = attach;
  payload.hash = xunhuSign(payload, secret);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(gateway, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const json: Record<string, unknown> = await res.json();

    // 统一转成字符串表（历史遗留：orderid 返回名是 openid）
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      flat[k] = v === null || v === undefined ? '' : String(v);
    }

    const errcode = Number(flat.errcode);
    if (errcode !== 0) {
      return { ok: false, errcode, errmsg: flat.errmsg || '虎皮椒下单失败', raw: flat };
    }

    // 验证返回签名，防止网关响应被篡改
    if (!xunhuVerify(flat, secret)) {
      return { ok: false, errcode: -1, errmsg: '虎皮椒返回数据验签失败', raw: flat };
    }

    if (!flat.url && !flat.url_qrcode) {
      return { ok: false, errcode: -2, errmsg: '虎皮椒未返回支付链接', raw: flat };
    }

    return {
      ok: true,
      url: flat.url || '',
      urlQrcode: flat.url_qrcode || '',
      raw: flat,
    };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? `虎皮椒网关请求超时(${timeoutMs}ms)` : `虎皮椒网关请求失败: ${err?.message || err}`;
    return { ok: false, errcode: -3, errmsg: msg };
  } finally {
    clearTimeout(timer);
  }
}
