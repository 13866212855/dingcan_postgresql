import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 本地图片存储（大陆环境首选方案）：
 * 图片写入项目 public/uploads/<folder>/ 目录，以同域 /uploads/<folder>/<file> 直链对外展示。
 * - 展示层无需外网可达性（彻底规避 Unsplash/Cloudinary 大陆不可达导致的裂图）
 * - redeploy.bat 将宿主 public/uploads 挂载进容器，运行时上传与重建镜像互不丢失
 * - 文件同时存在于构建上下文中，git 提交后随镜像构建带到公网部署环境
 */
export interface LocalImageSaveResult {
  url: string; // 同域直链，如 /uploads/restaurant_dishes/172xxx_img_ab12cd34.webp
  publicId: string; // 相对 public/uploads 的逻辑ID，如 restaurant_dishes/172xxx_img_ab12cd34
}

export function saveImageToPublicUploads(
  buffer: Buffer,
  folder: string = 'restaurant_dishes',
  originalName: string = 'img',
  ext?: string
): LocalImageSaveResult {
  const safeFolder = (folder || 'misc').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'misc';
  const base =
    originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40) || 'img';
  const finalExt = ((ext || path.extname(originalName).replace('.', '') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg').slice(0, 5);
  const publicId = `${safeFolder}/${Date.now()}_${base}_${crypto.randomBytes(3).toString('hex')}`;

  const dir = path.join(process.cwd(), 'public', 'uploads', safeFolder);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${publicId.split('/')[1]}.${finalExt}`);
  fs.writeFileSync(filePath, buffer);

  return { url: `/uploads/${publicId}.${finalExt}`, publicId };
}
