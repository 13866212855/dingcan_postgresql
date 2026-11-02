'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Sparkles,
  Wand2,
  Loader2,
  ImageIcon,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ImagePlus,
} from 'lucide-react';
import { Dish } from '@/types';

interface SmartDishBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId?: string;
  existingDishes?: Dish[];
}

const DEFAULT_CATEGORIES = ['特色热炒', '经典主食', '养生靓汤', '开胃凉菜', '酒水饮料'];

const EXAMPLE_TEXT = `烤鸭腿6元
卤鸭腿6元
把子肉6元
樱桃肉6元
土豆红烧肉6元
杭椒肉柳6元
酥肉5元
狮子头5元
酱鸭5元
青椒肉丝4元
杭椒炒鸡蛋4元
西蓝花3.5元
番茄鸡蛋3.5元
青椒炒鸡蛋3.5元
花菜炒肉丝4元
猪脚饭13元
水饺13元（小份）
水饺15元（大份）
面条13元（口味自己注明）`;

interface BatchRow {
  key: string;
  include: boolean;
  name: string;
  price: string;
  category: string;
  description: string;
  image: string;
  imgStatus: 'none' | 'generating' | 'done' | 'error';
  imgError: string;
  existsAlready: boolean;
}

function SmartBatchInner({
  onClose,
  onSuccess,
  tenantId = 'default',
  existingDishes = [],
}: Omit<SmartDishBatchModalProps, 'isOpen'>) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parseSourceNote, setParseSourceNote] = useState('');
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [genAllRunning, setGenAllRunning] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const closedRef = useRef(false);

  const existingNames = useMemo(
    () => new Set(existingDishes.map((d) => d.name.trim())),
    [existingDishes]
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    existingDishes.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDishes, rows.length]);

  const updateRow = (key: string, patch: Partial<BatchRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  // ---------- 第一步：AI 解析文本 ----------
  const handleParse = async () => {
    const text = rawText.trim();
    if (!text) {
      setParseError('请先粘贴或输入菜品清单文本');
      return;
    }
    setParsing(true);
    setParseError('');
    setParseSourceNote('');
    try {
      const res = await fetch('/api/dishes/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse',
          text,
          tenantId,
          existingCategories: categoryOptions,
        }),
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) {
        setParseError(data.error || 'AI 解析失败，请稍后重试');
        return;
      }
      if (data.data.length === 0) {
        setParseError('未能从文本中识别出菜品，请确认每行一条（如：烤鸭腿6元）');
        return;
      }

      const parsedRows: BatchRow[] = data.data.map((it: any, idx: number) => {
        const name = String(it.name || '').trim();
        const exists = existingNames.has(name);
        return {
          key: `row-${Date.now()}-${idx}`,
          include: !exists,
          name,
          price: String(it.price ?? ''),
          category: String(it.category || '特色热炒').trim() || '特色热炒',
          description: String(it.description || '').trim(),
          image: '',
          imgStatus: 'none',
          imgError: '',
          existsAlready: exists,
        };
      });

      setRows(parsedRows);
      setParseSourceNote(
        data.source === 'llm'
          ? '大模型解析完成，已智能识别菜名、单价、分类并生成美食描述'
          : data.source === 'merged'
            ? '大模型解析完成，个别未识别行已由本地解析自动补齐'
            : '大模型暂不可用，已自动降级为本地智能解析'
      );
      setStep('review');
    } catch (err: any) {
      setParseError('解析请求异常: ' + (err?.message || ''));
    } finally {
      setParsing(false);
    }
  };

  // ---------- 第二步：生成配图 ----------
  const generateImageForRow = async (row: BatchRow): Promise<boolean> => {
    updateRow(row.key, { imgStatus: 'generating', imgError: '' });
    try {
      const res = await fetch('/api/dishes/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_image', dishName: row.name, tenantId }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        updateRow(row.key, { image: data.url, imgStatus: 'done' });
        return true;
      }
      updateRow(row.key, { imgStatus: 'error', imgError: data.error || '生成失败' });
      return false;
    } catch (err: any) {
      updateRow(row.key, { imgStatus: 'error', imgError: err?.message || '请求异常' });
      return false;
    }
  };

  // 一键生成全部配图：严格逐张串行，避免并发触发限流
  const handleGenerateAll = async () => {
    if (genAllRunning) return;
    const targets = rows.filter((r) => r.include && r.imgStatus !== 'done' && r.name.trim());
    if (targets.length === 0) return;

    setGenAllRunning(true);
    setGenProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      if (closedRef.current) break;
      await generateImageForRow(targets[i]);
      setGenProgress({ done: i + 1, total: targets.length });
    }
    setGenAllRunning(false);
  };

  // ---------- 第三步：确认批量添加 ----------
  const handleConfirmAdd = async () => {
    const payload = rows
      .filter((r) => r.include && r.name.trim() && parseFloat(r.price) > 0)
      .map((r) => ({
        name: r.name.trim(),
        price: parseFloat(r.price),
        category: r.category.trim() || '特色热炒',
        description: r.description.trim(),
        image: r.image,
        status: 1,
      }));

    if (payload.length === 0) {
      setSubmitError('没有可添加的菜品：请勾选至少一道有效菜品（名称与价格不能为空）');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/dishes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dishes: payload, tenantId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `批量添加完成：成功 ${data.data?.created ?? payload.length} 道`);
        onSuccess();
        onClose();
      } else {
        setSubmitError(data.error || '批量添加失败');
      }
    } catch (err: any) {
      setSubmitError('批量添加请求异常: ' + (err?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const includedCount = rows.filter((r) => r.include && r.name.trim() && parseFloat(r.price) > 0).length;
  const withImageCount = rows.filter((r) => r.image).length;
  const genTargetCount = rows.filter((r) => r.include && r.imgStatus !== 'done' && r.name.trim()).length;

  const handleClose = () => {
    closedRef.current = true;
    onClose();
  };

  return (
    <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white flex items-center justify-center font-bold">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-neutral-900 text-base">智能一键添加多种菜品</h3>
            <p className="text-[11px] text-neutral-400">粘贴菜单文本 → AI 解析菜名价格 → AI 生成配图 → 一键入库</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
        {step === 'input' ? (
          <>
            <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl text-violet-900 leading-relaxed">
              <p className="font-bold flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span>使用说明</span>
              </p>
              <p className="mt-1 text-[11px]">
                每行输入一道菜（菜名 + 价格），支持小数价与括注（如「水饺13元（小份）」「面条13元（口味自己注明）」。
                点击「AI 智能解析」后，大模型将自动识别每道菜的名称与单价、匹配分类、撰写美食描述，随后可一键生成配套菜品图，确认后批量入库。
              </p>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1.5">
                菜品清单文本 <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={12}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={EXAMPLE_TEXT}
                className="w-full px-3.5 py-3 border border-neutral-300 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-sm leading-7 font-mono"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[11px] text-neutral-400">
                  已输入 {rawText.split(/\r?\n/).filter((l) => l.trim()).length} 行
                </span>
                <button
                  type="button"
                  onClick={() => setRawText(EXAMPLE_TEXT)}
                  className="text-[11px] text-violet-600 hover:text-violet-700 hover:underline font-medium"
                >
                  填入示例清单
                </button>
              </div>
            </div>

            {parseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 解析结果统计 */}
            <div className="p-3 bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-200/70 rounded-2xl text-neutral-800 flex items-start justify-between space-x-3">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">{parseSourceNote}</p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    共识别 {rows.length} 道菜 · 已勾选 {includedCount} 道
                    {rows.some((r) => r.existsAlready) ? ` · ${rows.filter((r) => r.existsAlready).length} 道与现有菜品同名（默认不勾选）` : ''}
                    {' · '}已生成配图 {withImageCount} 张
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-600 font-medium shrink-0"
              >
                返回修改文本
              </button>
            </div>

            {/* 配图生成控制条 */}
            <div className="p-3 bg-neutral-50 border border-neutral-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2 text-neutral-600">
                <ImagePlus className="w-4 h-4 text-indigo-500" />
                <span className="text-[11px]">
                  AI 配图按菜名逐张生成并自动转存云端永久保存
                  {genAllRunning && (
                    <span className="font-bold text-indigo-700">
                      {' '}（{genProgress.done}/{genProgress.total} 生成中，请稍候...）
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateAll}
                disabled={genAllRunning || genTargetCount === 0}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold shadow-xs flex items-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {genAllRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                <span>{genAllRunning ? `配图生成中 ${genProgress.done}/${genProgress.total}` : genTargetCount === 0 ? '配图已全部生成' : `一键生成全部配图 (${genTargetCount})`}</span>
              </button>
            </div>

            {/* 可编辑菜品表格 */}
            <div className="border border-neutral-200/80 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                      <th className="py-2.5 px-3 w-10">选</th>
                      <th className="py-2.5 px-3 w-[86px]">配图</th>
                      <th className="py-2.5 px-3">菜名</th>
                      <th className="py-2.5 px-3 w-20">价格</th>
                      <th className="py-2.5 px-3 w-32">分类</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">描述（可编辑）</th>
                      <th className="py-2.5 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {rows.map((row) => (
                      <tr
                        key={row.key}
                        className={row.include ? 'bg-white hover:bg-neutral-50/60' : 'bg-neutral-50/60'}
                      >
                        <td className="py-2.5 px-3 align-middle">
                          <input
                            type="checkbox"
                            checked={row.include}
                            onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                            className="w-4 h-4 rounded text-violet-500 focus:ring-violet-400 border-neutral-300 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <button
                            type="button"
                            onClick={() => !genAllRunning && !row.imgStatus.includes('generating') && row.name.trim() && generateImageForRow(row)}
                            disabled={genAllRunning || row.imgStatus === 'generating' || !row.name.trim()}
                            title={row.image ? '点击重新生成配图' : '点击用 AI 生成此菜配图'}
                            className={`relative block w-16 h-16 rounded-xl overflow-hidden border transition-colors ${
                              row.imgStatus === 'error'
                                ? 'border-rose-300 bg-rose-50'
                                : row.image
                                  ? 'border-emerald-300'
                                  : 'border-neutral-200 bg-neutral-100 hover:border-violet-400'
                            } disabled:cursor-not-allowed`}
                          >
                            {row.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.image}
                                alt={row.name}
                                className="w-full h-full object-contain p-0.5 bg-neutral-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : row.imgStatus === 'generating' ? (
                              <Loader2 className="w-5 h-5 text-violet-500 animate-spin absolute inset-0 m-auto" />
                            ) : row.imgStatus === 'error' ? (
                              <span className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 px-1">
                                <RefreshCw className="w-4 h-4" />
                                <span className="text-[9px] mt-0.5 leading-tight">重试</span>
                              </span>
                            ) : (
                              <span className="absolute inset-0 flex flex-col items-center justify-center text-violet-500">
                                <ImageIcon className="w-4 h-4" />
                                <span className="text-[9px] mt-0.5">AI配图</span>
                              </span>
                            )}
                          </button>
                          {row.imgStatus === 'error' && row.imgError && (
                            <span className="block text-[9px] text-rose-500 mt-1 leading-tight px-0.5">{row.imgError.slice(0, 40)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(row.key, { name: e.target.value })}
                            className="w-full min-w-[110px] px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500 font-bold"
                          />
                          {row.existsAlready && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[9px] font-bold">
                              菜品库已有同名，勾选将创建重复菜品
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.price}
                            onChange={(e) => updateRow(row.key, { price: e.target.value })}
                            className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500 font-bold text-rose-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-middle">
                          <input
                            type="text"
                            list="smart-batch-categories"
                            value={row.category}
                            onChange={(e) => updateRow(row.key, { category: e.target.value })}
                            className="w-full px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-middle hidden md:table-cell">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateRow(row.key, { description: e.target.value })}
                            placeholder="AI 已生成，可编辑"
                            className="w-full min-w-[160px] px-2 py-1.5 border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-neutral-600"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                            title="移除此行"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="smart-batch-categories">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between space-x-2.5 shrink-0">
        <span className="text-[11px] text-neutral-400 hidden sm:block">
          {step === 'review' ? `将添加 ${includedCount} 道菜品（未勾选的不会入库）` : '支持从记事本 / 菜单照片识别结果直接粘贴'}
        </span>
        <div className="flex items-center space-x-2.5 ml-auto">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
          >
            取消
          </button>
          {step === 'input' ? (
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing}
              className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 transition-colors shadow-xs disabled:opacity-60 flex items-center space-x-1.5"
            >
              {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{parsing ? 'AI 解析中...' : 'AI 智能解析'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={submitting || includedCount === 0}
              className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs disabled:bg-neutral-300 disabled:cursor-not-allowed"
            >
              {submitting ? '正在添加...' : `确认添加 (${includedCount} 道)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SmartDishBatchModal(props: SmartDishBatchModalProps) {
  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <SmartBatchInner
        onClose={props.onClose}
        onSuccess={props.onSuccess}
        tenantId={props.tenantId || 'default'}
        existingDishes={props.existingDishes || []}
      />
    </div>
  );
}
