'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  FileJson,
  FileUp,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { Dish } from '@/types';
import { parseJsonResponse } from '@/lib/utils';

interface JsonDishImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId?: string;
  existingDishes?: Dish[];
}

interface ParsedJsonDish {
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  status?: number;
  taste_options?: string;
}

interface ParsedPayload {
  format_version?: number;
  exported_at?: string;
  source_tenant?: string;
  count?: number;
  dishes: ParsedJsonDish[];
  images?: Record<string, string>;
}

interface ImportResultData {
  created: number;
  skipped: number;
  invalid: number;
  externalImageCount: number;
  embeddedImageCount: number;
  reusedImageCount: number;
}

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_DISHES = 500;

function JsonDishImportInner({
  onClose,
  onSuccess,
  tenantId = 'default',
  existingDishes = [],
}: Omit<JsonDishImportModalProps, 'isOpen'>) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [rawJsonText, setRawJsonText] = useState('');
  const [parsed, setParsed] = useState<ParsedPayload | null>(null);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{
    message: string;
    data: ImportResultData;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingNames = useMemo(
    () => new Set(existingDishes.map((d) => d.name.trim())),
    [existingDishes]
  );

  const stats = useMemo(() => {
    if (!parsed) {
      return {
        total: 0,
        willCreate: 0,
        duplicate: 0,
        invalid: 0,
        embeddedImages: 0,
        externalImages: 0,
      };
    }

    let willCreate = 0;
    let duplicate = 0;
    let invalid = 0;
    let externalImages = 0;
    const seenInFile = new Set<string>();

    for (const d of parsed.dishes) {
      const name = String(d?.name || '').trim();
      const price = Number(d?.price);
      const isInvalid = !name || !Number.isFinite(price) || price < 0;
      if (isInvalid) {
        invalid++;
        continue;
      }
      if (existingNames.has(name) || seenInFile.has(name)) {
        duplicate++;
      } else {
        seenInFile.add(name);
        willCreate++;
      }
      const img = String(d?.image || '').trim();
      if (/^https?:\/\//i.test(img)) {
        externalImages++;
      }
    }

    const embeddedImages =
      parsed.images && typeof parsed.images === 'object' && !Array.isArray(parsed.images)
        ? Object.keys(parsed.images).length
        : 0;

    return {
      total: parsed.dishes.length,
      willCreate,
      duplicate,
      invalid,
      embeddedImages,
      externalImages,
    };
  }, [parsed, existingNames]);

  const resetFileState = () => {
    setFileName('');
    setFileSize(0);
    setRawJsonText('');
    setParsed(null);
    setParseError('');
    setImportError('');
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFile = async (file: File) => {
    setParseError('');
    setImportError('');
    setImportResult(null);
    setParsed(null);

    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setParseError('文件体积超过 30MB 上限，请取消勾选「含图片」后重新导出再试');
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!obj || !Array.isArray(obj.dishes)) {
        setParseError('文件中缺少 dishes 数组，请确认选择的是本系统导出的菜品 JSON 文件');
        return;
      }
      if (obj.dishes.length === 0) {
        setParseError('该 JSON 文件中没有包含任何菜品数据');
        return;
      }
      if (obj.dishes.length > MAX_DISHES) {
        setParseError(`单次最多导入 ${MAX_DISHES} 道菜品，当前文件包含 ${obj.dishes.length} 道`);
        return;
      }

      setRawJsonText(text);
      setParsed(obj as ParsedPayload);
    } catch {
      setParseError('无法解析文件内容：不是合法的 JSON 格式');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsed || !rawJsonText || importing) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await fetch(
        `/api/dishes/import-json?tenant=${encodeURIComponent(tenantId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawJsonText,
        }
      );
      const data = await parseJsonResponse<any>(res, { success: false });
      if (!data.success) {
        setImportError(data.error || '导入失败，请稍后重试');
        return;
      }
      setImportResult({
        message: data.message || '导入成功',
        data: data.data,
      });
      onSuccess();
    } catch (err: any) {
      setImportError('导入请求失败: ' + (err?.message || '网络异常'));
    } finally {
      setImporting(false);
    }
  };

  const resolvePreviewImage = (img?: string): string => {
    const trimmed = String(img || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/uploads/') && parsed?.images?.[trimmed]) {
      return parsed.images[trimmed];
    }
    return trimmed;
  };

  return (
    <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-neutral-900">
              导入菜品 JSON 文件
            </h3>
            <p className="text-[11px] text-neutral-500">
              支持导入从本系统导出的菜品 JSON（自动跳过同名菜品，只新增不覆盖已有菜品）
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={importing}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/70 rounded-full transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleInputChange}
          className="hidden"
        />

        {importResult ? (
          /* 完成态 */
          <div className="py-6 px-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-black text-emerald-900">菜品导入完成</h4>
              <p className="text-xs text-emerald-800 mt-1">{importResult.message}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto pt-2">
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200">
                <div className="text-[10px] text-neutral-500">新增入库</div>
                <div className="text-base font-black text-emerald-600">
                  {importResult.data?.created ?? 0} 道
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200">
                <div className="text-[10px] text-neutral-500">同名跳过</div>
                <div className="text-base font-black text-amber-600">
                  {importResult.data?.skipped ?? 0} 道
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200">
                <div className="text-[10px] text-neutral-500">落地/复用图片</div>
                <div className="text-base font-black text-sky-600">
                  {(importResult.data?.embeddedImageCount ?? 0) +
                    (importResult.data?.reusedImageCount ?? 0)}{' '}
                  张
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-neutral-200">
                <div className="text-[10px] text-neutral-500">外部图链</div>
                <div className="text-base font-black text-neutral-700">
                  {importResult.data?.externalImageCount ?? 0} 张
                </div>
              </div>
            </div>
          </div>
        ) : !parsed ? (
          /* 上传选文件区 */
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-neutral-300 bg-neutral-50/70 hover:border-emerald-400 hover:bg-emerald-50/30'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-neutral-800">
              点击选择菜品 JSON 文件，或将文件拖拽到此处
            </p>
            <p className="text-[11px] text-neutral-500 mt-1.5">
              单次最多支持 {MAX_DISHES} 道菜品、文件不超过 30MB；导入将追加到当前门店（{tenantId}）
            </p>
            {fileName && parseError && (
              <p className="text-[11px] text-neutral-500 mt-2 font-mono">
                已选文件：{fileName} ({(fileSize / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        ) : (
          /* 解析成功预览区 */
          <>
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="font-bold text-neutral-900 flex items-center space-x-2">
                  <FileJson className="w-4 h-4 text-emerald-600" />
                  <span>{fileName}</span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    ({(fileSize / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3">
                  {parsed.source_tenant && <span>来源门店：{parsed.source_tenant}</span>}
                  {parsed.exported_at && (
                    <span>
                      导出时间：{new Date(parsed.exported_at).toLocaleString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={resetFileState}
                disabled={importing}
                className="px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重选文件</span>
              </button>
            </div>

            {/* 汇总统计卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white p-3 rounded-xl border border-neutral-200">
                <span className="text-[10px] text-neutral-500 block">文件菜品总数</span>
                <span className="text-base font-black text-neutral-900">{stats.total} 道</span>
              </div>
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-bold block">预计新增入库</span>
                <span className="text-base font-black text-emerald-700">
                  {stats.willCreate} 道
                </span>
              </div>
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                <span className="text-[10px] text-amber-700 font-bold block">同名自动跳过</span>
                <span className="text-base font-black text-amber-700">{stats.duplicate} 道</span>
              </div>
              <div className="bg-sky-50/70 p-3 rounded-xl border border-sky-200">
                <span className="text-[10px] text-sky-700 font-bold block">内嵌图片 / 外链</span>
                <span className="text-sm font-black text-sky-800">
                  {stats.embeddedImages} 张 / {stats.externalImages} 条
                </span>
              </div>
            </div>

            {stats.externalImages > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  检测到 {stats.externalImages} 道菜品使用了外部 http(s) 图片链接，将原样保留。若原外链失效可能出现裂图；建议导出时使用本地上传图并勾选「含图片」。
                </span>
              </div>
            )}

            {/* 预览表格 */}
            <div className="border border-neutral-200 rounded-2xl overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-14">图片</th>
                      <th className="py-2.5 px-3">菜品名称</th>
                      <th className="py-2.5 px-3 w-20">价格</th>
                      <th className="py-2.5 px-3 w-24">分类</th>
                      <th className="py-2.5 px-3 w-24 text-right">导入处理</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {parsed.dishes.map((dish, idx) => {
                      const dName = String(dish?.name || '').trim();
                      const dPrice = Number(dish?.price);
                      const isInvalid = !dName || !Number.isFinite(dPrice) || dPrice < 0;
                      const isDup = !isInvalid && existingNames.has(dName);
                      const previewSrc = resolvePreviewImage(dish?.image);

                      return (
                        <tr
                          key={`${dName}-${idx}`}
                          className={isDup || isInvalid ? 'bg-neutral-50/70 opacity-70' : ''}
                        >
                          <td className="py-2 px-3">
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
                              {previewSrc ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={previewSrc}
                                  alt={dName}
                                  className="w-full h-full object-contain p-0.5"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-neutral-300" />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-bold text-neutral-900">
                              {dName || <span className="text-rose-500">(缺少菜名)</span>}
                            </div>
                            {dish.taste_options && (
                              <div className="text-[10px] text-amber-700 mt-0.5 truncate max-w-[200px]">
                                口味：{dish.taste_options}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-rose-600">
                            {Number.isFinite(dPrice) ? `¥${dPrice.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2 px-3 text-neutral-600">{dish.category || '默认'}</td>
                          <td className="py-2 px-3 text-right">
                            {isInvalid ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                数据无效
                              </span>
                            ) : isDup ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                同名跳过
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                即将新增
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {(parseError || importError) && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{parseError || importError}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between space-x-2.5 shrink-0">
        <span className="text-[11px] text-neutral-400 hidden sm:block">
          {importResult
            ? '菜品列表已自动刷新'
            : parsed
            ? `预计新增 ${stats.willCreate} 道，同名跳过 ${stats.duplicate} 道`
            : '仅新增门店缺失的菜品，不会修改或覆盖已有菜品'}
        </span>
        <div className="flex items-center space-x-2.5 ml-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            {importResult ? '完成关闭' : '取消'}
          </button>
          {!importResult && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parsed || importing || stats.willCreate === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 cursor-pointer"
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileUp className="w-3.5 h-3.5" />
              )}
              <span>
                {importing
                  ? '正在导入...'
                  : stats.willCreate > 0
                  ? `确认导入 (${stats.willCreate} 道)`
                  : '无可新增菜品'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JsonDishImportModal(props: JsonDishImportModalProps) {
  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <JsonDishImportInner
        onClose={props.onClose}
        onSuccess={props.onSuccess}
        tenantId={props.tenantId || 'default'}
        existingDishes={props.existingDishes || []}
      />
    </div>
  );
}
