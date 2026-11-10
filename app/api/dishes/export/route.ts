import { NextRequest, NextResponse } from 'next/server';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { getAllDishes } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * 将 /uploads/ 本地路径安全解析为 public 目录内的绝对路径（防路径穿越）。
 * 非法路径（不在 /uploads/ 下、含 ..、解析后越出 uploads 根目录）返回 null。
 */
function resolveLocalUploadPath(imagePath: string): string | null {
  if (!imagePath.startsWith('/uploads/') || imagePath.includes('..')) return null;
  const root = path.resolve(process.cwd(), 'public', 'uploads');
  const resolved = path.resolve(root, imagePath.replace(/^\/uploads\//, ''));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/**
 * GET 导出当前租户全部菜品为 JSON 文件（含在售与已下架）。
 * ?with_images=1 时将 /uploads 本地图片以 base64 内嵌进 images 段（跨服务器迁移用，文件较大）。
 * 响应带 Content-Disposition 附件下载头；id/tenant_id 不导出（导入端重新分配）。
 */
export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const withImages = new URL(req.url).searchParams.get('with_images') === '1';
    const dishes = await getAllDishes(false, tenantId);

    const payload: Record<string, unknown> = {
      format_version: 1,
      exported_at: new Date().toISOString(),
      source_tenant: tenantId,
      count: dishes.length,
      dishes: dishes.map((d) => ({
        name: d.name,
        price: d.price,
        category: d.category,
        description: d.description || '',
        image: d.image || '',
        status: d.status,
        taste_options: d.taste_options || '',
      })),
    };

    if (withImages) {
      const images: Record<string, string> = {};
      const uniquePaths = Array.from(
        new Set(dishes.map((d) => (d.image || '').trim()).filter((p) => p.startsWith('/uploads/')))
      );
      for (const p of uniquePaths) {
        try {
          const abs = resolveLocalUploadPath(p);
          if (!abs) continue;
          const buf = await fsPromises.readFile(abs);
          const ext = (p.split('.').pop() || 'jpg').toLowerCase();
          images[p] = `data:${MIME_BY_EXT[ext] || 'image/jpeg'};base64,${buf.toString('base64')}`;
        } catch {
          // 单个图片文件缺失（如本地未同步）：跳过内嵌，导入端将原样保留该路径
        }
      }
      payload.images = images;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'tenant';
    const asciiName = `${safeTenant}_dishes_${dateStr}.json`;
    const utf8Name = encodeURIComponent(`${safeTenant}_菜品_${dateStr}.json`);

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Failed to export dishes json:', error);
    return NextResponse.json(
      { success: false, error: '导出菜品失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
