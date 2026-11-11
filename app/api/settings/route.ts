import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSetting } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const settings = await getSettings(tenantId);

    // 安全收紧（2026-11-11）：密钥类配置仅对持管理员会话的请求下发。
    // 公网/顾客端只读展示与下单流程所需配置，不使用 llm_api_key 与 smtp_pass；
    // 管理员后台（已登录，带 restaurant_admin_auth cookie）仍取全量，编辑与保存不受影响。
    const isAdmin =
      req.cookies.get('restaurant_admin_auth')?.value === 'authenticated_admin_token';
    if (!isAdmin) {
      const publicSafe: Record<string, unknown> = {
        ...(settings as unknown as Record<string, unknown>),
      };
      delete publicSafe.llm_api_key;
      delete publicSafe.smtp_pass;
      return NextResponse.json({ success: true, data: publicSafe, tenantId });
    }

    return NextResponse.json({ success: true, data: settings, tenantId });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取系统配置失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 安全收紧（2026-11-11）：系统配置写入必须持管理员会话——此前任何公网请求均可改写任意租户配置
    // （包括调换收款二维码、关闭外卖费用），属于严重暴露面。所有保存入口均在管理员后台内，自带会话 cookie。
    if (
      req.cookies.get('restaurant_admin_auth')?.value !== 'authenticated_admin_token'
    ) {
      return NextResponse.json(
        { success: false, error: '无管理员权限，请先登录后台' },
        { status: 401 }
      );
    }

    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const {
      payment_qr_code,
      points_ratio,
      custom_domain,
      restaurant_name,
      restaurant_logo,
      restaurant_slogan,
      enable_dine_in,
      enable_takeout,
      require_table_no,
      table_input_mode,
      enable_pay_before,
      enable_pay_after,
      pay_mode,
      xhu_appid,
      xhu_secret,
      xhu_gateway,
      pay_notify_base,
      scan_return_confirm,
      takeout_min_amount,
      takeout_packing_fee,
      takeout_delivery_fee,
      takeout_free_delivery_over,
      llm_base_url,
      llm_api_key,
      llm_text_model,
      llm_image_model,
      llm_auto_process_images,
      llm_max_image_dimension,
      llm_image_quality,
      auto_print_enabled,
      printer_type,
      printer_name,
      printer_sn,
      printer_key,
      printer_webhook_url,
      printer_secret_token,
      printer_copies,
      printer_ticket_header,
      printer_ticket_footer,
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      notify_email_to,
      smtp_timeout,
      amap_web_key,
      pushplus_enabled,
      wechat_push_channel,
      wxpusher_app_token,
      wxpusher_uid,
      wxpusher_topic_id,
      pushplus_token,
      pushplus_topic,
    } = body;

    if (enable_dine_in !== undefined) {
      await updateSetting('enable_dine_in', enable_dine_in ? '1' : '0', tenantId);
    }

    if (enable_takeout !== undefined) {
      await updateSetting('enable_takeout', enable_takeout ? '1' : '0', tenantId);
    }

    if (require_table_no !== undefined) {
      await updateSetting('require_table_no', require_table_no ? '1' : '0', tenantId);
    }

    if (table_input_mode !== undefined) {
      const mode = String(table_input_mode);
      if (['select', 'input', 'both'].includes(mode)) {
        await updateSetting('table_input_mode', mode, tenantId);
      }
    }

    if (enable_pay_before !== undefined) {
      await updateSetting('enable_pay_before', enable_pay_before ? '1' : '0', tenantId);
    }

    if (enable_pay_after !== undefined) {
      await updateSetting('enable_pay_after', enable_pay_after ? '1' : '0', tenantId);
    }

    // 在线支付通道（虎皮椒）配置更新
    if (pay_mode !== undefined) {
      await updateSetting('pay_mode', pay_mode === 'xunhupay' ? 'xunhupay' : 'static', tenantId);
    }
    if (xhu_appid !== undefined) {
      await updateSetting('xhu_appid', String(xhu_appid).trim(), tenantId);
    }
    if (xhu_secret !== undefined && String(xhu_secret).trim() !== '') {
      // 密钥仅在管理员明确输入新值时覆盖（留空 = 保留原密钥不改动）
      await updateSetting('xhu_secret', String(xhu_secret).trim(), tenantId);
    }
    if (xhu_gateway !== undefined) {
      const gw = String(xhu_gateway).trim();
      if (gw) {
        await updateSetting('xhu_gateway', gw, tenantId);
      }
    }
    if (pay_notify_base !== undefined) {
      await updateSetting('pay_notify_base', String(pay_notify_base).trim().replace(/\/+$/, ''), tenantId);
    }
    if (scan_return_confirm !== undefined) {
      await updateSetting('scan_return_confirm', scan_return_confirm ? '1' : '0', tenantId);
    }

    // 外卖费用配置更新（范围 0~999 元，0=不启用）
    const clampFee = (v: unknown) => Math.min(999, Math.max(0, Number(v) || 0));
    if (takeout_min_amount !== undefined) {
      await updateSetting('takeout_min_amount', String(clampFee(takeout_min_amount)), tenantId);
    }
    if (takeout_packing_fee !== undefined) {
      await updateSetting('takeout_packing_fee', String(clampFee(takeout_packing_fee)), tenantId);
    }
    if (takeout_delivery_fee !== undefined) {
      await updateSetting('takeout_delivery_fee', String(clampFee(takeout_delivery_fee)), tenantId);
    }
    if (takeout_free_delivery_over !== undefined) {
      await updateSetting('takeout_free_delivery_over', String(clampFee(takeout_free_delivery_over)), tenantId);
    }

    if (payment_qr_code !== undefined) {
      await updateSetting('payment_qr_code', String(payment_qr_code), tenantId);
    }

    if (custom_domain !== undefined) {
      await updateSetting('custom_domain', String(custom_domain).trim(), tenantId);
    }

    if (restaurant_name !== undefined) {
      const name = String(restaurant_name).trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: '店面名称不能为空' },
          { status: 400 }
        );
      }
      await updateSetting('restaurant_name', name, tenantId);
    }

    if (restaurant_logo !== undefined) {
      await updateSetting('restaurant_logo', String(restaurant_logo).trim(), tenantId);
    }

    if (restaurant_slogan !== undefined) {
      await updateSetting('restaurant_slogan', String(restaurant_slogan).trim(), tenantId);
    }

    if (points_ratio !== undefined) {
      const ratio = Number(points_ratio);
      if (isNaN(ratio) || ratio < 0 || ratio > 100) {
        return NextResponse.json(
          { success: false, error: '积分返还比例必须在 0% 到 100% 之间' },
          { status: 400 }
        );
      }
      await updateSetting('points_ratio', String(ratio), tenantId);
    }

    // 大模型配置更新
    if (llm_base_url !== undefined) {
      await updateSetting('llm_base_url', String(llm_base_url).trim(), tenantId);
    }
    if (llm_api_key !== undefined) {
      await updateSetting('llm_api_key', String(llm_api_key).trim(), tenantId);
    }
    if (llm_text_model !== undefined) {
      await updateSetting('llm_text_model', String(llm_text_model).trim(), tenantId);
    }
    if (llm_image_model !== undefined) {
      await updateSetting('llm_image_model', String(llm_image_model).trim(), tenantId);
    }
    if (llm_auto_process_images !== undefined) {
      await updateSetting('llm_auto_process_images', llm_auto_process_images ? '1' : '0', tenantId);
    }
    if (llm_max_image_dimension !== undefined) {
      const dim = parseInt(String(llm_max_image_dimension)) || 1200;
      await updateSetting('llm_max_image_dimension', String(dim), tenantId);
    }
    if (llm_image_quality !== undefined) {
      const qual = Math.min(100, Math.max(10, parseInt(String(llm_image_quality)) || 82));
      await updateSetting('llm_image_quality', String(qual), tenantId);
    }

    // 自动打印模块配置更新
    if (auto_print_enabled !== undefined) {
      await updateSetting('auto_print_enabled', auto_print_enabled ? '1' : '0', tenantId);
    }
    if (printer_type !== undefined) {
      const pType = String(printer_type).trim();
      if (['webhook', 'feie', 'yilianyun'].includes(pType)) {
        await updateSetting('printer_type', pType, tenantId);
      }
    }
    if (printer_name !== undefined) {
      await updateSetting('printer_name', String(printer_name).trim(), tenantId);
    }
    if (printer_sn !== undefined) {
      await updateSetting('printer_sn', String(printer_sn).trim(), tenantId);
    }
    if (printer_key !== undefined) {
      await updateSetting('printer_key', String(printer_key).trim(), tenantId);
    }
    if (printer_webhook_url !== undefined) {
      await updateSetting('printer_webhook_url', String(printer_webhook_url).trim(), tenantId);
    }
    if (printer_secret_token !== undefined) {
      await updateSetting('printer_secret_token', String(printer_secret_token).trim(), tenantId);
    }
    if (printer_copies !== undefined) {
      const copies = Math.min(3, Math.max(1, parseInt(String(printer_copies)) || 1));
      await updateSetting('printer_copies', String(copies), tenantId);
    }
    if (printer_ticket_header !== undefined) {
      await updateSetting('printer_ticket_header', String(printer_ticket_header).trim(), tenantId);
    }
    if (printer_ticket_footer !== undefined) {
      await updateSetting('printer_ticket_footer', String(printer_ticket_footer).trim(), tenantId);
    }

    // SMTP 邮件通知配置更新
    if (smtp_host !== undefined) {
      await updateSetting('smtp_host', String(smtp_host).trim(), tenantId);
    }
    if (smtp_port !== undefined) {
      const portNum = Number(smtp_port) || 465;
      await updateSetting('smtp_port', String(portNum), tenantId);
    }
    if (smtp_secure !== undefined) {
      await updateSetting('smtp_secure', smtp_secure ? '1' : '0', tenantId);
    }
    if (smtp_user !== undefined) {
      await updateSetting('smtp_user', String(smtp_user).trim(), tenantId);
    }
    if (smtp_pass !== undefined) {
      // 允许更新授权码（保留去除多余空格的纯净16位密钥）
      await updateSetting('smtp_pass', String(smtp_pass).trim(), tenantId);
    }
    if (notify_email_to !== undefined) {
      await updateSetting('notify_email_to', String(notify_email_to).trim(), tenantId);
    }
    if (smtp_timeout !== undefined) {
      const timeoutSec = Math.max(5, Math.min(60, parseInt(String(smtp_timeout)) || 15));
      await updateSetting('smtp_timeout', String(timeoutSec), tenantId);
    }
    if (amap_web_key !== undefined) {
      await updateSetting('amap_web_key', String(amap_web_key).trim(), tenantId);
    }
    if (pushplus_enabled !== undefined) {
      await updateSetting('pushplus_enabled', pushplus_enabled ? '1' : '0', tenantId);
    }
    if (wechat_push_channel !== undefined) {
      await updateSetting('wechat_push_channel', wechat_push_channel === 'pushplus' ? 'pushplus' : 'wxpusher', tenantId);
    }
    if (wxpusher_app_token !== undefined) {
      await updateSetting('wxpusher_app_token', String(wxpusher_app_token).trim(), tenantId);
    }
    if (wxpusher_uid !== undefined) {
      await updateSetting('wxpusher_uid', String(wxpusher_uid).trim(), tenantId);
    }
    if (wxpusher_topic_id !== undefined) {
      await updateSetting('wxpusher_topic_id', String(wxpusher_topic_id).trim(), tenantId);
    }
    if (pushplus_token !== undefined) {
      await updateSetting('pushplus_token', String(pushplus_token).trim(), tenantId);
    }
    if (pushplus_topic !== undefined) {
      await updateSetting('pushplus_topic', String(pushplus_topic).trim(), tenantId);
    }

    const updated = await getSettings(tenantId);
    return NextResponse.json({
      success: true,
      message: '配置保存成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '保存配置失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
