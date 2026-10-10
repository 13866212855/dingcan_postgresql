import { getSettings } from '@/lib/db';
import type { LLMConfig } from '@/types';

const cleanEnv = (val?: string) => val ? val.replace(/^["']|["']$/g, '').trim() : undefined;
const cleanEnvNum = (val: string | undefined, fallback: number) => {
  if (!val) return fallback;
  const n = parseInt(val.replace(/^["']|["']$/g, '').trim(), 10);
  return isNaN(n) ? fallback : n;
};

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  baseUrl: cleanEnv(process.env.LLM_BASE_URL) || 'https://apihub.agnes-ai.com/v1',
  apiKey: cleanEnv(process.env.LLM_API_KEY) || 'sk-vWM7RHG5n7bljBNi3GgHfygxqiKlUYrPWZLLSUByIGm4BiM9',
  textModel: (cleanEnv(process.env.LLM_TEXT_MODEL) || 'agnes-2.5-flash').toLowerCase(),
  imageModel: (cleanEnv(process.env.LLM_IMAGE_MODEL) || 'agnes-image-2.1-flash').toLowerCase(),
  autoProcessImages: process.env.LLM_AUTO_PROCESS_IMAGES !== undefined ? cleanEnv(process.env.LLM_AUTO_PROCESS_IMAGES) !== '0' : true,
  maxDimension: cleanEnvNum(process.env.LLM_MAX_IMAGE_DIMENSION, 1200),
  quality: cleanEnvNum(process.env.LLM_IMAGE_QUALITY, 82),
};

export type { LLMConfig };

/**
 * 获取当前商户或默认的大模型大脑配置
 */
export async function getLLMConfig(tenantId = 'default'): Promise<LLMConfig> {
  try {
    const settings = await getSettings(tenantId);
    return {
      baseUrl: (settings.llm_base_url || DEFAULT_LLM_CONFIG.baseUrl).replace(/\/+$/, ''),
      apiKey: (settings.llm_api_key || DEFAULT_LLM_CONFIG.apiKey).trim(),
      textModel: (settings.llm_text_model || DEFAULT_LLM_CONFIG.textModel).trim(),
      imageModel: (settings.llm_image_model || DEFAULT_LLM_CONFIG.imageModel).trim(),
      autoProcessImages: settings.llm_auto_process_images !== 0,
      maxDimension: settings.llm_max_image_dimension || 1200,
      quality: settings.llm_image_quality || 82,
    };
  } catch (err) {
    console.warn('[LLM] Failed to read settings from db, using defaults:', err);
    return {
      baseUrl: DEFAULT_LLM_CONFIG.baseUrl,
      apiKey: DEFAULT_LLM_CONFIG.apiKey,
      textModel: DEFAULT_LLM_CONFIG.textModel,
      imageModel: DEFAULT_LLM_CONFIG.imageModel,
      autoProcessImages: true,
      maxDimension: 1200,
      quality: 82,
    };
  }
}

/**
 * 智能模型重试器：
 * 部分服务网关在不同版本下对大小写敏感（例如 Agnes-2.5-flash vs agnes-2.5-flash），
 * 若首选模型返回 model_not_found，自动回退转为全小写重试，提高容错率。
 */
async function callOpenAICompatibleEndpoint(
  url: string,
  apiKey: string,
  payload: any,
  timeoutMs = 35000
): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const rawText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: rawText };
    }

    return { ok: res.ok, status: res.status, data, rawText };
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * 测试文本大模型连接与对话能力
 */
export async function testTextModelConnection(
  configOverride?: Partial<LLMConfig>,
  testPrompt?: string
) {
  const baseConfig = await getLLMConfig();
  const config: LLMConfig = {
    baseUrl: (configOverride?.baseUrl?.trim() || baseConfig.baseUrl || DEFAULT_LLM_CONFIG.baseUrl).replace(/\/+$/, ''),
    apiKey: configOverride?.apiKey?.trim() || baseConfig.apiKey || DEFAULT_LLM_CONFIG.apiKey,
    textModel: configOverride?.textModel?.trim() || baseConfig.textModel || DEFAULT_LLM_CONFIG.textModel,
    imageModel: configOverride?.imageModel?.trim() || baseConfig.imageModel || DEFAULT_LLM_CONFIG.imageModel,
  };

  const prompt =
    testPrompt ||
    '请回复【大模型连接测试成功】，并用一句话介绍你作为点餐系统智能大脑的核心能力（如智能优化菜品图片、编写美味介绍等）。';

  const startTime = Date.now();
  const endpoint = `${config.baseUrl}/chat/completions`;

  // 尝试首次请求
  let modelToTry = config.textModel;
  let result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
    model: modelToTry,
    messages: [
      {
        role: 'system',
        content: '你是一个精通餐饮美食与数字化点餐的智能AI大脑助手，语言简练生动、温暖专业。',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  // 如果遇到模型名称大小写不匹配，自动尝试全小写重试
  if (!result.ok && result.data?.error?.code === 'model_not_found') {
    const lowercaseModel = modelToTry.toLowerCase();
    if (lowercaseModel !== modelToTry) {
      modelToTry = lowercaseModel;
      result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
        model: modelToTry,
        messages: [
          {
            role: 'system',
            content: '你是一个精通餐饮美食与数字化点餐的智能AI大脑助手，语言简练生动、温暖专业。',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });
    }
  }

  const durationMs = Date.now() - startTime;

  if (!result.ok) {
    const errorMsg =
      result.data?.error?.message ||
      result.data?.message ||
      `HTTP ${result.status}: ${result.rawText.slice(0, 200)}`;
    return {
      success: false,
      durationMs,
      error: `连接失败: ${errorMsg}`,
      status: result.status,
      modelUsed: modelToTry,
    };
  }

  const choice = result.data?.choices?.[0];
  const replyContent =
    choice?.message?.content ||
    choice?.message?.reasoning_content ||
    '（未返回可见文本回复）';

  return {
    success: true,
    durationMs,
    modelUsed: modelToTry,
    reply: replyContent.trim(),
    usage: result.data?.usage || null,
    rawResult: result.data,
  };
}

/**
 * 测试图片大模型生成能力
 */
export async function testImageModelConnection(
  configOverride?: Partial<LLMConfig>,
  testPrompt?: string
) {
  const baseConfig = await getLLMConfig();
  const config: LLMConfig = {
    baseUrl: (configOverride?.baseUrl?.trim() || baseConfig.baseUrl || DEFAULT_LLM_CONFIG.baseUrl).replace(/\/+$/, ''),
    apiKey: configOverride?.apiKey?.trim() || baseConfig.apiKey || DEFAULT_LLM_CONFIG.apiKey,
    textModel: configOverride?.textModel?.trim() || baseConfig.textModel || DEFAULT_LLM_CONFIG.textModel,
    imageModel: configOverride?.imageModel?.trim() || baseConfig.imageModel || DEFAULT_LLM_CONFIG.imageModel,
  };

  const prompt = testPrompt || '一盘色香味俱全的精品中式菜肴，精美摆盘，餐厅特写摄影，自然光泽诱人';

  const startTime = Date.now();
  const endpoint = `${config.baseUrl}/images/generations`;

  let modelToTry = config.imageModel;
  let result = await callOpenAICompatibleEndpoint(
    endpoint,
    config.apiKey,
    {
      model: modelToTry,
      prompt,
      n: 1,
      size: '512x512',
    },
    60000 // 绘画生成给予充裕超时
  );

  // 大小写回退
  if (!result.ok && result.data?.error?.code === 'model_not_found') {
    const lowercaseModel = modelToTry.toLowerCase();
    if (lowercaseModel !== modelToTry) {
      modelToTry = lowercaseModel;
      result = await callOpenAICompatibleEndpoint(
        endpoint,
        config.apiKey,
        {
          model: modelToTry,
          prompt,
          n: 1,
          size: '512x512',
        },
        60000
      );
    }
  }

  const durationMs = Date.now() - startTime;

  if (!result.ok) {
    const errorMsg =
      result.data?.error?.message ||
      result.data?.message ||
      `HTTP ${result.status}: ${result.rawText.slice(0, 200)}`;
    return {
      success: false,
      durationMs,
      error: `图片模型生成失败: ${errorMsg}`,
      status: result.status,
      modelUsed: modelToTry,
    };
  }

  const imageUrl = result.data?.data?.[0]?.url || result.data?.data?.[0]?.b64_json;

  return {
    success: true,
    durationMs,
    modelUsed: modelToTry,
    imageUrl: imageUrl || '',
    rawResult: result.data,
  };
}

/**
 * 调用视觉大模型多模态能力分析上传的菜品图片：
 * 识别菜品、推荐菜名、单价估算、匹配分类、撰写美食简介、建议口味标签及色泽评价
 */
export async function analyzeDishImageWithAI(params: {
  imageUrl?: string;
  imageBase64?: string;
  tenantId?: string;
  dishNameHint?: string;
  existingCategories?: string[];
}) {
  const config = await getLLMConfig(params.tenantId);
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  let finalImageUrl = '';
  // 优先使用传入的 base64 构造 Data URI，避免大模型服务器访问外部云存储时发生网络阻断或 500 连接重置
  if (params.imageBase64) {
    finalImageUrl = params.imageBase64.startsWith('data:')
      ? params.imageBase64
      : `data:image/webp;base64,${params.imageBase64}`;
  } else if (params.imageUrl) {
    if (params.imageUrl.startsWith('data:')) {
      finalImageUrl = params.imageUrl;
    } else if (params.imageUrl.startsWith('http://') || params.imageUrl.startsWith('https://')) {
      // 若只提供了网络 URL（如 Cloudinary 等），由本地服务器下载并转为 Data URI，规避上游模型服务器网络限制
      try {
        const fetchRes = await fetch(params.imageUrl);
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          const buf = Buffer.from(ab);
          const mime = fetchRes.headers.get('content-type') || 'image/jpeg';
          finalImageUrl = `data:${mime};base64,${buf.toString('base64')}`;
        } else {
          finalImageUrl = params.imageUrl;
        }
      } catch {
        finalImageUrl = params.imageUrl;
      }
    } else {
      finalImageUrl = params.imageUrl;
    }
  }

  if (!finalImageUrl) {
    throw new Error('未提供可识别的菜品图片 URL 或 Base64 数据');
  }

  const categoryInstruction =
    params.existingCategories && params.existingCategories.length > 0
      ? `餐厅当前现有分类为：【${params.existingCategories.join('、')}】。请务必优先从中选出最贴合的一个填入 category_suggestion。若确实都不匹配才填入新分类。`
      : '适合的菜品分类（例如：特色热炒、经典主食、养生靓汤、开胃凉菜、酒水饮料）';

  const promptText = `
你是一位资深中华美食评论家与数字点餐系统菜品策划专家。
请仔细观察并识别用户上传的这道菜品照片${params.dishNameHint ? `（商家参考菜名为：“${params.dishNameHint}”）` : ''}。
${categoryInstruction}

请严格输出 JSON 格式（不要包含任何其它多余文本），字段规范如下：
{
  "dish_name_suggestion": "最贴切地道的美食菜品名称（如：秘制红烧肉、水煮牛肉、越式牛肉河粉、鲜虾拉面、农家小炒肉等，禁止空泛或留空）",
  "price": 38,
  "category_suggestion": "最贴合的分类名称",
  "appetizing_description": "一段60-110字、令人食欲大开的专业级美食介绍，生动描述色泽、精选食材、烹饪火候、香气与口感层次，适合直接用于点餐页面吸引顾客下单",
  "taste_tags": ["口味标签1", "口味标签2"],
  "spicy_level": "不辣 或 微辣 或 中辣 或 特辣",
  "visual_evaluation": "对此照片在手机点餐界面展示效果的客观评价（30字内）"
}
注意：
1. "price" 必须为大于0的正整数数字（如 18、28、38、48、58 等合理单价，纯数字，不要带货币符号）。
2. "dish_name_suggestion" 必须具体、生动且具商业吸引力，绝不要留空或返回 null。
3. "appetizing_description" 必须语言优美、令人垂涎。
`.trim();

  let modelToTry = (config.textModel || 'agnes-2.5-flash').toLowerCase();
  let result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
    model: modelToTry,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          {
            type: 'image_url',
            image_url: { url: finalImageUrl },
          },
        ],
      },
    ],
    max_tokens: 1200,
    temperature: 0.3,
  });

  if (!result.ok && result.data?.error?.code === 'model_not_found') {
    modelToTry = modelToTry.toLowerCase();
    result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
      model: modelToTry,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            {
              type: 'image_url',
              image_url: { url: finalImageUrl },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    });
  }

  if (!result.ok) {
    throw new Error(result.data?.error?.message || '大模型视觉识别服务响应失败');
  }

  const choice = result.data?.choices?.[0];
  const content = choice?.message?.content || choice?.message?.reasoning_content || '';

  // 尝试提取 JSON（支持 markdown 块与纯 JSON 括号）
  let jsonString = '';
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  } else {
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonString = braceMatch[0].trim();
    }
  }

  if (jsonString) {
    try {
      const parsed = JSON.parse(jsonString);

      // 规范化单价
      let parsedPrice = 38;
      if (typeof parsed.price === 'number' && parsed.price > 0) {
        parsedPrice = Math.round(parsed.price);
      } else if (parsed.price) {
        const num = parseInt(String(parsed.price).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0) parsedPrice = num;
      } else if (parsed.recommended_price) {
        const num = parseInt(String(parsed.recommended_price).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > 0) parsedPrice = num;
      }

      return {
        success: true,
        data: {
          dish_name_suggestion: parsed.dish_name_suggestion || params.dishNameHint || '招牌特色美味',
          price: parsedPrice,
          recommended_price: parsedPrice,
          category_suggestion: parsed.category_suggestion || '特色热炒',
          appetizing_description: parsed.appetizing_description || '精选优质新鲜食材，现点现烹，风味纯正浓郁。',
          taste_tags: Array.isArray(parsed.taste_tags) ? parsed.taste_tags : ['现点现做', '鲜香可口'],
          spicy_level: parsed.spicy_level || '微辣',
          visual_evaluation: parsed.visual_evaluation || '菜品色泽鲜亮，适合在手机端作为主打菜展示。',
        },
        modelUsed: modelToTry,
      };
    } catch {
      // 容错降级
    }
  }

  return {
    success: true,
    data: {
      dish_name_suggestion: params.dishNameHint || '招牌特色风味',
      price: 36,
      recommended_price: 36,
      category_suggestion: '特色热炒',
      appetizing_description: content.slice(0, 150) || '精选优质食材，现点现炒，风味纯正。',
      taste_tags: ['鲜香美味', '现点现做'],
      spicy_level: '微辣',
      visual_evaluation: '菜品色泽鲜亮，适合作为推荐菜展示。',
    },
    modelUsed: modelToTry,
  };
}

/**
 * 纯文本大模型生成菜品宣传文案与诱人描述
 */
export async function generateDishDescriptionWithAI(params: {
  dishName: string;
  category?: string;
  currentDescription?: string;
  tenantId?: string;
}) {
  const config = await getLLMConfig(params.tenantId);
  const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const prompt = `
请为点餐系统中的菜品【${params.dishName}】（所属分类：${params.category || '精选菜肴'}）撰写一段能够激发顾客食欲的诱人介绍。
${params.currentDescription ? `原描述：“${params.currentDescription}”，请在此基础上进行语言润色与升华。` : ''}
要求：
1. 字数在 40~80 字之间，语言生动形象，令人食指大动；
2. 突出食材新鲜、烹饪手法、口感层次；
3. 输出格式直接给出简介正文，不要输出其他前缀。
`.trim();

  let modelToTry = config.textModel;
  let result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
    model: modelToTry,
    messages: [
      {
        role: 'system',
        content: '你是一个精通美食文案与餐饮营销的文案大师，擅长用最撩人食欲的文字打动顾客。',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  if (!result.ok && result.data?.error?.code === 'model_not_found') {
    modelToTry = modelToTry.toLowerCase();
    result = await callOpenAICompatibleEndpoint(endpoint, config.apiKey, {
      model: modelToTry,
      messages: [
        {
          role: 'system',
          content: '你是一个精通美食文案与餐饮营销的文案大师，擅长用最撩人食欲的文字打动顾客。',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
  }

  if (!result.ok) {
    throw new Error(result.data?.error?.message || '大模型生成文案失败');
  }

  const choice = result.data?.choices?.[0];
  const generatedText = (choice?.message?.content || choice?.message?.reasoning_content || '').trim();

  return {
    success: true,
    description: generatedText.replace(/^["'“]|["'”]$/g, '').trim(),
    modelUsed: modelToTry,
  };
}
