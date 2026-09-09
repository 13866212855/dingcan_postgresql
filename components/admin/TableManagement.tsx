'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Copy,
  QrCode,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Check,
  Globe,
  Sliders,
  Sparkles,
  Layers,
  Save,
} from 'lucide-react';
import { DiningTable } from '@/types';

interface TableManagementProps {
  tenantId?: string;
}

export default function TableManagement({ tenantId = 'default' }: TableManagementProps) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [customDomain, setCustomDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 桌号运营配置状态
  const [requireTableNo, setRequireTableNo] = useState(true);
  const [tableInputMode, setTableInputMode] = useState<'select' | 'input' | 'both'>('select');
  const [isSavingTableConfig, setIsSavingTableConfig] = useState(false);
  const [tableConfigSavedMsg, setTableConfigSavedMsg] = useState('');

  // Modal for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [tableNameInput, setTableNameInput] = useState('');
  const [sortOrderInput, setSortOrderInput] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Modal for Batch Add
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('A');
  const [batchStart, setBatchStart] = useState(1);
  const [batchEnd, setBatchEnd] = useState(10);
  const [batchPadZero, setBatchPadZero] = useState(true);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchMsg, setBatchMsg] = useState('');

  // QR Code preview modal
  const [qrModalTable, setQrModalTable] = useState<DiningTable | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tablesRes, settingsRes] = await Promise.all([
        fetch(`/api/tables?tenant=${encodeURIComponent(tenantId)}`),
        fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`),
      ]);
      const data = await tablesRes.json();
      const setJson = await settingsRes.json();

      if (data.success && Array.isArray(data.data)) {
        setTables(data.data);
      } else {
        setError(data.error || '获取餐桌失败');
      }

      if (setJson.success && setJson.data) {
        if (setJson.data.custom_domain) {
          setCustomDomain(setJson.data.custom_domain);
        }
        setRequireTableNo(setJson.data.require_table_no !== 0);
        if (setJson.data.table_input_mode) {
          setTableInputMode(setJson.data.table_input_mode);
        }
      }
    } catch (e: any) {
      setError(e?.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [tablesRes, settingsRes] = await Promise.all([
          fetch(`/api/tables?tenant=${encodeURIComponent(tenantId)}`),
          fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`),
        ]);
        const data = await tablesRes.json();
        const setJson = await settingsRes.json();
        if (isMounted) {
          if (data.success && Array.isArray(data.data)) {
            setTables(data.data);
          }
          if (setJson.success && setJson.data) {
            if (setJson.data.custom_domain) {
              setCustomDomain(setJson.data.custom_domain);
            }
            setRequireTableNo(setJson.data.require_table_no !== 0);
            if (setJson.data.table_input_mode) {
              setTableInputMode(setJson.data.table_input_mode);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch tables:', e);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // 保存桌号运营规则
  const handleSaveTableSettings = async () => {
    setIsSavingTableConfig(true);
    setTableConfigSavedMsg('');
    try {
      const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          require_table_no: requireTableNo ? 1 : 0,
          table_input_mode: tableInputMode,
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTableConfigSavedMsg('✅ 就餐桌号规则已成功更新并生效！');
        setTimeout(() => setTableConfigSavedMsg(''), 3000);
      } else {
        alert(data.error || '保存失败');
      }
    } catch (e: any) {
      alert('保存失败: ' + (e?.message || '网络异常'));
    } finally {
      setIsSavingTableConfig(false);
    }
  };

  // 批量创建餐桌
  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (batchStart > batchEnd) {
      setBatchMsg('起始编号不能大于结束编号');
      return;
    }
    if (batchEnd - batchStart > 100) {
      setBatchMsg('单次批量创建请勿超过 100 个桌位');
      return;
    }

    setBatchSubmitting(true);
    setBatchMsg('');
    try {
      const names: string[] = [];
      const prefix = batchPrefix.trim();
      for (let i = batchStart; i <= batchEnd; i++) {
        let numStr = String(i);
        if (batchPadZero && i < 10) {
          numStr = '0' + i;
        }
        names.push(`${prefix}${numStr}号桌`);
      }

      const res = await fetch(`/api/tables?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: names,
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsBatchModalOpen(false);
        fetchTables();
      } else {
        setBatchMsg(data.error || '批量创建失败');
      }
    } catch (e: any) {
      setBatchMsg(e?.message || '网络连接异常');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTable(null);
    setTableNameInput('');
    setSortOrderInput(tables.length + 1);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: DiningTable) => {
    setEditingTable(t);
    setTableNameInput(t.name);
    setSortOrderInput(t.sort_order);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNameInput.trim()) return;

    setSubmitting(true);
    try {
      if (editingTable) {
        // Edit
        const res = await fetch(`/api/tables/${editingTable.id}?tenant=${encodeURIComponent(tenantId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tableNameInput.trim(),
            sort_order: Number(sortOrderInput) || 0,
            tenantId,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      } else {
        // Add
        const res = await fetch(`/api/tables?tenant=${encodeURIComponent(tenantId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tableNameInput.trim(),
            sort_order: Number(sortOrderInput) || 0,
            tenantId,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      }

      setIsModalOpen(false);
      fetchTables();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOccupied = async (t: DiningTable) => {
    const newOccupied = t.is_occupied === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/tables/${t.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_occupied: newOccupied, tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        setTables((prev) =>
          prev.map((item) => (item.id === t.id ? { ...item, is_occupied: newOccupied } : item))
        );
      }
    } catch (e) {
      console.error('Failed to toggle table state:', e);
    }
  };

  const handleDelete = async (t: DiningTable) => {
    if (!confirm(`确定要删除餐桌【${t.name}】吗？`)) return;

    try {
      const res = await fetch(`/api/tables/${t.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchTables();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  const getTableUrl = (name: string) => {
    let base = customDomain?.trim();
    if (!base) {
      base = typeof window !== 'undefined' ? window.location.origin : '';
    }
    base = base.replace(/\/+$/, '');
    const tenantParam = tenantId && tenantId !== 'default' ? `&tenant=${encodeURIComponent(tenantId)}` : '';
    return `${base}/?desk=${encodeURIComponent(name)}${tenantParam}`;
  };

  const isRunAppDomain =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('run.app') &&
    !customDomain?.trim();

  const handleCopyLink = (t: DiningTable) => {
    const url = getTableUrl(t.name);
    navigator.clipboard.writeText(url);
    setCopiedId(t.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const freeCount = tables.filter((t) => t.is_occupied === 0).length;
  const occupiedCount = tables.filter((t) => t.is_occupied === 1).length;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-amber-600" />
            <span>餐桌与区域管理</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            配置店内餐桌、实时监控/修改占用状态、生成专属二维码点餐直达链接
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTables}
            disabled={loading}
            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>刷新</span>
          </button>
          <button
            onClick={() => {
              setBatchMsg('');
              setIsBatchModalOpen(true);
            }}
            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>批量生成桌号</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>添加新餐桌</span>
          </button>
        </div>
      </div>

      {/* 就餐桌号规则运营配置快捷卡片 */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-neutral-900">堂食就餐桌号点餐规则配置</h3>
            <span className="text-[11px] text-neutral-400">（实时生效至前台点餐）</span>
          </div>
          {tableConfigSavedMsg && (
            <span className="text-xs font-bold text-emerald-600 animate-in fade-in">
              {tableConfigSavedMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* 必须指定桌号开关 */}
          <label className="flex items-start space-x-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 cursor-pointer hover:bg-neutral-100/50 transition-colors">
            <input
              type="checkbox"
              checked={requireTableNo}
              onChange={(e) => setRequireTableNo(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-neutral-900">
                堂食下单必须选择或指定就餐桌号
              </span>
              <p className="text-[11px] text-neutral-500">
                开启后，前端结算窗口展示桌号选择框并必须指定桌号；若关闭，前端结算窗口彻底隐藏桌号区块（极致精简），订单自动归为“自取/未指定桌位”。
              </p>
            </div>
          </label>

          {/* 桌号提供方式 */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 space-y-2">
            <span className="block text-xs font-bold text-neutral-800">
              前端桌号录入方式
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setTableInputMode('select')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                  tableInputMode === 'select'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-neutral-700 border border-neutral-200'
                }`}
              >
                仅下拉选桌
              </button>
              <button
                type="button"
                onClick={() => setTableInputMode('input')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                  tableInputMode === 'input'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-neutral-700 border border-neutral-200'
                }`}
              >
                允许手动填写
              </button>
              <button
                type="button"
                onClick={() => setTableInputMode('both')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                  tableInputMode === 'both'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-white text-neutral-700 border border-neutral-200'
                }`}
              >
                双模式兼备
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSaveTableSettings}
            disabled={isSavingTableConfig}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span>{isSavingTableConfig ? '保存中...' : '保存桌号规则配置'}</span>
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-neutral-500">餐桌总数</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{tables.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-emerald-600 font-bold">● 空闲中</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{freeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-rose-600 font-bold">● 就餐占用中</span>
          <div className="text-2xl font-black text-rose-600 mt-1">{occupiedCount}</div>
        </div>
      </div>

      {/* Domain Status / WeChat Scan Hint Banner */}
      {customDomain ? (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              已启用自定义扫码域名：
              <strong className="font-mono text-indigo-700 font-bold ml-1">{customDomain}</strong>
            </span>
          </div>
          <span className="text-[11px] text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 self-start sm:self-auto font-medium">
            ✅ 桌贴已采用此域名生成二维码 (微信扫码友好)
          </span>
        </div>
      ) : isRunAppDomain ? (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start space-x-3 text-xs text-amber-900">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">
              微信扫码特别提醒：当前桌贴使用的是 Cloud Run 测试域名 (*.run.app)
            </p>
            <p className="text-neutral-600 leading-relaxed text-[11px]">
              微信内置浏览器对海外云服务默认域名有严格安全拦截机制，扫码将无法直接加载（电脑浏览器可访问）。
              若需印制正式桌贴让顾客微信扫码直达，请在【系统设置】配置您的<strong>国内已备案域名</strong>或服务器地址，二维码将自动无缝切换！
            </p>
          </div>
        </div>
      ) : null}

      {/* Error display */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => {
          const isOccupied = table.is_occupied === 1;
          const tableUrl = getTableUrl(table.name);

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl border transition-all p-4 shadow-2xs flex flex-col justify-between ${
                isOccupied ? 'border-rose-200 bg-rose-50/20' : 'border-neutral-200 hover:border-amber-300'
              }`}
            >
              {/* Table Card Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-black text-neutral-900 flex items-center space-x-1.5">
                    <span>{table.name}</span>
                  </span>

                  <button
                    onClick={() => handleToggleOccupied(table)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1 transition-colors ${
                      isOccupied
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                    }`}
                  >
                    {isOccupied ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>占用中 (点我设空闲)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>空闲 (点我设占用)</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  排序权重: {table.sort_order} · 当前顾客点餐时：
                  {isOccupied ? (
                    <strong className="text-rose-600 ml-1">在普通结账中已隐藏</strong>
                  ) : (
                    <strong className="text-emerald-600 ml-1">在前台正常可选</strong>
                  )}
                </p>
              </div>

              {/* QR Code & Link Section */}
              <div className="mt-4 pt-3 border-t border-neutral-100 space-y-2">
                <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                  <div className="truncate flex-1 pr-2 text-neutral-600 font-mono text-[11px]">
                    {tableUrl}
                  </div>
                  <button
                    onClick={() => handleCopyLink(table)}
                    className="p-1 text-neutral-500 hover:text-amber-600 transition-colors shrink-0"
                    title="复制此桌专属点餐链接"
                  >
                    {copiedId === table.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setQrModalTable(table)}
                    className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center space-x-1 transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>查看桌贴二维码</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(table)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                      title="编辑名称"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(table)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="删除餐桌"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Table Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-neutral-900 text-base mb-3">
              {editingTable ? '修改餐桌信息' : '添加新餐桌'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  餐桌名称（如：1号桌、包厢1等）
                </label>
                <input
                  type="text"
                  required
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  placeholder="例如：1号桌 / 聚贤阁包厢"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  显示排序编号（越小越靠前）
                </label>
                <input
                  type="number"
                  value={sortOrderInput}
                  onChange={(e) => setSortOrderInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-60"
                >
                  {submitting ? '保存中...' : '确定保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="font-bold text-sm text-neutral-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>批量快速生成餐桌号</span>
              </h3>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {batchMsg && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {batchMsg}
              </div>
            )}

            <form onSubmit={handleBatchCreate} className="space-y-4 pt-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  桌号区域/前缀 (可留空或自定义)
                </label>
                <input
                  type="text"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                  placeholder="例如：A 或 大厅 或 包厢 或留空"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-neutral-400 mt-1">例如前缀输入“A”，生成为 A01号桌、A02号桌...</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">起始序号</label>
                  <input
                    type="number"
                    min={1}
                    value={batchStart}
                    onChange={(e) => setBatchStart(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">结束序号</label>
                  <input
                    type="number"
                    min={1}
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <label className="flex items-center space-x-2 text-xs text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchPadZero}
                  onChange={(e) => setBatchPadZero(e.target.checked)}
                  className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                />
                <span>一位数前面自动补零（例如 01、02... 代替 1、2...）</span>
              </label>

              {/* 预览 */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                <span className="text-neutral-500 block text-[11px] font-bold mb-1">生成预览 (前3个与最后1个)：</span>
                <span className="font-mono font-bold text-amber-700">
                  {batchPrefix}
                  {batchPadZero && batchStart < 10 ? '0' + batchStart : batchStart}号桌、
                  {batchPrefix}
                  {batchPadZero && batchStart + 1 < 10 ? '0' + (batchStart + 1) : batchStart + 1}号桌 ...{' '}
                  {batchPrefix}
                  {batchPadZero && batchEnd < 10 ? '0' + batchEnd : batchEnd}号桌
                </span>
                <span className="block text-[11px] text-neutral-400 mt-0.5">
                  共计生成 {Math.max(0, batchEnd - batchStart + 1)} 个桌位
                </span>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={batchSubmitting}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-60"
                >
                  {batchSubmitting ? '正在批量创建...' : '立即批量创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Printable Modal */}
      {qrModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-neutral-200 animate-in zoom-in-95">
            <h3 className="font-bold text-lg text-neutral-900">
              【{qrModalTable.name}】专属桌贴二维码
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              可直接打印粘贴在{qrModalTable.name}桌面，顾客微信扫码直接入座该桌
            </p>

            <div className="my-5 p-4 bg-white border-2 border-dashed border-amber-300 rounded-2xl inline-block shadow-inner">
              {/* Dynamic generated QR via quick QR image API */}
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  getTableUrl(qrModalTable.name)
                )}`}
                alt={`${qrModalTable.name} 二维码`}
                width={192}
                height={192}
                className="w-48 h-48 mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="mt-2 text-xs font-bold text-amber-900">{qrModalTable.name}</div>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-[11px] text-neutral-600 font-mono break-all text-left">
                <span className="text-neutral-400 select-none block text-[10px] uppercase font-bold mb-0.5">点餐直达网址:</span>
                {getTableUrl(qrModalTable.name)}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleCopyLink(qrModalTable)}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedId === qrModalTable.id ? '已复制链接！' : '复制该桌专属链接'}</span>
                </button>
                <a
                  href={getTableUrl(qrModalTable.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-colors shrink-0"
                  title="在新标签页测试打开"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <button
                onClick={() => setQrModalTable(null)}
                className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-xs rounded-xl transition-colors"
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
