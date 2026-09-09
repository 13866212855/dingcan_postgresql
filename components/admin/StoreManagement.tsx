'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Store,
  Upload,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Utensils,
  Image as ImageIcon,
  ExternalLink,
  Eye,
  Info,
} from 'lucide-react';
import { AppSettings } from '@/types';

// 精选餐厅预设高品质图标库，方便掌柜一键选用
const PRESET_LOGOS = [
  {
    name: '精美砂锅煲',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '经典家常炒菜',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '中式大厨掌勺',
    url: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '传统特色小吃',
    url: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '养生汤饮靓汤',
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=160&auto=format&fit=crop&q=80',
  },
  {
    name: '鲜香特色面馆',
    url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=160&auto=format&fit=crop&q=80',
  },
];

interface StoreManagementProps {
  tenantId?: string;
  onStoreUpdated?: (settings: AppSettings) => void;
}

export default function StoreManagement({ tenantId = 'default', onStoreUpdated }: StoreManagementProps) {
  const [restaurantName, setRestaurantName] = useState('客来香·家常菜馆');
  const [restaurantLogo, setRestaurantLogo] = useState('');
  const [restaurantSlogan, setRestaurantSlogan] = useState('地道现炒 · 现点现做');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化加载当前店面配置
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.restaurant_name) {
            setRestaurantName(data.data.restaurant_name);
          }
          if (data.data.restaurant_logo) {
            setRestaurantLogo(data.data.restaurant_logo);
          }
          if (data.data.restaurant_slogan) {
            setRestaurantSlogan(data.data.restaurant_slogan);
          }
        }
      } catch (e) {
        console.error('加载店面设置失败:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [tenantId]);

  // 上传图片文件
  const uploadFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择有效的图片文件（JPG/PNG/WEBP/SVG）');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setLogoLoadError(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'img');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setRestaurantLogo(data.url);
        setSuccessMsg('店面图标图片上传成功，请点击下方「保存店面信息」立即生效！');
      } else {
        setErrorMsg(data.error || '上传店面图标失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接异常');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  // 恢复为默认设置
  const handleResetToDefault = () => {
    if (confirm('确认恢复默认店面名称（客来香·家常菜馆）和默认图标吗？')) {
      setRestaurantName('客来香·家常菜馆');
      setRestaurantLogo('');
      setRestaurantSlogan('地道现炒 · 现点现做');
      setLogoLoadError(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 保存店面配置
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim()) {
      setErrorMsg('店面名称不能为空，请输入有效的店铺名称');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_name: restaurantName.trim(),
          restaurant_logo: restaurantLogo.trim(),
          restaurant_slogan: restaurantSlogan.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('店面信息已成功保存！前台首页与后台导航栏已同步即时更新生效。');
        if (onStoreUpdated && data.data) {
          onStoreUpdated(data.data);
        }
      } else {
        setErrorMsg(data.error || '保存店面信息失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 顶部标题栏 */}
      <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-2xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-neutral-900">店面信息与品牌编辑</h2>
            <p className="text-xs text-neutral-500">
              设置餐厅专属名称、品牌Logo图标与特色标语，修改后前台顾客端与后台控制台同步生效
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认品牌</span>
          </button>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>预览前台首页</span>
          </a>
        </div>
      </div>

      {/* 消息提示框 */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between space-x-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 text-xs px-2 py-0.5 rounded"
          >
            关闭
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between space-x-2 shadow-2xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="text-rose-700 hover:text-rose-900 text-xs px-2 py-0.5 rounded"
          >
            关闭
          </button>
        </div>
      )}

      {/* 核心内容区：表单与实时效果预览 */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧配置项（占7列） */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. 店面名称 */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <h3 className="text-sm font-bold text-neutral-900">店面基本信息</h3>
              </div>
              <span className="text-[11px] text-neutral-400">展示于首页头部与单据</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                店面名称 <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-restaurant-name"
                type="text"
                required
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="例如：客来香·家常菜馆"
                maxLength={30}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-2xs"
              />
              <div className="flex justify-between items-center mt-1.5 text-[11px] text-neutral-400">
                <span>建议控制在 4~16 个汉字，简明响亮</span>
                <span>{restaurantName.length}/30 字</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                特色标语 / 店面副标题
              </label>
              <input
                id="input-restaurant-slogan"
                type="text"
                value={restaurantSlogan}
                onChange={(e) => setRestaurantSlogan(e.target.value)}
                placeholder="例如：地道现炒 · 现点现做"
                maxLength={40}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-2xs"
              />
              <p className="mt-1.5 text-[11px] text-neutral-400">
                展示于前台首页店名下方，凸显餐厅特色风格
              </p>
            </div>
          </div>

          {/* 2. 店面图标设置 */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <h3 className="text-sm font-bold text-neutral-900">店面图标 / Logo</h3>
              </div>
              <span className="text-[11px] text-neutral-400">支持上传或填入链接</span>
            </div>

            {/* 本地上传区域 */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-2">
                方式一：从本地电脑/手机上传新图标
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-amber-500 bg-amber-50/50'
                    : 'border-neutral-200 hover:border-amber-400 bg-neutral-50/60 hover:bg-neutral-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-neutral-700">
                    {uploading ? '正在上传中，请稍候...' : '点击选择图片或将图片拖拽至此'}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    支持 JPG、PNG、WEBP，正方形比例显示效果最佳
                  </span>
                </div>
              </div>
            </div>

            {/* 链接填入 */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                方式二：直接输入图片网络 URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="input-restaurant-logo-url"
                  type="url"
                  value={restaurantLogo}
                  onChange={(e) => {
                    setRestaurantLogo(e.target.value);
                    setLogoLoadError(false);
                  }}
                  placeholder="https://... 或 /uploads/..."
                  className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all shadow-2xs"
                />
                {restaurantLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      setRestaurantLogo('');
                      setLogoLoadError(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-2.5 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-2xl font-medium transition-colors"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            {/* 预设精选图标 */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-neutral-700 mb-2 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>方式三：精选预设餐厅图标快捷选用</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_LOGOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRestaurantLogo(preset.url);
                      setLogoLoadError(false);
                    }}
                    className={`p-1.5 rounded-xl border text-center transition-all group ${
                      restaurantLogo === preset.url
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-neutral-100 mb-1">
                      <Image
                        src={preset.url}
                        alt={preset.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-600 font-medium block truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex items-center space-x-3">
            <button
              id="btn-save-store-settings"
              type="submit"
              disabled={saving || loading}
              className="flex-1 py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-70 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? '正在保存中...' : '保存店面信息并立即生效'}</span>
            </button>
          </div>
        </div>

        {/* 右侧实时效果预览（占5列） */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-2xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-900">效果实时预览</h3>
              </div>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                所见即所得
              </span>
            </div>

            {/* 1. 前端首页顶栏预览 */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-neutral-700 block">
                顾客首页左上角展示效果：
              </span>
              <div className="p-3.5 bg-neutral-900/5 rounded-2xl border border-neutral-200/70">
                <div className="bg-white p-3 rounded-xl border border-neutral-200/80 shadow-xs flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs overflow-hidden relative shrink-0">
                      {restaurantLogo && !logoLoadError ? (
                        <Image
                          src={restaurantLogo}
                          alt="图标预览"
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                          onError={() => setLogoLoadError(true)}
                        />
                      ) : (
                        <Utensils className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-neutral-900 leading-tight">
                          {restaurantName || '店面名称'}
                        </span>
                        <span className="text-[9px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-medium">
                          后台登录
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500 block">
                        {restaurantSlogan || '地道现炒 · 现点现做'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-[10px] text-neutral-400">
                    <span className="bg-neutral-100 px-2 py-1 rounded-md">我的订单</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 当前图标详情 */}
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/60 space-y-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-900">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                <span>店面配置说明</span>
              </div>
              <ul className="text-[11px] text-amber-800/90 space-y-1.5 list-disc list-inside">
                <li>
                  <strong>公网快速登录：</strong>
                  顾客端首页左上角店名已绑定后台入口，直接点击店名即可跳转至管理后台登录页面。
                </li>
                <li>
                  <strong>品牌即时生效：</strong>
                  保存后无需重新部署，前台扫码点餐、购物车页面与后台标题将即刻呈现最新名称与图标。
                </li>
                <li>
                  <strong>图标格式推荐：</strong>
                  建议使用 PNG、JPG、WEBP 格式的圆形或正方形高清图片。
                </li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
