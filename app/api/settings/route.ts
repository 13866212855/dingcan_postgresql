import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSetting } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const settings = await getSettings(tenantId);
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
