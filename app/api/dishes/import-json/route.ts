import { NextRequest, NextResponse } from 'next/server';
import { promises as fsPromises } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createDishesBatch } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';
import { requirePerm } from '@/lib/authz';

import { saveImageToPublicUploads } from '@/lib/localImageStore';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 30 * 1024 * 1024; // 含图片内嵌的 JSON 体积上限
const MAX_DISHES = 500;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 单张内嵌图片解码后上限
const MAX_EMBEDDED_IMAGES = 200;
const DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

/**
 * 校验 /uploads/ 相对路径合法（防路径穿越），返回 public/uploads 内绝对路径或 null
 */
function resolveLocalUploadPath(imagePath: string): string | null {
  if (!imagePath.startsWith('/uploads/') || imagePath.includes('..')) return null;
  const root = path.resolve(process.cwd(), 'public', 'uploads');
  const resolved = path.resolve(root, imagePath.replace(/^\/uploads\//, ''));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function md5(buf: Buffer): string {
  return crypto.createHash('md5').update(buf).digest('hex');
}

/**
 * POST 导入菜品 JSON（由本系统导出格式生成）：
 * - 目标租户取自请求参数（绝不信任 JSON 内的 source_tenant 字段）
 * - 同名菜品自动跳过（btrim 口径，与拉取总店/智能批量一致）；事务原子，失败整体回滚
 * - images 段（可选，键=导出时的 /uploads 路径，值=base64 dataURL）：
 *   解码后落地为本店 /uploads 本地图片并改写引用；若目标已存在同路径且内容一致则复用原路径（幂等，重复导入不产生冗余文件）
 * - 外部 http(s) 图链原样保留并计数返回（前端已提示裂图风险）
 */
export async function POST(req: NextRequest) {
  const auth = await requirePerm(req, 'dishes.export_import');
  if (!auth.ok) return auth.response;
  try {
        const tenantId = getTenantIdFromRequest(req);

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: '文件体积超过 30MB 上限（可尝试不勾选「包含图片」重新导出）' },
        { status: 413 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: '请求体不是合法 JSON' }, { status: 400 });
    }

    const rawDishes = Array.isArray(body?.dishes) ? body.dishes : null;
    if (!rawDishes) {
      return NextResponse.json(
        { success: false, error: '文件缺少 dishes 数组，不是本系统导出的菜品文件' },
        { status: 400 }
      );
    }
    if (rawDishes.length === 0) {
      return NextResponse.json({ success: false, error: '文件中没有菜品数据' }, { status: 400 });
    }
    if (rawDishes.length > MAX_DISHES) {
      return NextResponse.json(
        { success: false, error: `单次最多导入 ${MAX_DISHES} 道菜品（文件含 ${rawDishes.length} 道）` },
        { status: 400 }
      );
    }

    // 内嵌图片落地：原路径 → 本店新路径 的改写表
    const pathRewrite: Record<string, string> = {};
    let embeddedImageCount = 0;
    let reusedImageCount = 0;
    const imagesMap = body?.images && typeof body.images === 'object' && !Array.isArray(body.images)
      ? body.images
      : {};
    const srcPaths = Object.keys(imagesMap).slice(0, MAX_EMBEDDED_IMAGES);
    for (const srcPath of srcPaths) {
      try {
        const m = DATA_URL_RE.exec(String(imagesMap[srcPath] || ''));
        if (!m) continue;
        const buf = Buffer.from(m[2], 'base64');
        if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) continue;
        const existingAbs = resolveLocalUploadPath(srcPath);
        if (!existingAbs) continue;

        // 幂等：目标已存在同路径且内容一致 → 直接复用（同一套部署内重复导入不新增文件）
        let existing: Buffer | null = null;
        try {
          existing = await fsPromises.readFile(existingAbs);
        } catch {
          existing = null;
        }
        if (existing && md5(existing) === md5(buf)) {
          pathRewrite[srcPath] = srcPath;
          reusedImageCount++;
          continue;
        }

        // 落地为本地图片：沿用原路径的一级子目录（如 dishes）与扩展名
        const relSegs = srcPath.replace(/^\/uploads\//, '').split('/');
        const folder = relSegs.length > 1 ? relSegs[0] : 'dishes';
        const baseName = relSegs[relSegs.length - 1] || 'img';
        const ext = baseName.includes('.') ? (baseName.split('.').pop() || 'jpg') : 'jpg';
        const saved = saveImageToPublicUploads(buf, folder, `import_${baseName}`, ext);
        pathRewrite[srcPath] = saved.url;
        embeddedImageCount++;
      } catch {
        // 单张图片落地失败不阻塞导入：该菜品保留原路径
      }
    }

    // 组装入库数据（复用既有事务批量：同名跳过/非法计数/原子回滚）
    let externalImageCount = 0;
    const items = rawDishes.map((d: any) => {
      const img = String(d?.image || '').trim();
      let image = img;
      if (img.startsWith('/uploads/')) {
        image = pathRewrite[img] || img;
      } else if (/^https?:\/\//i.test(img)) {
        externalImageCount++;
      }
      return {
        name: String(d?.name || ''),
        price: Number(d?.price),
        category: String(d?.category || ''),
        description: String(d?.description || ''),
        image,
        status: Number(d?.status) === 0 ? 0 : 1,
        taste_options: String(d?.taste_options || ''),
      };
    });

    const result = await createDishesBatch(items, tenantId);
    return NextResponse.json({
      success: true,
      message: `导入完成：新增 ${result.created} 道，同名跳过 ${result.skipped} 道${result.invalid ? `，无效跳过 ${result.invalid} 道` : ''}`,
      data: { ...result, externalImageCount, embeddedImageCount, reusedImageCount },
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to import dishes json:', error);
    return NextResponse.json(
      { success: false, error: '导入菜品失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
