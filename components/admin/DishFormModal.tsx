'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Upload, Check, Image as ImageIcon } from 'lucide-react';
import { Dish } from '@/types';

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setImage(data.url);
      } else {
        setErrorMsg(data.error || '上传图片失败');
      }
    } catch (err: any) {
      setErrorMsg('图片上传异常: ' + (err?.message || ''));
    } finally {
      setUploading(false);
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
          <label className="block font-bold text-neutral-700 mb-1">菜品特色描述</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="介绍菜品主料、风味特点、辣度口感等..."
            className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Image Selection & Upload */}
        <div>
          <label className="block font-bold text-neutral-700 mb-1">
            菜品图片（可上传本地图片、输入图片链接或选择下方精美图库）
          </label>

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
              <div className="flex items-center space-x-2">
                <label className="cursor-pointer px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium flex items-center space-x-1.5 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? '上传中...' : '上传本地图片'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                <span className="text-[11px] text-neutral-400">支持 jpg/png/webp</span>
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
                  onClick={() => setImage(preset.url)}
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
