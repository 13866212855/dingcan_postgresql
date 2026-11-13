import { NextRequest, NextResponse } from 'next/server';
import {
  buildSkillZipBuffer,
  loadSkillFiles,
  SKILL_NAME,
  SKILL_PROMPT_TEMPLATES,
} from '@/lib/skillExport';

export const dynamic = 'force-dynamic';

/**
 * 读取或打包下载 my_create_multenant 技能文件：
 * - GET /api/skills/my-create-multenant            -> 返回文件清单、正文与提示词模板 JSON
 * - GET /api/skills/my-create-multenant?download=zip -> 返回标准 .zip 压缩包下载流
 */
export async function GET(req: NextRequest) {
  try {
    const files = loadSkillFiles();
    const downloadMode = req.nextUrl.searchParams.get('download');

    if (downloadMode === 'zip') {
      const zipBuffer = buildSkillZipBuffer(files);
      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${SKILL_NAME}.zip"`,
          'Content-Length': String(zipBuffer.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
    const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

    return NextResponse.json({
      success: true,
      skillName: SKILL_NAME,
      totalBytes,
      totalLines,
      files,
      promptTemplates: SKILL_PROMPT_TEMPLATES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: '读取技能包失败: ' + (err?.message || '未知错误') },
      { status: 500 }
    );
  }
}
