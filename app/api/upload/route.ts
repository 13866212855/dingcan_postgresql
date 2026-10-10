import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { optimizeImageBuffer } from '@/lib/imageProcessor';
import { getLLMConfig, analyzeDishImageWithAI } from '@/lib/llm';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '未找到上传的文件，请选择图片文件' }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type || '';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: '请上传有效的图片格式文件 (JPG, PNG, WEBP, GIF)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    // Get tenant and active LLM configuration
    const reqTenant = (formData.get('tenant') as string) || getTenantIdFromRequest(req);
    const llmConfig = await getLLMConfig(reqTenant);

    // Map upload category to Cloudinary folders
    const uploadType = (formData.get('type') as string) || 'dish';
    let targetFolder = 'restaurant_dishes';
    if (uploadType === 'qr') {
      targetFolder = 'restaurant_qrcodes';
    } else if (uploadType === 'logo') {
      targetFolder = 'restaurant_logos';
    }

    // 智能图像处理：若大模型智能处理开启（默认开启），自动对过大图片进行手机端自适应尺寸裁剪和 WebP 无损压缩
    let uploadBuffer = rawBuffer;
    let optimizationInfo: any = null;
    let targetFilename = file.name;

    const shouldOptimize =
      formData.get('optimize') !== '0' && llmConfig.autoProcessImages;

    // 解析前端传入的可视化裁剪选区及构图比例
    const cropX = formData.get('crop_x') ? Number(formData.get('crop_x')) : undefined;
    const cropY = formData.get('crop_y') ? Number(formData.get('crop_y')) : undefined;
    const cropW = formData.get('crop_width') ? Number(formData.get('crop_width')) : undefined;
    const cropH = formData.get('crop_height') ? Number(formData.get('crop_height')) : undefined;
    const cropRatio = (formData.get('crop_ratio') as any) || 'auto';

    const customCropBox =
      cropW && cropH && cropW > 10 && cropH > 10
        ? {
            x: Math.max(0, cropX ?? 0),
            y: Math.max(0, cropY ?? 0),
            width: cropW,
            height: cropH,
          }
        : undefined;

    if (shouldOptimize) {
      try {
        const optResult = await optimizeImageBuffer(rawBuffer, {
          maxDimension: llmConfig.maxDimension || 1200,
          quality: llmConfig.quality || 82,
          format: 'webp',
          cropDish: uploadType === 'dish',
          cropBox: customCropBox,
          cropRatio: cropRatio,
        });

        if (optResult.isOptimized) {
          uploadBuffer = Buffer.from(optResult.buffer);
          targetFilename = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          optimizationInfo = {
            original_size: optResult.originalSize,
            optimized_size: optResult.optimizedSize,
            saved_bytes: optResult.savedBytes,
            saved_percentage: optResult.savedPercentage,
            width: optResult.width,
            height: optResult.height,
            format: optResult.format,
            is_optimized: true,
            is_cropped: optResult.isCropped,
            crop_details: optResult.cropDetails,
          };
        }
      } catch (optErr) {
        console.warn('[Upload Image Optimization Warning]', optErr);
      }
    }

    // Upload to Cloudinary
    const uploadResult = await uploadToCloudinary(uploadBuffer, targetFolder, targetFilename);

    // 如果客户端显式请求 AI 视觉智能分析（如上传菜品时自动识别并写简介）
    let aiAnalysis: any = null;
    let aiError: string | null = null;
    if (formData.get('ai_analyze') === '1') {
      try {
        const hintName = (formData.get('dish_name_hint') as string) || '';
        const existingCatsRaw = (formData.get('existing_categories') as string) || '';
        const existingCategories = existingCatsRaw
          ? existingCatsRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

        const aiRes = await analyzeDishImageWithAI({
          imageUrl: uploadResult?.secure_url,
          imageBase64: uploadBuffer.toString('base64'),
          tenantId: reqTenant,
          dishNameHint: hintName,
          existingCategories,
        });
        if (aiRes.success) {
          aiAnalysis = aiRes.data;
        } else {
          aiError = '大模型未返回有效分析结果';
        }
      } catch (aiErr: any) {
        aiError = aiErr?.message || '大模型视觉识别服务响应异常';
        console.warn('[AI Vision Analysis Warning]', aiErr);
      }
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      provider: 'cloudinary',
      optimization: optimizationInfo,
      ai_analysis: aiAnalysis,
      ai_error: aiError,
      message: optimizationInfo?.is_optimized
        ? `图片已成功经 AI 智能优化（体积精简 ${optimizationInfo.saved_percentage}），更适合手机端极速加载`
        : '图片已成功上传至云端存储',
    });
  } catch (error: any) {
    console.error('Cloudinary API upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '上传至云存储失败: ' + (error?.message || '网络异常'),
      },
      { status: 500 }
    );
  }
}
