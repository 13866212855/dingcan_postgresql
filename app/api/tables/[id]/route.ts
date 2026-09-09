import { NextRequest, NextResponse } from 'next/server';
import { updateTable, deleteTable, toggleTableOccupied, getAllTables } from '@/lib/db';
import { getTenantIdFromRequest } from '@/lib/tenant';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const tableId = parseInt(id, 10);
    if (isNaN(tableId)) {
      return NextResponse.json({ success: false, error: '无效的餐桌ID' }, { status: 400 });
    }

    const body = await req.json();
    const { name, is_occupied, sort_order } = body;

    if (is_occupied !== undefined && name === undefined && sort_order === undefined) {
      await toggleTableOccupied(tableId, is_occupied ? 1 : 0, tenantId);
    } else {
      await updateTable(
        tableId,
        {
          name,
          is_occupied,
          sort_order,
        },
        tenantId
      );
    }

    const tables = await getAllTables(false, tenantId);
    const updated = tables.find((t) => t.id === tableId);

    return NextResponse.json({
      success: true,
      message: '餐桌更新成功',
      data: updated,
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '更新餐桌失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = getTenantIdFromRequest(req);
    const { id } = await params;
    const tableId = parseInt(id, 10);
    if (isNaN(tableId)) {
      return NextResponse.json({ success: false, error: '无效的餐桌ID' }, { status: 400 });
    }

    await deleteTable(tableId, tenantId);
    return NextResponse.json({
      success: true,
      message: '餐桌删除成功',
      tenantId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: '删除餐桌失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
