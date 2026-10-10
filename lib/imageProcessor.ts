import sharp from 'sharp';

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageOptimizationOptions {
  maxDimension?: number; // 最长边最大像素，默认 1200
  quality?: number; // WebP 压缩质量 (1-100)，默认 82
  format?: 'webp' | 'jpeg' | 'png';
  cropDish?: boolean; // 是否针对菜品进行构图优化
  cropBox?: CropBox; // 手动指定裁剪框坐标（由前端可视化裁剪器精确传入）
  cropRatio?: '4:3' | '16:9' | '1:1' | 'original' | 'auto'; // 目标构图比例
}

export interface ImageOptimizationResult {
  buffer: Buffer;
  originalSize: number;
  optimizedSize: number;
  originalWidth?: number;
  originalHeight?: number;
  width: number;
  height: number;
  format: string;
  savedBytes: number;
  savedPercentage: string;
  isOptimized: boolean;
  isCropped?: boolean;
  cropDetails?: {
    type: 'custom' | 'auto_4_3' | 'auto_16_9' | 'auto_1_1' | 'auto_safe' | 'none';
    ratio?: string;
  };
  mimeType: string;
}

/**
 * 智能图片压缩与菜品构图处理器
 * 1. 自动校正 EXIF 旋转；
 * 2. 支持前端裁剪框精确提取（所见即所得）；
 * 3. 智能构图保护菜品主体，杜绝盘子或碗被腰斩裁剪；
 * 4. 手机端极速加载的 WebP 无损/高保真压缩，大幅精简体积并提升打开速度。
 */
export async function optimizeImageBuffer(
  inputBuffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const maxDimension = options.maxDimension || 1200;
  const quality = Math.min(100, Math.max(10, options.quality || 82));
  const targetFormat = options.format || 'webp';
  const cropDish = options.cropDish ?? true;
  const cropBox = options.cropBox;
  const cropRatio = options.cropRatio || 'auto';

  const originalSize = inputBuffer.length;

  try {
    // 先根据 EXIF 旋转方向正向纠正图片，获取用户肉眼所见真实像素分辨率
    const orientedImage = sharp(inputBuffer, { failOn: 'none' }).rotate();
    const orientedBuffer = await orientedImage.toBuffer();
    const metadata = await sharp(orientedBuffer).metadata();

    const origWidth = metadata.width || 0;
    const origHeight = metadata.height || 0;

    let pipeline = sharp(orientedBuffer);
    let isCropped = false;
    let cropType: 'custom' | 'auto_4_3' | 'auto_16_9' | 'auto_1_1' | 'auto_safe' | 'none' = 'none';

    // 1. 如果客户端传入了精准的可视化裁剪选区
    if (
      cropBox &&
      cropBox.width > 10 &&
      cropBox.height > 10 &&
      origWidth > 0 &&
      origHeight > 0
    ) {
      const left = Math.max(0, Math.min(Math.round(cropBox.x), origWidth - 10));
      const top = Math.max(0, Math.min(Math.round(cropBox.y), origHeight - 10));
      const width = Math.min(Math.round(cropBox.width), origWidth - left);
      const height = Math.min(Math.round(cropBox.height), origHeight - top);

      if (width > 10 && height > 10) {
        pipeline = pipeline.extract({ left, top, width, height });
        isCropped = true;
        cropType = 'custom';
      }
    } else if (cropDish && origWidth > 0 && origHeight > 0 && cropRatio !== 'original') {
      // 2. 智能菜品构图处理（保护主体，避免切掉盘子或菜肴）
      const widthToHeight = origWidth / origHeight;

      if (cropRatio === '4:3') {
        // 目标为 4:3 餐饮点餐黄金横版比例
        if (widthToHeight > 1.35) {
          // 横向宽图（如 16:9 或全景），以高度为基准居中裁剪两侧多余留白
          const targetW = Math.round((origHeight * 4) / 3);
          const left = Math.round((origWidth - targetW) / 2);
          pipeline = pipeline.extract({ left, top: 0, width: targetW, height: origHeight });
          isCropped = true;
          cropType = 'auto_4_3';
        } else if (widthToHeight >= 1.0) {
          // 接近方形的横图，以宽度为基准居中微调上下
          const targetH = Math.round((origWidth * 3) / 4);
          const top = Math.round((origHeight - targetH) / 2);
          pipeline = pipeline.extract({ left: 0, top, width: origWidth, height: targetH });
          isCropped = true;
          cropType = 'auto_4_3';
        } else {
          // 竖版照片如果强行切 4:3 会腰斩菜品，因此竖图转为 1:1 或居中安全肖像，绝不切断盘子
          const targetW = origWidth;
          const targetH = Math.min(origHeight, Math.round(origWidth * 1.0)); // 保护主体
          const top = Math.round((origHeight - targetH) * 0.52); // 餐桌菜品通常位于中心偏下 52%
          pipeline = pipeline.extract({ left: 0, top, width: targetW, height: targetH });
          isCropped = true;
          cropType = 'auto_1_1';
        }
      } else if (cropRatio === '1:1') {
        // 目标为 1:1 正方形
        if (widthToHeight > 1.0) {
          const targetW = origHeight;
          const left = Math.round((origWidth - targetW) / 2);
          pipeline = pipeline.extract({ left, top: 0, width: targetW, height: origHeight });
          isCropped = true;
          cropType = 'auto_1_1';
        } else if (widthToHeight < 1.0) {
          const targetH = origWidth;
          const top = Math.round((origHeight - targetH) * 0.52); // 居中偏下安全聚焦
          pipeline = pipeline.extract({ left: 0, top, width: origWidth, height: targetH });
          isCropped = true;
          cropType = 'auto_1_1';
        }
      } else if (cropRatio === '16:9') {
        // 目标为 16:9
        if (widthToHeight > 16 / 9) {
          const targetW = Math.round((origHeight * 16) / 9);
          const left = Math.round((origWidth - targetW) / 2);
          pipeline = pipeline.extract({ left, top: 0, width: targetW, height: origHeight });
          isCropped = true;
          cropType = 'auto_16_9';
        } else if (widthToHeight >= 1.0) {
          const targetH = Math.round((origWidth * 9) / 16);
          const top = Math.round((origHeight - targetH) / 2);
          pipeline = pipeline.extract({ left: 0, top, width: origWidth, height: targetH });
          isCropped = true;
          cropType = 'auto_16_9';
        }
      } else {
        // cropRatio === 'auto'
        // 自动安全构图：
        // a. 横版照片 (width >= height): 用户手持横拍通常构图良好，完整保留其画幅！
        // b. 极度细长横图 (width/height > 2.0): 适当居中收拢到 16:9 避免过扁；
        // c. 超长手机竖图 (height/width > 1.6): 居中收拢上下大面积空桌天花板，保留充裕的 3:4 比例，确保 100% 涵盖整个盘碟与美味佳肴！
        if (widthToHeight > 2.1) {
          const targetW = Math.round((origHeight * 16) / 9);
          const left = Math.round((origWidth - targetW) / 2);
          pipeline = pipeline.extract({ left, top: 0, width: targetW, height: origHeight });
          isCropped = true;
          cropType = 'auto_safe';
        } else if (widthToHeight < 0.65) {
          // 极度细长的手机竖拍（如 9:16），上下裁剪多余桌面，保留 3:4 充裕黄金菜品主体
          const targetH = Math.round((origWidth * 4) / 3);
          const top = Math.round((origHeight - targetH) * 0.52);
          pipeline = pipeline.extract({ left: 0, top, width: origWidth, height: targetH });
          isCropped = true;
          cropType = 'auto_safe';
        }
        // 普通 4:3, 16:9, 3:2, 1:1, 3:4 照片自动保留完整全貌，绝不切断！
      }
    }

    // 3. 尺寸缩放：最长边不超过 maxDimension，按比例等比缩放
    pipeline = pipeline.resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    });

    let outputBuffer: Buffer;
    let mimeType = 'image/webp';

    if (targetFormat === 'webp') {
      outputBuffer = await pipeline
        .webp({
          quality,
          effort: 4, // 兼顾极速处理与高压缩率
        })
        .toBuffer();
      mimeType = 'image/webp';
    } else if (targetFormat === 'jpeg') {
      outputBuffer = await pipeline
        .jpeg({
          quality,
          mozjpeg: true,
        })
        .toBuffer();
      mimeType = 'image/jpeg';
    } else {
      outputBuffer = await pipeline.png({ quality }).toBuffer();
      mimeType = 'image/png';
    }

    const optimizedSize = outputBuffer.length;
    const savedBytes = Math.max(0, originalSize - optimizedSize);
    const savedPercentage =
      originalSize > 0
        ? `${((savedBytes / originalSize) * 100).toFixed(1)}%`
        : '0%';

    // 获取压缩处理后的真实分辨率
    const finalMeta = await sharp(outputBuffer).metadata();

    return {
      buffer: Buffer.from(outputBuffer),
      originalSize,
      optimizedSize,
      originalWidth: origWidth,
      originalHeight: origHeight,
      width: finalMeta.width || origWidth,
      height: finalMeta.height || origHeight,
      format: targetFormat,
      savedBytes,
      savedPercentage,
      isOptimized: true,
      isCropped,
      cropDetails: {
        type: cropType,
        ratio: cropRatio,
      },
      mimeType,
    };
  } catch (err) {
    console.warn('[Image Optimization Warning] Fallback to raw buffer:', err);
    return {
      buffer: inputBuffer,
      originalSize,
      optimizedSize: originalSize,
      width: 0,
      height: 0,
      format: 'raw',
      savedBytes: 0,
      savedPercentage: '0.0%',
      isOptimized: false,
      mimeType: 'image/jpeg',
    };
  }
}
