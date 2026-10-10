import { NextRequest, NextResponse } from 'next/server';
import { analyzeDishImageWithAI, generateDishDescriptionWithAI } from '@/lib/llm';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || getTenantIdFromRequest(req);
    const { action, imageUrl, imageBase64, dishName, category, currentDescription, existingCategories } = body;

    if (action === 'analyze_image') {
      if (!imageUrl && !imageBase64) {
        return NextResponse.json(
          { success: false, error: '请先提供或上传一张菜品图片' },
          { status: 400 }
        );
      }
      const result = await analyzeDishImageWithAI({
        imageUrl,
        imageBase64,
        tenantId,
        dishNameHint: dishName,
        existingCategories,
      });
      return NextResponse.json(result);
    }

    if (action === 'generate_text') {
      if (!dishName || !dishName.trim()) {
        return NextResponse.json(
          { success: false, error: '请先输入菜品名称，以便AI大模型撰写专属文案' },
          { status: 400 }
        );
      }
      const result = await generateDishDescriptionWithAI({
        dishName: dishName.trim(),
        category,
        currentDescription,
        tenantId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: '未知的 AI 操作类型' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Dish AI Route Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: '大模型处理失败: ' + (error?.message || '网络连接超时'),
      },
      { status: 500 }
    );
  }
}
