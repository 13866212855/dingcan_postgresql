'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  QrCode,
  RefreshCw,
  AlertCircle,
  Check,
  Building2,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Tenant } from '@/types';

interface TenantManagementProps {
  currentTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onTenantsUpdated?: () => void;
}

const PRESET_STORE_LOGOS = [
  {
    name: '中式正餐炒菜',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '川湘麻辣风味',
    url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '精致砂锅煲仔',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '特色面食粉馆',
    url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '养生汤膳靓汤',
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=160&auto=format&fit=crop&q=80',
  },
];

export default function TenantManagement({
  currentTenantId,
  onSelectTenant,
  onTenantsUpdated,
}: TenantManagementProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);

  // Form State
  const [idInput, setIdInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [sloganInput, setSloganInput] = useState('');
  const [logoInput, setLogoInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [statusInput, setStatusInput] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // QR Modal
  const [qrTenant, setQrTenant] = useState<Tenant | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/tenants?tenant=${encodeURIComponent(currentTenantId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTenants(data.data);
      } else {
        setErrorMsg(data.error || '获取连锁分店列表失败');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  }, [currentTenantId]);

  useEffect(() => {
    let isCancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/tenants?tenant=${encodeURIComponent(currentTenantId)}`);
        const data = await res.json();
        if (!isCancelled) {
          if (data.success && Array.isArray(data.data)) {
            setTenants(data.data);
          } else {
            setErrorMsg(data.error || '获取连锁分店列表失败');
          }
        }
      } catch (e: any) {
        if (!isCancelled) {
          setErrorMsg(e?.message || '网络连接异常');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isCancelled = true;
    };
  }, [currentTenantId]);

  const openAddModal = () => {
    setEditingTenant(null);
    setIdInput('');
    setNameInput('');
    setSloganInput('精选食材 · 匠心出品');
    setLogoInput(PRESET_STORE_LOGOS[0].url);
    setPhoneInput('');
    setAddressInput('');
    setStatusInput(1);
    setIsModalOpen(true);
  };

  const openEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setIdInput(t.id);
    setNameInput(t.name);
    setSloganInput(t.slogan || '');
    setLogoInput(t.logo || '');
    setPhoneInput(t.phone || '');
    setAddressInput(t.address || '');
    setStatusInput(t.status ?? 1);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedId = idInput.trim().toLowerCase();
    const trimmedName = nameInput.trim();

    if (!trimmedId) {
      setErrorMsg('门店唯一标识编码不能为空');
      return;
    }
    if (!/^[a-z0-9_-]{2,32}$/.test(trimmedId)) {
      setErrorMsg('门店编码必须为 2-32 位字母、数字、下划线或连字符（如 chuan_01、store-east）');
      return;
    }
    if (!trimmedName) {
      setErrorMsg('门店名称不能为空');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: trimmedId,
        name: trimmedName,
        slogan: sloganInput.trim(),
        logo: logoInput.trim(),
        phone: phoneInput.trim(),
        address: addressInput.trim(),
        status: statusInput,
        tenant: currentTenantId,
      };

      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '保存失败');
      }

      setSuccessMsg(editingTenant ? '分店信息已成功更新' : '新分店创建成功，已开辟全新专属独立数据空间！');
      setIsModalOpen(false);
      await fetchTenants();
      if (onTenantsUpdated) onTenantsUpdated();
    } catch (err: any) {
      setErrorMsg(err?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: Tenant) => {
    if (t.id === 'default') {
      alert('【系统保护】系统主店 (default) 拥有基础根节点权限，不可删除！');
      return;
    }

    if (!confirm(`确定要删除分店【${t.name}】(${t.id}) 吗？\n注意：此操作将永久抹除该分店下的所有隔离菜品、桌号与点餐记录！`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tenants?id=${encodeURIComponent(t.id)}&tenant=${encodeURIComponent(currentTenantId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '删除失败');
      }
      setSuccessMsg(`分店【${t.name}】已成功移除`);
      if (currentTenantId === t.id) {
        onSelectTenant('default');
      }
      await fetchTenants();
      if (onTenantsUpdated) onTenantsUpdated();
    } catch (err: any) {
      setErrorMsg(err?.message || '删除分店失败');
    }
  };

  const copyStoreLink = (t: Tenant) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/?tenant=${encodeURIComponent(t.id)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 若非总店访问，强制进行安全拦截
  if (currentTenantId !== 'default') {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200 shadow-xs max-w-md mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-2">权限受限 · 连锁分店管理</h3>
        <p className="text-xs text-neutral-500 leading-relaxed mb-6">
          当前登录分店无权查看或修改集团其他门店信息。连锁门店跨店配置仅限总店超级管理员账号操作。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & Info */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-black text-neutral-900">连锁门店与多租户架构</h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              数据物理/逻辑强隔离
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            系统支持连锁餐饮集团、加盟品牌或多档口统一管理。每个租户（门店）拥有专属菜品库、餐桌配置、订单流水、会员积分及收款码，互不干扰且支持一键切换。
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTenants}
            disabled={loading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition-colors"
            title="刷新分店列表"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>新增分店 / 租户</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold hover:underline">
            关闭
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 font-bold hover:underline">
            关闭
          </button>
        </div>
      )}

      {/* Current Active Tenant Notice */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-amber-900">当前后台管理上下文：</span>
          <span className="bg-amber-500 text-white font-bold px-2 py-0.5 rounded-lg">
            {tenants.find((t) => t.id === currentTenantId)?.name || currentTenantId}
          </span>
          <span className="text-amber-700 font-mono text-[11px]">
            [ID: {currentTenantId}]
          </span>
        </div>
        <span className="text-amber-800 text-[11px]">
          在下方门店列表中点击「切换为此门店」，后厨订单、菜品库、桌号将即时隔离切换。
        </span>
      </div>

      {/* Tenant Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tenants.map((t) => {
          const isCurrent = t.id === currentTenantId;
          const isDefault = t.id === 'default';

          return (
            <div
              key={t.id}
              className={`bg-white rounded-2xl border transition-all shadow-2xs flex flex-col justify-between overflow-hidden ${
                isCurrent
                  ? 'border-amber-500 ring-2 ring-amber-100 shadow-md'
                  : 'border-neutral-200/80 hover:shadow-xs'
              }`}
            >
              {/* Card Header */}
              <div className="p-4 border-b border-neutral-100 flex items-start space-x-3 bg-neutral-50/40">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold overflow-hidden relative shrink-0 shadow-2xs">
                  {t.logo ? (
                    <Image
                      src={t.logo}
                      alt={t.name}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Store className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-black text-neutral-900 truncate">{t.name}</h3>
                    {isDefault && (
                      <span className="bg-neutral-800 text-white text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0">
                        主店
                      </span>
                    )}
                    {isCurrent && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 animate-pulse">
                        当前中
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{t.slogan || '暂无标语'}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-[11px] bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
                      ID: {t.id}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        t.status === 1
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {t.status === 1 ? '营业中' : '暂停营业'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body Info */}
              <div className="p-4 space-y-1.5 text-xs text-neutral-600 flex-1">
                {t.phone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span>联系电话：{t.phone}</span>
                  </div>
                )}
                {t.address && (
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">地址：{t.address}</span>
                  </div>
                )}

                <div className="pt-2 mt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>专属隔离访问入口：</span>
                  <button
                    onClick={() => copyStoreLink(t)}
                    className="text-amber-600 hover:text-amber-700 font-bold flex items-center space-x-1"
                  >
                    {copiedId === t.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600">已复制链接</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制专属点餐链接</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="p-3 bg-neutral-50/70 border-t border-neutral-100 flex items-center justify-between gap-1.5">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setQrTenant(t)}
                    title="查看该门店二维码"
                    className="p-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 text-xs"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  <a
                    href={`/?tenant=${encodeURIComponent(t.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="在新标签页打开顾客点餐端"
                    className="p-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 text-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => openEditModal(t)}
                    title="编辑门店信息"
                    className="p-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 text-xs"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  {!isDefault && (
                    <button
                      onClick={() => handleDelete(t)}
                      title="删除分店"
                      className="p-1.5 bg-white hover:bg-rose-50 border border-neutral-200 hover:border-rose-200 rounded-lg text-neutral-400 hover:text-rose-600 text-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div>
                  {isCurrent ? (
                    <span className="px-3 py-1.5 bg-neutral-100 text-neutral-500 font-bold rounded-xl text-xs flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                      <span>正在管理中</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectTenant(t.id)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-2xs transition-all active:scale-98 flex items-center space-x-1"
                    >
                      <span>切换为此门店</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Tenant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-neutral-900 text-sm">
                  {editingTenant ? `编辑门店：${editingTenant.name}` : '开设全新分店 / 租户'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  门店唯一ID编码 (tenant_id) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingTenant)}
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder="例如：chuan、yue、store-02（英文字母/数字）"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed font-mono"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  用于在URL、API和数据库中唯一标识该门店，创建后不可更改。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  门店全称 / 招牌名 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="例如：蜀香阁·地道川菜 (天府分店)"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  宣传口号 / 副标题
                </label>
                <input
                  type="text"
                  value={sloganInput}
                  onChange={(e) => setSloganInput(e.target.value)}
                  placeholder="例如：麻辣鲜香 · 地道巴蜀风味"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  门店Logo图标URL
                </label>
                <input
                  type="text"
                  value={logoInput}
                  onChange={(e) => setLogoInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
                <div className="mt-2 flex items-center space-x-1.5 overflow-x-auto pb-1">
                  <span className="text-[11px] text-neutral-400 shrink-0">精选预设：</span>
                  {PRESET_STORE_LOGOS.map((p, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setLogoInput(p.url)}
                      className="px-2 py-0.5 text-[10px] bg-neutral-100 hover:bg-amber-100 text-neutral-700 hover:text-amber-800 rounded-md border border-neutral-200 transition-colors whitespace-nowrap"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">联系电话</label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="如：028-88888888"
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">营业状态</label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={1}>正常营业</option>
                    <option value={0}>暂停营业 / 筹备中</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">具体地址</label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="例如：成都市高新区天府大道北段1199号"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-98 disabled:opacity-60"
                >
                  {submitting ? '正在保存...' : editingTenant ? '更新门店' : '立即开设分店'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal for specific tenant */}
      {qrTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-neutral-900 text-base">{qrTenant.name}</h3>
            <p className="text-xs text-neutral-500 mt-1">专属顾客扫码点餐入口二维码</p>

            <div className="my-5 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 inline-block shadow-inner">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(
                  `${typeof window !== 'undefined' ? window.location.origin : ''}/?tenant=${qrTenant.id}`
                )}`}
                alt="点餐二维码"
                width={192}
                height={192}
                unoptimized
                referrerPolicy="no-referrer"
                className="w-48 h-48 rounded-xl object-contain"
              />
            </div>

            <p className="text-xs font-mono text-neutral-500 bg-neutral-100 p-2 rounded-xl truncate select-all">
              {`${typeof window !== 'undefined' ? window.location.origin : ''}/?tenant=${qrTenant.id}`}
            </p>

            <div className="mt-5 flex items-center justify-center space-x-2">
              <button
                onClick={() => copyStoreLink(qrTenant)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1"
              >
                {copiedId === qrTenant.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === qrTenant.id ? '已复制' : '复制链接'}</span>
              </button>
              <button
                onClick={() => setQrTenant(null)}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
