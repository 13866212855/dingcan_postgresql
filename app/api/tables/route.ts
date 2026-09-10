import { NextRequest, NextResponse } from 'next/server';
import { getAllTables, createTable } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const onlyFree = searchParams.get('onlyFree') === 'true';

    const tables = await getAllTables(onlyFree, tenantId);
    return NextResponse.json({ success: true, data: tables, tenantId });
  } catch (error: any) {
    console.error('Failed to get tables:', error);
    return NextResponse.json(
      { success: false, error: '获取餐桌失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const body = await req.json();
    const { name, sort_order = 0, batch } = body;

    // 1. 批量添加餐桌
    if (Array.isArray(batch) && batch.length > 0) {
      const existingTables = await getAllTables(false, tenantId);
      const existingNames = new Set(existingTables.map((t) => t.name.trim().toLowerCase()));
      let currentMaxSort = existingTables.length > 0 ? Math.max(...existingTables.map((t) => t.sort_order)) : 0;

      const createdList = [];
      for (const item of batch) {
        const itemClean = String(item).trim();
        if (itemClean && !existingNames.has(itemClean.toLowerCase())) {
          currentMaxSort += 1;
          const newId = await createTable(itemClean, currentMaxSort, tenantId);
          existingNames.add(itemClean.toLowerCase());
          createdList.push({ id: newId, name: itemClean });
        }
      }

      return NextResponse.json({
        success: true,
        message: `成功批量创建 ${createdList.length} 个餐桌`,
        createdCount: createdList.length,
        data: createdList,
        tenantId,
      });
    }

    // 2. 单个添加餐桌
    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: '餐桌名称不能为空' }, { status: 400 });
    }

    const cleanName = name.trim();
    const existingTables = await getAllTables(false, tenantId);
    if (existingTables.some((t) => t.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `餐桌名称 [${cleanName}] 在当前门店已存在，请勿重复添加` },
        { status: 400 }
      );
    }

    const id = await createTable(cleanName, Number(sort_order) || 0, tenantId);
    const tables = await getAllTables(false, tenantId);
    const created = tables.find((t) => t.id === id);

    return NextResponse.json({
      success: true,
      message: '餐桌添加成功',
      data: created,
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to create table:', error);
    return NextResponse.json(
      { success: false, error: '添加餐桌失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const pool = await (await import('@/lib/db')).ensureDatabase();
    await pool.query('DELETE FROM tables WHERE tenant_id = $1', [tenantId]);
    return NextResponse.json({
      success: true,
      message: '所有餐桌已成功清空',
      tenantId,
    });
  } catch (error: any) {
    console.error('Failed to clear tables:', error);
    return NextResponse.json(
      { success: false, error: '清空餐桌失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
