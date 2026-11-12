import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig, DEFAULT_LLM_CONFIG } from '@/lib/llm';
import { updateSetting, getSettings } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// 安全收紧（2026-11-11）：大模型配置（含 api_key）读写必须持管理员会话——此前任何公网请求均可
export async function GET(req: NextRequest) {
  const auth = await requirePerm(req, 'llm.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const config = await getLLMConfig(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        defaultConfig: DEFAULT_LLM_CONFIG,
      },
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '获取大模型配置失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'llm.manage');
  if (!auth.ok) return auth.response;
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();

    const {
      baseUrl,
      apiKey,
      textModel,
      imageModel,
      autoProcessImages,
      maxDimension,
      quality,
      resetToDefault,
    } = body;

    if (resetToDefault) {
      await updateSetting('llm_base_url', DEFAULT_LLM_CONFIG.baseUrl, tenantId);
      await updateSetting('llm_api_key', DEFAULT_LLM_CONFIG.apiKey, tenantId);
      await updateSetting('llm_text_model', DEFAULT_LLM_CONFIG.textModel, tenantId);
      await updateSetting('llm_image_model', DEFAULT_LLM_CONFIG.imageModel, tenantId);
      await updateSetting('llm_auto_process_images', '1', tenantId);
      await updateSetting('llm_max_image_dimension', '1200', tenantId);
      await updateSetting('llm_image_quality', '82', tenantId);

      const refreshed = await getLLMConfig(tenantId);
      return NextResponse.json({
        success: true,
        message: '已成功恢复大模型默认推荐配置 (Agnes AI)',
        data: refreshed,
      });
    }

    if (baseUrl !== undefined) {
      await updateSetting('llm_base_url', String(baseUrl).trim(), tenantId);
    }
    if (apiKey !== undefined) {
      await updateSetting('llm_api_key', String(apiKey).trim(), tenantId);
    }
    if (textModel !== undefined) {
      await updateSetting('llm_text_model', String(textModel).trim(), tenantId);
    }
    if (imageModel !== undefined) {
      await updateSetting('llm_image_model', String(imageModel).trim(), tenantId);
    }
    if (autoProcessImages !== undefined) {
      await updateSetting('llm_auto_process_images', autoProcessImages ? '1' : '0', tenantId);
    }
    if (maxDimension !== undefined) {
      const dim = parseInt(String(maxDimension)) || 1200;
      await updateSetting('llm_max_image_dimension', String(dim), tenantId);
    }
    if (quality !== undefined) {
      const q = Math.min(100, Math.max(10, parseInt(String(quality)) || 82));
      await updateSetting('llm_image_quality', String(q), tenantId);
    }

    const updated = await getLLMConfig(tenantId);
    return NextResponse.json({
      success: true,
      message: '大模型大脑配置已成功保存！',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '保存大模型配置失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
