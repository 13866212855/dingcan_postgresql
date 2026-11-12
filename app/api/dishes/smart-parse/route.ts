import { NextRequest, NextResponse } from 'next/server';
import { parseDishListTextWithAI, generateDishImageWithAI } from '@/lib/llm';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';


export const dynamic = 'force-dynamic';

/**
 * 智能批量添加菜品的服务端大脑（需管理员登录会话）：
 * - action=parse          大模型解析自由文本 → 结构化菜品数组（失败自动降级本地正则解析）
 * - action=generate_image 按菜名大模型生成配图 → 智能压缩 → 转存 Cloudinary 永久直链
 */
export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'dishes.batch_ai');
  if (!auth.ok) return auth.response;
  try {

    const body = await req.json();
    const tenantId = body.tenantId || getTenantIdFromRequest(req);
    const { action } = body;

    if (action === 'parse') {
      const text = String(body.text || '').trim();
      if (!text) {
        return NextResponse.json(
          { success: false, error: '请先粘贴或输入菜品清单文本（每行一道菜，如：烤鸭腿6元）' },
          { status: 400 }
        );
      }

      const existingCategories: string[] | undefined = Array.isArray(body.existingCategories)
        ? body.existingCategories.map((c: any) => String(c).trim()).filter(Boolean)
        : undefined;

      const result = await parseDishListTextWithAI({ text, tenantId, existingCategories });
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || '解析失败' }, { status: 400 });
      }
      return NextResponse.json({ success: true, source: result.source, data: result.data });
    }

    if (action === 'generate_image') {
      const dishName = String(body.dishName || '').trim();
      if (!dishName) {
        return NextResponse.json(
          { success: false, error: '缺少菜品名称，无法生成配图' },
          { status: 400 }
        );
      }
      const result = await generateDishImageWithAI({ dishName, tenantId });
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || '配图生成失败' }, { status: 500 });
      }
      return NextResponse.json({ success: true, url: result.url, publicId: result.publicId });
    }

    return NextResponse.json({ success: false, error: '未知的智能添加操作类型' }, { status: 400 });
  } catch (error: any) {
    console.error('[Smart Dish Parse Route Error]', error);
    return NextResponse.json(
      { success: false, error: '智能处理失败: ' + (error?.message || '网络连接超时') },
      { status: 500 }
    );
  }
}
