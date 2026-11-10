'use client';

import React, { useState, useMemo, useRef } from 'react';
import { X, FileJson, FileUp, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Dish } from '@/types';
import { parseJsonResponse } from '@/lib/utils';

/**
 * JSON 菜品导入弹窗：选择本系统导出的菜品 JSON 文件 → 本地解析预览（新建/同名跳过/无效）
 * → 确认后 POST /api/dishes/import-json → 展示服务端权威结果。
 * 配套「导出 JSON」按钮使用，实现门店间菜品搬运（同部署直接可用；跨服务器勾选导出「包含图片」）。
 */

const MAX_FILE_BYTES = 30 * 1024 * 1024; // 与服务端 413 上限一致

interface ParsedPayload {
  dishes: any[];
  images: Record<string, string> | null;
}

interface ImportResult {
  created: number;
  skipped: number;
  invalid: number;
  externalImageCount: number;
  embeddedImageCount: number;
  reusedImageCount: number;
}

interface JsonDishImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId?: string;
  existingDishes?: Dish[];
}

export default function JsonDishImportModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId = 'default',
  existingDishes = [],
}: JsonDishImportModalProps) {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 本地预览统计（与服务端 createDishesBatch 同口径：btrim 同名跳过、name/price 校验）
  const preview = useMemo(() => {
    if (!parsed) return null;
    const existingNames = new Set(existingDishes.map((d) => (d.name || '').trim()));
    const toCreate: string[] = [];
    const skippedNames: string[] = [];
    const invalidCount = { n: 0 };
    const seen = new Set<string>();
    let externalImageCount = 0;
    let missingImageData = 0;
    for (const d of parsed.dishes) {
      const name = String(d?.name || '').trim();
      const price = Number(d?.price);
      if (!name || !(price >= 0)) {
        invalidCount.n++;
        continue;
      }
      if (existingNames.has(name) || seen.has(name)) {
        skippedNames.push(name);
        continue;
      }
      seen.add(name);
      toCreate.push(name);
      const img = String(d?.image || '').trim();
      if (/^https?:\/\//i.test(img)) {
        externalImageCount++;
      } else if (img.startsWith('/uploads/') && parsed.images && !parsed.images[img]) {
        // 未勾选「包含图片」导出（或该图缺失）：路径原样保留，目标服务器无此文件时会裂图
        missingImageData++;
      }
    }
    return {
      toCreate,
      skippedNames,
      invalidCount: invalidCount.n,
      externalImageCount,
      missingImageData,
      hasImages: !!parsed.images,
    };
  }, [parsed, existingDishes]);

  const resetAll = () => {
    setFileName('');
    setParsed(null);
    setImporting(false);
    setError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handlePickFile = () => {
    setError('');
    setResult(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setParsed(null);
    setResult(null);
    setError('');
    setFileName(f ? f.name : '');
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setError('文件超过 30MB 上限，请改用「不含图片」方式导出后再导入');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const dishes = Array.isArray(data?.dishes) ? data.dishes : null;
        if (!dishes) throw new Error('缺少 dishes 数组，不是本系统导出的菜品文件');
        if (dishes.length === 0) throw new Error('文件中没有菜品数据');
        if (dishes.length > 500) throw new Error('菜品数超过 500 道单次导入上限');
        const images =
          data.images && typeof data.images === 'object' && !Array.isArray(data.images)
            ? (data.images as Record<string, string>)
            : null;
        setParsed({ dishes, images });
      } catch (err: any) {
        setError('解析失败：' + (err?.message || '文件不是合法 JSON'));
      }
    };
    reader.onerror = () => setError('读取文件失败，请重试');
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!parsed || importing) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch(`/api/dishes/import-json?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishes: parsed.dishes, images: parsed.images || undefined }),
      });
      const data = await parseJsonResponse<any>(res, { success: false });
      if (!data.success) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data.data as ImportResult);
      onSuccess();
    } catch (err: any) {
      setError('导入失败：' + (err?.message || ''));
    } finally {
      setImporting(false);
    }
  };

  // Hooks 顺序红线：所有 hook 必须位于上方，早退之后不得再出现任何 hook（React #310）
  if (!isOpen) return null;

  const totalNew = preview?.toCreate.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80 rounded-t-3xl">
          <div className="flex items-center space-x-2">
            <FileJson className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-neutral-900">导入菜品 JSON</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={importing}
            className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* 选择文件 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handlePickFile}
            disabled={importing}
            className="w-full py-6 px-4 border-2 border-dashed border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-2xl flex flex-col items-center justify-center space-y-1.5 text-neutral-500 transition-colors disabled:opacity-50"
          >
            <FileUp className="w-7 h-7 text-neutral-400" />
            <span className="text-xs font-bold">{fileName || '点击选择菜品 JSON 文件'}</span>
            <span className="text-[10px] text-neutral-400">
              由「导出 JSON」生成 · 单次最多 500 道 · ≤30MB
            </span>
          </button>

          {error && (
            <div className="flex items-start space-x-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="text-xs text-rose-700 font-bold leading-relaxed break-all">{error}</span>
            </div>
          )}

          {/* 预览统计（文件已解析、尚未导入） */}
          {parsed && preview && !result && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-black text-emerald-600">{preview.toCreate.length}</div>
                  <div className="text-[10px] font-bold text-emerald-700">将新建</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-black text-amber-600">{preview.skippedNames.length}</div>
                  <div className="text-[10px] font-bold text-amber-700">同名跳过</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-center">
                  <div className="text-lg font-black text-rose-600">{preview.invalidCount}</div>
                  <div className="text-[10px] font-bold text-rose-700">无效跳过</div>
                </div>
              </div>

              {preview.skippedNames.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5">
                  <div className="text-[10px] font-bold text-amber-700 mb-1">
                    同名菜品（保留本店现有版本，不做改动）：
                  </div>
                  <div className="text-[10px] text-amber-600 leading-relaxed">
                    {preview.skippedNames.slice(0, 12).join('、')}
                    {preview.skippedNames.length > 12 && ` 等 ${preview.skippedNames.length} 道`}
                  </div>
                </div>
              )}

              {preview.externalImageCount > 0 && (
                <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber-700 leading-relaxed">
                    {preview.externalImageCount} 道菜使用外部图片链接，导入后如外站不可达会显示裂图，建议到菜品编辑里替换为本地图。
                  </span>
                </div>
              )}

              {preview.missingImageData > 0 && (
                <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber-700 leading-relaxed">
                    {preview.missingImageData} 道菜的图片数据未包含在文件中（导出时未勾选「包含图片」或文件缺失）。若本服务器没有对应图片文件，这些菜会显示占位图。
                  </span>
                </div>
              )}

              <div className="flex items-start space-x-2 bg-sky-50 border border-sky-100 rounded-xl p-2.5">
                <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                <span className="text-[10px] text-sky-700 leading-relaxed">
                  导入只新增菜品、绝不改动本店已有菜（同名自动跳过）；导入成功后可在本店随意改价、上下架、删除，与来源店互不影响。
                </span>
              </div>
            </div>
          )}

          {/* 服务端结果 */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-xs font-bold text-emerald-700">
                  导入完成：新增 {result.created} 道，同名跳过 {result.skipped} 道
                  {result.invalid > 0 ? `，无效跳过 ${result.invalid} 道` : ''}。
                </div>
              </div>
              <div className="text-[10px] text-neutral-500 leading-relaxed px-1">
                {result.embeddedImageCount > 0 &&
                  `已落地内嵌图片 ${result.embeddedImageCount} 张为本店本地图；`}
                {result.reusedImageCount > 0 &&
                  `${result.reusedImageCount} 张图片与本地文件一致，直接复用；`}
                {result.externalImageCount > 0 &&
                  `${result.externalImageCount} 道菜保留外部图片链接（如裂图请手动换图）。`}
                菜品库列表已刷新。
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-0 flex items-center space-x-2.5">
          <button
            onClick={handleClose}
            disabled={importing}
            className="flex-1 py-2.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {result ? '完成' : '取消'}
          </button>
          {!result && (
            <button
              id="btn-confirm-json-import"
              onClick={handleImport}
              disabled={!parsed || importing || totalNew === 0}
              className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              title={totalNew === 0 ? '文件中没有需要新建的菜品' : '开始导入（同名菜品自动跳过）'}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在导入...</span>
                </>
              ) : (
                <>
                  <FileUp className="w-4 h-4" />
                  <span>确认导入{totalNew > 0 ? ` ${totalNew} 道` : ''}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
