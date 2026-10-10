import { NextRequest, NextResponse } from 'next/server';
import { testTextModelConnection, testImageModelConnection } from '@/lib/llm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, baseUrl, apiKey, textModel, imageModel, prompt } = body;

    if (type === 'image') {
      const result = await testImageModelConnection(
        {
          baseUrl,
          apiKey,
          imageModel,
        },
        prompt
      );
      return NextResponse.json(result);
    }

    // 默认测试文本模型
    const result = await testTextModelConnection(
      {
        baseUrl,
        apiKey,
        textModel,
      },
      prompt
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[LLM Test Route Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: '测试大模型发生异常: ' + (error?.message || '网络连接超时'),
        stack: error?.stack,
      },
      { status: 500 }
    );
  }
}
