import { NextRequest, NextResponse } from 'next/server';
import { getAllTenants, getTenantById, createTenant, updateTenant, deleteTenant } from '@/lib/db';
import { normalizeTenantId } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantParam = searchParams.get('tenant') || searchParams.get('tenantId');

    if (id) {
      const tenant = await getTenantById(normalizeTenantId(id));
      if (!tenant) {
        return NextResponse.json({ success: false, error: '租户门店不存在' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: tenant });
    }

    // 子分店数据隔离：若请求指定了非 default 租户，仅返回当前分店自身信息，严禁泄漏总店及其他分店数据
    if (tenantParam && normalizeTenantId(tenantParam) !== 'default') {
      const currentTenant = await getTenantById(normalizeTenantId(tenantParam));
      return NextResponse.json({
        success: true,
        data: currentTenant ? [currentTenant] : [],
        total: currentTenant ? 1 : 0,
        isMaster: false,
      });
    }

    // 仅总店 (default) 可获取全集团连锁分店列表
    const tenants = await getAllTenants();
    return NextResponse.json({
      success: true,
      data: tenants,
      total: tenants.length,
      isMaster: true,
    });
  } catch (error: any) {
    console.error('Failed to get tenants:', error);
    return NextResponse.json(
      { success: false, error: '获取租户列表失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorTenant = searchParams.get('tenant') || searchParams.get('operatorTenant');
    
    // 权限校验：子分店禁止创建分店，仅总店具有连锁扩张权限
    if (operatorTenant && normalizeTenantId(operatorTenant) !== 'default') {
      return NextResponse.json(
        { success: false, error: '权限不足：仅总店管理员有权新增连锁分店' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, name, logo, slogan, description, phone, address, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '门店/租户名称不能为空' }, { status: 400 });
    }

    const cleanId = id ? normalizeTenantId(id) : `store_${Date.now()}`;
    const existing = await getTenantById(cleanId);
    if (existing) {
      return NextResponse.json({ success: false, error: `租户标识 [${cleanId}] 已存在，请更换` }, { status: 400 });
    }

    const created = await createTenant({
      id: cleanId,
      name: name.trim(),
      logo: logo?.trim() || '',
      slogan: slogan?.trim() || '现点现做 · 诚信经营',
      description: description?.trim() || '',
      phone: phone?.trim() || '',
      address: address?.trim() || '',
      status: status !== undefined ? Number(status) : 1,
    });

    return NextResponse.json({
      success: true,
      message: '新租户门店创建成功',
      data: created,
    });
  } catch (error: any) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json(
      { success: false, error: '创建租户门店失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: '租户标识不能为空' }, { status: 400 });
    }

    const cleanId = normalizeTenantId(id);
    const existing = await getTenantById(cleanId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '指定的租户门店不存在' }, { status: 404 });
    }

    await updateTenant(cleanId, data);
    const updated = await getTenantById(cleanId);

    return NextResponse.json({
      success: true,
      message: '租户信息更新成功',
      data: updated,
    });
  } catch (error: any) {
    console.error('Failed to update tenant:', error);
    return NextResponse.json(
      { success: false, error: '更新租户信息失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const operatorTenant = searchParams.get('tenant') || searchParams.get('operatorTenant');

    // 权限校验：子分店禁止删除分店
    if (operatorTenant && normalizeTenantId(operatorTenant) !== 'default') {
      return NextResponse.json(
        { success: false, error: '权限不足：仅总店管理员有权删除连锁分店' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少租户标识' }, { status: 400 });
    }

    const cleanId = normalizeTenantId(id);
    if (cleanId === 'default') {
      return NextResponse.json({ success: false, error: '系统默认总店租户不可删除' }, { status: 400 });
    }

    const ok = await deleteTenant(cleanId);
    if (!ok) {
      return NextResponse.json({ success: false, error: '删除租户失败' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `租户 [${cleanId}] 及关联数据已全部清理`,
    });
  } catch (error: any) {
    console.error('Failed to delete tenant:', error);
    return NextResponse.json(
      { success: false, error: '删除租户失败: ' + (error?.message || '') },
      { status: 500 }
    );
  }
}
