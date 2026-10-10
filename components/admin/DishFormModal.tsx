'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Upload, Check, Image as ImageIcon, Cloud, Loader2, Sparkles, Zap, Brain, Crop as CropIcon, Eye } from 'lucide-react';
import { Dish } from '@/types';
import ImageCropModal, { AspectRatioType } from './ImageCropModal';

interface DishFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishToEdit: Dish | null;
  onSuccess: () => void;
}

const PRESET_DISH_IMAGES = [
  { name: '红烧肉', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80' },
  { name: '辣子鸡/鸡丁', url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80' },
  { name: '清炒时蔬', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80' },
  { name: '麻辣豆腐', url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&auto=format&fit=crop&q=80' },
  { name: '凉菜卤味', url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80' },
  { name: '爽口黄瓜', url: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80' },
  { name: '养生排骨汤', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80' },
  { name: '黄金炒饭', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80' },
  { name: '手工饺子', url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80' },
  { name: '冰镇解暑饮', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80' },
];

const DEFAULT_CATEGORIES = ['特色热炒', '经典主食', '养生靓汤', '开胃凉菜', '酒水饮料'];

const PRESET_TASTE_OPTIONS = [
  '微辣',
  '不辣',
  '免葱花',
  '不要香菜',
  '少盐少油',
  '米饭先上',
];

interface DishFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  dishToEdit: Dish | null;
  onSuccess: () => void;
  tenantId?: string;
}

function DishFormInner({
  dishToEdit,
  onClose,
  onSuccess,
  tenantId = 'default',
}: {
  dishToEdit: Dish | null;
  onClose: () => void;
  onSuccess: () => void;
  tenantId?: string;
}) {
  const [name, setName] = useState(dishToEdit?.name || '');
  const [price, setPrice] = useState(dishToEdit ? String(dishToEdit.price) : '');
  const [category, setCategory] = useState(() => {
    if (!dishToEdit) return '特色热炒';
    return DEFAULT_CATEGORIES.includes(dishToEdit.category) ? dishToEdit.category : 'custom';
  });
  const [customCategory, setCustomCategory] = useState(() => {
    if (!dishToEdit) return '';
    return DEFAULT_CATEGORIES.includes(dishToEdit.category) ? '' : dishToEdit.category;
  });
  const [description, setDescription] = useState(dishToEdit?.description || '');
  const [image, setImage] = useState(dishToEdit?.image || PRESET_DISH_IMAGES[0].url);
  const [status, setStatus] = useState<number>(dishToEdit ? dishToEdit.status : 1);

  // 餐品专属口味备注选项（复选框）
  const [allTasteOptions, setAllTasteOptions] = useState<string[]>(() => {
    const list = [...PRESET_TASTE_OPTIONS];
    if (dishToEdit?.taste_options) {
      const existing = dishToEdit.taste_options.split(',').map((s) => s.trim()).filter(Boolean);
      existing.forEach((item) => {
        if (!list.includes(item)) list.push(item);
      });
    }
    return list;
  });

  const [selectedTastes, setSelectedTastes] = useState<string[]>(() => {
    if (!dishToEdit?.taste_options) return [];
    return dishToEdit.taste_options.split(',').map((s) => s.trim()).filter(Boolean);
  });

  const [customTasteInput, setCustomTasteInput] = useState('');

  const toggleTaste = (taste: string) => {
    setSelectedTastes((prev) =>
      prev.includes(taste) ? prev.filter((t) => t !== taste) : [...prev, taste]
    );
  };

  const handleAddCustomTaste = () => {
    const trimmed = customTasteInput.trim();
    if (!trimmed) return;
    if (!allTasteOptions.includes(trimmed)) {
      setAllTasteOptions((prev) => [...prev, trimmed]);
    }
    if (!selectedTastes.includes(trimmed)) {
      setSelectedTastes((prev) => [...prev, trimmed]);
    }
    setCustomTasteInput('');
  };

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [optimizationNotice, setOptimizationNotice] = useState<string>('');
  const [aiSuccessNotice, setAiSuccessNotice] = useState<string>('');
  const [aiGenerating, setAiGenerating] = useState(false);

  // 统一应用 AI 视觉大模型推断出的菜品信息（名称、单价、分类、特色描述、口味）
  const applyAiAnalysisResult = (ai: any) => {
    if (!ai) return;

    // 1. 菜品名称
    if (ai.dish_name_suggestion) {
      setName(ai.dish_name_suggestion);
    }

    // 2. 单价 (元) 必须自动填入
    if (ai.price !== undefined && ai.price !== null) {
      setPrice(String(ai.price));
    } else if (ai.recommended_price) {
      const p = String(ai.recommended_price).replace(/[^0-9.]/g, '');
      if (p) setPrice(p);
    }

    // 3. 默认菜品分类
    if (ai.category_suggestion) {
      const rawCat = String(ai.category_suggestion).trim();
      if (DEFAULT_CATEGORIES.includes(rawCat)) {
        setCategory(rawCat);
        setCustomCategory('');
      } else {
        // 模糊或语义匹配
        const found = DEFAULT_CATEGORIES.find(
          (c) =>
            c.includes(rawCat) ||
            rawCat.includes(c) ||
            (rawCat.includes('炒') && c === '特色热炒') ||
            ((rawCat.includes('主食') || rawCat.includes('饭') || rawCat.includes('面') || rawCat.includes('粉')) &&
              c === '经典主食') ||
            ((rawCat.includes('汤') || rawCat.includes('羹')) && c === '养生靓汤') ||
            ((rawCat.includes('凉') || rawCat.includes('卤') || rawCat.includes('拌')) && c === '开胃凉菜') ||
            ((rawCat.includes('饮') || rawCat.includes('酒') || rawCat.includes('茶')) && c === '酒水饮料')
        );
        if (found) {
          setCategory(found);
          setCustomCategory('');
        } else {
          setCategory('custom');
          setCustomCategory(rawCat);
        }
      }
    }

    // 4. 菜品特色描述
    if (ai.appetizing_description) {
      setDescription(ai.appetizing_description);
    }

    // 5. 口味选项自动勾选
    if (Array.isArray(ai.taste_tags) && ai.taste_tags.length > 0) {
      setSelectedTastes((prev) => {
        const next = new Set(prev);
        for (const tag of ai.taste_tags) {
          const t = String(tag);
          if (PRESET_TASTE_OPTIONS.includes(t)) {
            next.add(t);
          } else if (t.includes('微辣')) next.add('微辣');
          else if (t.includes('不辣')) next.add('不辣');
          else if (t.includes('免葱')) next.add('免葱花');
          else if (t.includes('香菜')) next.add('不要香菜');
          else if (t.includes('少盐') || t.includes('少油') || t.includes('清淡')) next.add('少盐少油');
          else if (t.includes('米饭')) next.add('米饭先上');
        }
        return Array.from(next);
      });
    }

    // 6. 成功横幅提醒
    const finalName = ai.dish_name_suggestion || name || '识别菜品';
    const finalPrice = ai.price || ai.recommended_price || '';
    const finalCat = ai.category_suggestion || '精选菜肴';
    setAiSuccessNotice(
      `✨ AI 大脑已智能推断菜名【${finalName}】、单价【${finalPrice ? `¥${finalPrice}` : '38元'}】、分类【${finalCat}】及特色描述，已自动填入！`
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    setOptimizationNotice('');
    setAiSuccessNotice('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'dish');
      formData.append('optimize', '1');
      formData.append('tenant', tenantId || 'default');
      formData.append('ai_analyze', '1'); // 始终触发 AI 视觉识别与智能推算
      formData.append('existing_categories', DEFAULT_CATEGORIES.join(','));
      if (name.trim()) {
        formData.append('dish_name_hint', name.trim());
      }
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setImage(data.url);
        if (data.optimization?.is_optimized) {
          const origKb = Math.round(data.optimization.original_size / 1024);
          const optKb = Math.round(data.optimization.optimized_size / 1024);
          const cropTxt = data.optimization.is_cropped ? '已自动聚焦居中裁剪 · ' : '';
          setOptimizationNotice(`AI 智能优化：${cropTxt}原图 ${origKb}KB 压缩至 ${optKb}KB (体积精简 ${data.optimization.saved_percentage})，已转为极速 WebP，手机端秒开！`);
        }
        if (data.ai_analysis) {
          applyAiAnalysisResult(data.ai_analysis);
        } else if (data.ai_error) {
          setErrorMsg('图片已成功上传并优化，但AI大模型分析提示：' + data.ai_error + '。您也可以点击右侧【AI看图识别】重新触发。');
        }
      } else {
        setErrorMsg(data.error || '上传图片失败');
      }
    } catch (err: any) {
      setErrorMsg('图片上传异常: ' + (err?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  // AI 智能文案撰写
  const handleGenerateAiDescription = async () => {
    if (!name.trim()) {
      setErrorMsg('请先填写菜品名称，或直接上传菜品图片让 AI 大脑自动识别推断！');
      return;
    }
    setAiGenerating(true);
    setErrorMsg('');
    try {
      const finalCategory = category === 'custom' ? customCategory.trim() : category;
      const res = await fetch('/api/admin/llm/dish-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_text',
          dishName: name.trim(),
          category: finalCategory,
          currentDescription: description.trim(),
          tenantId: tenantId || 'default',
        }),
      });
      const json = await res.json();
      if (json.success && json.description) {
        setDescription(json.description);
        setAiSuccessNotice(`✨ AI 已为【${name.trim()}】润色撰写了专属垂涎美食介绍！`);
      } else {
        setErrorMsg(json.error || 'AI 文案生成失败');
      }
    } catch (err: any) {
      setErrorMsg('调用 AI 大脑异常: ' + (err?.message || ''));
    } finally {
      setAiGenerating(false);
    }
  };

  // AI 视觉看图识别
  const handleAnalyzeAiImage = async () => {
    if (!image) {
      setErrorMsg('请先选择或上传菜品图片');
      return;
    }
    setAiGenerating(true);
    setErrorMsg('');
    setAiSuccessNotice('');
    try {
      const res = await fetch('/api/admin/llm/dish-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageUrl: image,
          dishName: name.trim(),
          tenantId: tenantId || 'default',
          existingCategories: DEFAULT_CATEGORIES,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        applyAiAnalysisResult(json.data);
      } else {
        setErrorMsg(json.error || 'AI 视觉识别失败');
      }
    } catch (err: any) {
      setErrorMsg('AI 视觉分析异常: ' + (err?.message || ''));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('请填写菜品名称');
      return;
    }
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMsg('请填写正确的价格');
      return;
    }

    const finalCategory = category === 'custom' ? customCategory.trim() : category;
    if (!finalCategory) {
      setErrorMsg('请选择或填写菜品分类');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        price: numPrice,
        category: finalCategory,
        description: description.trim(),
        image: image || PRESET_DISH_IMAGES[0].url,
        status,
        taste_options: selectedTastes.join(','),
        tenantId,
      };

      const url = dishToEdit
        ? `/api/dishes/${dishToEdit.id}?tenant=${encodeURIComponent(tenantId)}`
        : `/api/dishes?tenant=${encodeURIComponent(tenantId)}`;
      const method = dishToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || '保存菜品失败');
      }
    } catch (err: any) {
      setErrorMsg('提交失败: ' + (err?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
            <ImageIcon className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-neutral-900 text-base">
            {dishToEdit ? '编辑菜品' : '添加新菜品'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* AI 分析中实时反馈 */}
        {uploading && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center space-x-2.5 animate-pulse">
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
            <div>
              <p className="font-bold text-amber-900">大模型正在对图片进行智能裁剪压缩与看图识别...</p>
              <p className="text-[11px] text-amber-700 mt-0.5">将自动推断菜品名称、预估单价、匹配默认分类并撰写特色美食描述</p>
            </div>
          </div>
        )}

        {/* AI 智能推断成功横幅 */}
        {aiSuccessNotice && (
          <div className="p-3 bg-gradient-to-r from-amber-50 to-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-900 text-xs flex items-start justify-between space-x-2 animate-in fade-in zoom-in-95 duration-200 shadow-xs">
            <div className="flex items-start space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-neutral-800">AI 大脑看图智能推断完成</p>
                <p className="text-neutral-600 mt-0.5 leading-relaxed">{aiSuccessNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiSuccessNotice('')}
              className="text-neutral-400 hover:text-neutral-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dish Name and Price */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block font-bold text-neutral-700 mb-1">
              菜品名称 <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-dish-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：招牌水煮牛肉"
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="block font-bold text-neutral-700 mb-1">
              单价 (元) <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-dish-price"
              type="number"
              step="0.1"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="例如：38"
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block font-bold text-neutral-700 mb-1">
            菜品分类 <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setCustomCategory('');
                }}
                className={`px-3 py-1.5 rounded-lg border transition-colors ${
                  category === cat
                    ? 'bg-amber-500 text-white border-amber-500 font-bold'
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCategory('custom')}
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                category === 'custom'
                  ? 'bg-amber-500 text-white border-amber-500 font-bold'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              + 自定义分类
            </button>
          </div>
          {category === 'custom' && (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="请输入新分类名称（例如：烧烤炸串）"
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-bold text-neutral-700">菜品特色描述</label>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleGenerateAiDescription}
                disabled={aiGenerating}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors flex items-center space-x-1 cursor-pointer border border-indigo-200"
                title="调用大模型自动撰写令人垂涎欲滴的专业美食文案"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{aiGenerating ? 'AI思考中...' : 'AI帮写简介'}</span>
              </button>
              {image && (
                <button
                  type="button"
                  onClick={handleAnalyzeAiImage}
                  disabled={aiGenerating}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors flex items-center space-x-1 cursor-pointer border border-amber-200"
                  title="让AI视觉大脑看图识别并提炼美味特点"
                >
                  <Brain className="w-3.5 h-3.5 text-amber-600" />
                  <span>AI看图识别</span>
                </button>
              )}
            </div>
          </div>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="介绍菜品主料、风味特点、辣度口感等，或点击右上角【AI帮写简介】自动生成..."
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-sm"
          />
        </div>

        {/* Image Selection & Upload */}
        <div>
          <label className="block font-bold text-neutral-700 mb-1">
            菜品图片（可上传本地图片、输入图片链接或选择下方精美图库）
          </label>

          {/* AI 优化提示条 */}
          {optimizationNotice && (
            <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-1.5 animate-in fade-in duration-200">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{optimizationNotice}</span>
            </div>
          )}

          {/* Current Image Preview & Upload Input */}
          <div className="flex gap-3 items-center mb-3">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0">
              {image ? (
                <Image
                  src={image}
                  alt="菜品图片"
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-400">无图</div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center flex-wrap gap-2">
                <label className="cursor-pointer px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium flex items-center space-x-1.5 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploading ? 'AI 视觉分析与优化中...' : '上传本地图片'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                <span className="text-[11px] text-neutral-400">支持 jpg/png/webp · 自动压缩与AI推断</span>
                {image && (image.includes('cloudinary.com') || image.includes('res.cloudinary')) && (
                  <span className="inline-flex items-center text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Cloud className="w-3 h-3 mr-1 text-emerald-600" />
                    Cloudinary 云端直链 (永久防丢)
                  </span>
                )}
              </div>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="或粘贴网络图片 URL (例如 https://...)"
                className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Preset Library */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <span className="text-[11px] font-bold text-neutral-500 block mb-2">
              快速选用高清美食图库（点击即选）：
            </span>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_DISH_IMAGES.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setImage(preset.url);
                    if (!name.trim()) {
                      setName(preset.name);
                    }
                  }}
                  className={`relative rounded-lg overflow-hidden border transition-all aspect-square group ${
                    image === preset.url
                      ? 'ring-2 ring-amber-500 border-amber-500'
                      : 'border-neutral-200 hover:border-amber-400'
                  }`}
                >
                  <Image
                    src={preset.url}
                    alt={preset.name}
                    fill
                    className="object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] text-center py-0.5 truncate px-0.5">
                    {preset.name}
                  </div>
                  {image === preset.url && (
                    <div className="absolute top-1 right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-xs">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dish Taste Options (Checkbox configuration) */}
        <div className="pt-3 pb-1 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <label className="block font-bold text-neutral-800 text-xs">
                餐品口味/做法定制选项（选填，复选框配置）
              </label>
              <span className="text-[11px] text-neutral-400">
                勾选该餐品支持的口味。若都不勾选，前端购物车中该餐品将不显示任何口味备注区块。
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedTastes([...allTasteOptions])}
                className="text-amber-600 hover:text-amber-700 hover:underline font-medium"
              >
                全选
              </button>
              <span className="text-neutral-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedTastes([])}
                className="text-neutral-500 hover:text-neutral-700 hover:underline font-medium"
              >
                清空
              </button>
            </div>
          </div>

          {/* Taste Checkboxes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {allTasteOptions.map((opt) => {
              const isChecked = selectedTastes.includes(opt);
              return (
                <label
                  key={opt}
                  className={`flex items-center space-x-2 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-amber-50/80 border-amber-400 text-amber-950 font-bold shadow-2xs'
                      : 'bg-neutral-50/60 border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTaste(opt)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 border-neutral-300 cursor-pointer"
                  />
                  <span className="text-xs">{opt}</span>
                </label>
              );
            })}
          </div>

          {/* Add custom taste option */}
          <div className="flex items-center space-x-2 mt-2.5">
            <input
              type="text"
              value={customTasteInput}
              onChange={(e) => setCustomTasteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomTaste();
                }
              }}
              placeholder="添加自定义口味（如：少糖、去冰、免蒜），回车添加"
              className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="button"
              onClick={handleAddCustomTaste}
              disabled={!customTasteInput.trim()}
              className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold disabled:opacity-40 transition-colors shrink-0"
            >
              + 添加选项
            </button>
          </div>
        </div>

        {/* Status (Shelf status) */}
        <div className="pt-2 border-t border-neutral-100">
          <label className="block font-bold text-neutral-700 mb-1.5">上架状态</label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={1}
                checked={status === 1}
                onChange={() => setStatus(1)}
                className="text-amber-500 focus:ring-amber-400"
              />
              <span className="text-emerald-700 font-bold">上架中（在售，顾客可点）</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="status"
                value={0}
                checked={status === 0}
                onChange={() => setStatus(0)}
                className="text-amber-500 focus:ring-amber-400"
              />
              <span className="text-neutral-500 font-medium">下架（沽清/停售，顾客不可选）</span>
            </label>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end space-x-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
        >
          取消
        </button>
        <button
          id="btn-save-dish"
          type="button"
          onClick={handleSubmit}
          disabled={submitting || uploading}
          className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-xs disabled:bg-neutral-300"
        >
          {submitting ? '保存中...' : dishToEdit ? '确认修改' : '确认添加'}
        </button>
      </div>
    </div>
  );
}

export default function DishFormModal({
  isOpen,
  onClose,
  dishToEdit,
  onSuccess,
  tenantId = 'default',
}: DishFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <DishFormInner
        key={dishToEdit ? `edit-${dishToEdit.id}` : 'new-dish'}
        dishToEdit={dishToEdit}
        onClose={onClose}
        onSuccess={onSuccess}
        tenantId={tenantId}
      />
    </div>
  );
}
