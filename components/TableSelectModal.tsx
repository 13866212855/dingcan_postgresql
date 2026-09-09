'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { DiningTable } from '@/types';
import { safeFetchJson } from '@/lib/fetchUtils';

interface TableSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTable: string;
  onSelectTable: (table: string) => void;
  tenantId?: string;
}

export default function TableSelectModal({
  isOpen,
  onClose,
  currentTable,
  onSelectTable,
  tenantId = 'default',
}: TableSelectModalProps) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    const fetchFreeTables = async () => {
      setLoading(true);
      try {
        // Fetch only free tables to prevent double occupancy
        const data = await safeFetchJson<{ success: boolean; data: DiningTable[] }>(
          `/api/tables?onlyFree=true&tenant=${encodeURIComponent(tenantId)}`
        );
        if (isMounted && data?.success && Array.isArray(data.data)) {
          setTables(data.data);
        }
      } catch (err: any) {
        console.warn('Notice: Failed to fetch free tables:', err?.message || err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchFreeTables();

    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId]);

  if (!isOpen) return null;

  const handleSelect = (t: string) => {
    onSelectTable(t);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectTable(customInput.trim());
      setCustomInput('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200 border border-neutral-200">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-neutral-900 text-base">请选择空闲就餐桌号</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
              当前仅展示店内<strong>空闲可用</strong>的位置（已被占用的已自动隐藏）：
            </p>
          </div>

          {loading ? (
            <div className="py-8 flex items-center justify-center text-neutral-400 space-x-2 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
              <span>检测店内空闲桌位中...</span>
            </div>
          ) : tables.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-0.5">
              {tables.map((t) => {
                const isSelected = currentTable === t.name;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.name)}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all text-center flex items-center justify-center space-x-1 ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-emerald-50/70 text-emerald-950 border-emerald-200 hover:border-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mr-1" />
                    )}
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-center text-xs text-amber-800 space-y-1">
              <AlertCircle className="w-5 h-5 text-amber-600 mx-auto" />
              <p className="font-bold">暂无系统预设空闲餐桌</p>
              <p className="text-[11px] text-amber-700">可在下方手动输入就餐位置或等待翻台</p>
            </div>
          )}

          <form onSubmit={handleCustomSubmit} className="pt-2 border-t border-neutral-100">
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              临时/自定义位置：
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="例如：露台3号、吧台2号"
                className="flex-1 px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors"
              >
                确定
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
