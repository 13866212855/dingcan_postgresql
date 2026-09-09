'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Settings,
  QrCode,
  Upload,
  Percent,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  HelpCircle,
  Globe,
  Utensils,
  Truck,
  MapPin,
  Info,
  CreditCard,
  Clock,
} from 'lucide-react';
import { AppSettings } from '@/types';

interface SettingsManagementProps {
  tenantId?: string;
}

export default function SettingsManagement({ tenantId = 'default' }: SettingsManagementProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [localPreview, setLocalPreview] = useState('');
  const [pointsRatio, setPointsRatio] = useState(1);
  const [customDomain, setCustomDomain] = useState('');
  // 消费就餐方式配置
  const [enableDineIn, setEnableDineIn] = useState(true);
  const [enableTakeout, setEnableTakeout] = useState(true);
  // 就餐桌号配置
  const [requireTableNo, setRequireTableNo] = useState(true);
  const [tableInputMode, setTableInputMode] = useState<'select' | 'input' | 'both'>('select');
  // 支付付款时机配置 (餐前付款 / 餐后结账)
  const [enablePayBefore, setEnablePayBefore] = useState(true);
  const [enablePayAfter, setEnablePayAfter] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setQrCodeUrl(data.data.payment_qr_code || '');
          setPointsRatio(data.data.points_ratio ?? 1);
          setCustomDomain(data.data.custom_domain || '');
          setEnableDineIn(data.data.enable_dine_in !== 0);
          setEnableTakeout(data.data.enable_takeout !== 0);
          setRequireTableNo(data.data.require_table_no !== 0);
          if (data.data.table_input_mode) {
            setTableInputMode(data.data.table_input_mode);
          }
          setEnablePayBefore(data.data.enable_pay_before !== 0);
          setEnablePayAfter(data.data.enable_pay_after !== 0);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [tenantId]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择有效的图片文件（JPG/PNG/WEBP）');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setImageLoadError(false);

    // Immediate local visual preview
    try {
      const objUrl = URL.createObjectURL(file);
      setLocalPreview(objUrl);
    } catch {
      // ignore
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'qr');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setQrCodeUrl(data.url);
        setSuccessMsg('收款码图片已成功上传并生成链接，请点击下方「保存全部配置」！');
      } else {
        setErrorMsg(data.error || '上传图片失败');
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

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          uploadFile(file);
          break;
        }
      }
    }
  };

  const handleClearQrCode = () => {
    setQrCodeUrl('');
    setLocalPreview('');
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_qr_code: qrCodeUrl.trim(),
          points_ratio: Number(pointsRatio) || 1,
          custom_domain: customDomain.trim(),
          enable_dine_in: enableDineIn ? 1 : 0,
          enable_takeout: enableTakeout ? 1 : 0,
          require_table_no: requireTableNo ? 1 : 0,
          table_input_mode: tableInputMode,
          enable_pay_before: enablePayBefore ? 1 : 0,
          enable_pay_after: enablePayAfter ? 1 : 0,
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('系统运营就餐方式、桌号规则、支付付款时机、收款码与积分配置已成功保存并立即生效！');
      } else {
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const displayImage = localPreview || qrCodeUrl;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-neutral-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-amber-600" />
          <span>运营就餐方式、桌号规则与收款配置</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          配置前端就餐方式（到店堂食 / 送餐到家）、就餐桌号必填与录入模式，以及收款码与会员积分
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. 消费就餐方式配置 (堂食 / 外卖 复选框) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Utensils className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">消费就餐方式配置</h3>
            </div>
            <span className="text-xs text-neutral-400">支持自由勾选与组合控制</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            配置前端顾客结账下单时支持的就餐方式。可只选一个、两个都选或都不选：
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* 堂食复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enableDineIn
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-dine-in"
                type="checkbox"
                checked={enableDineIn}
                onChange={(e) => setEnableDineIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  <span>到店堂食</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在餐厅店内就餐，支持选桌入座、扫码直达桌号点餐。
                </p>
              </div>
            </label>

            {/* 外卖送餐复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enableTakeout
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-takeout"
                type="checkbox"
                checked={enableTakeout}
                onChange={(e) => setEnableTakeout(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>送餐到家 (外卖)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在线下单并填写送达地址与联系电话，由门店骑手配送。
                </p>
              </div>
            </label>
          </div>

          {/* 交互规则状态实时反馈提示条 */}
          <div className="p-3.5 rounded-xl border bg-neutral-50/80 border-neutral-200/80 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <Info className="w-4 h-4 text-amber-600" />
              <span>前端生效表现预览：</span>
            </div>
            {enableDineIn && enableTakeout && (
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                ★ <strong>堂食与外卖均已勾选激活</strong>：前端结算界面将展示<strong>【到店堂食】与【送餐到家 (外卖)】</strong>选择按钮，供顾客自主切换。
              </p>
            )}
            {enableDineIn && !enableTakeout && (
              <p className="text-[11px] text-blue-700 leading-relaxed">
                ★ <strong>仅激活【到店堂食】</strong>：前端结算界面<strong>不显示切换按钮</strong>，顾客默认且仅能以<strong>到店堂食</strong>方式下单。
              </p>
            )}
            {!enableDineIn && enableTakeout && (
              <p className="text-[11px] text-purple-700 leading-relaxed">
                ★ <strong>仅激活【送餐到家 (外卖)】</strong>：前端结算界面<strong>不显示切换按钮</strong>，顾客默认且仅能以<strong>送餐到家 (外卖)</strong>方式下单。
              </p>
            )}
            {!enableDineIn && !enableTakeout && (
              <p className="text-[11px] text-amber-700 leading-relaxed">
                ★ <strong>两项均未勾选</strong>：系统安全兜底机制生效，前端<strong>不显示切换按钮</strong>，自动默认按<strong>【到店堂食】</strong>模式处理。
              </p>
            )}
          </div>
        </div>

        {/* 2. 就餐桌号运营配置 */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">就餐桌号规则配置</h3>
            </div>
            <span className="text-xs text-neutral-400">堂食选桌与录入方式</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            设置堂食点餐时对餐桌号的要求与录入交互方式：
          </p>

          <div className="space-y-3 pt-1">
            {/* 桌号必填开关 */}
            <label className="flex items-start space-x-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-100/60 transition-colors">
              <input
                id="checkbox-require-table-no"
                type="checkbox"
                checked={requireTableNo}
                onChange={(e) => setRequireTableNo(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-neutral-900">
                  堂食点餐必须选择或输入就餐桌号
                </span>
                <p className="text-[11px] text-neutral-500">
                  开启后，堂食结算窗口展示桌号选择框并必须指定桌号；若关闭，前端结算窗口彻底去掉桌号区块（极致精简），订单自动归为“自取/未指定桌位”。
                </p>
              </div>
            </label>

            {/* 桌号录入模式 */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
              <label className="block text-xs font-bold text-neutral-800">
                前端桌号提供方式
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'select' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="select"
                    checked={tableInputMode === 'select'}
                    onChange={() => setTableInputMode('select')}
                    className="sr-only"
                  />
                  <span>仅下拉选择店内桌号</span>
                </label>
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'input' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="input"
                    checked={tableInputMode === 'input'}
                    onChange={() => setTableInputMode('input')}
                    className="sr-only"
                  />
                  <span>允许手动填写任意桌号</span>
                </label>
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'both' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="both"
                    checked={tableInputMode === 'both'}
                    onChange={() => setTableInputMode('both')}
                    className="sr-only"
                  />
                  <span>双模式 (下拉或手输)</span>
                </label>
              </div>
              <p className="text-[11px] text-neutral-500">
                提示：若开启了扫码桌贴，通过微信/相机扫桌上二维码打开的用户将直接自动锁定该桌号，无需顾客手动挑选。
              </p>
            </div>
          </div>
        </div>

        {/* 3. 支付付款时机配置 (餐前付款 / 餐后结账 复选框) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">支付付款时机配置</h3>
            </div>
            <span className="text-xs text-neutral-400">立付与先吃后付控制</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            配置前端顾客结账下单时允许的付款时机。可勾选餐前、餐后或两者兼备：
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* 餐前付款复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enablePayBefore
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-pay-before"
                type="checkbox"
                checked={enablePayBefore}
                onChange={(e) => setEnablePayBefore(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  <span>餐前付款 (立付)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在提交订单时立即扫码支付，资金先到账再制作出餐（快餐、外卖等常用）。
                </p>
              </div>
            </label>

            {/* 餐后结账复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enablePayAfter
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-pay-after"
                type="checkbox"
                checked={enablePayAfter}
                onChange={(e) => setEnablePayAfter(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>餐后结账 (先吃后付)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客先下单厨房立即出单烹饪，吃完离店前再到前台或线上扫码结算（正餐酒楼常用）。
                </p>
              </div>
            </label>
          </div>

          {/* 前端联动表现反馈提示条 */}
          <div className="p-3.5 rounded-xl border bg-neutral-50/80 border-neutral-200/80 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <Info className="w-4 h-4 text-amber-600" />
              <span>前端生效表现预览：</span>
            </div>
            {enablePayBefore && enablePayAfter && (
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                ★ <strong>餐前与餐后均已勾选激活</strong>：堂食结算时将展示<strong>【餐前付款 (立付)】与【餐后结账 (先吃后付)】</strong>选择按钮，供顾客自主选择。
              </p>
            )}
            {enablePayBefore && !enablePayAfter && (
              <p className="text-[11px] text-blue-700 leading-relaxed">
                ★ <strong>仅激活【餐前付款】</strong>：前端结算界面<strong>彻底隐藏该区块</strong>，界面极致精简，系统默认且仅支持<strong>餐前付款</strong>。
              </p>
            )}
            {!enablePayBefore && enablePayAfter && (
              <p className="text-[11px] text-purple-700 leading-relaxed">
                ★ <strong>仅激活【餐后结账】</strong>：前端结算界面<strong>彻底隐藏该区块</strong>，界面极致精简，系统默认且仅支持<strong>餐后结账</strong>。
              </p>
            )}
            {!enablePayBefore && !enablePayAfter && (
              <p className="text-[11px] text-amber-700 leading-relaxed">
                ★ <strong>两项均未勾选</strong>：系统安全兜底机制生效，前端结算界面<strong>彻底隐藏该区块</strong>，系统自动默认采用<strong>【餐前付款】</strong>。
              </p>
            )}
          </div>
        </div>

        {/* 4. Payment QR Code Section */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-neutral-700" />
              <h3 className="text-sm font-bold text-neutral-900">饭店收款二维码 (餐前结账与线上支付)</h3>
            </div>
            <span className="text-xs text-neutral-400">支持微信/支付宝/聚合收款码</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            顾客选择“餐前付款”或外卖送餐结账时，系统弹窗将展示此收款码，顾客扫码支付完成后即可完成下单。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-2">
            {/* QR Preview Box with Drag-and-Drop */}
            <div className="md:col-span-1 flex flex-col items-center">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={`w-52 h-52 rounded-2xl border-2 border-dashed transition-all bg-neutral-50 flex items-center justify-center relative overflow-hidden shadow-inner cursor-pointer group focus:ring-2 focus:ring-amber-500 focus:outline-hidden ${
                  isDragOver
                    ? 'border-amber-500 bg-amber-50/50 scale-102'
                    : 'border-neutral-300 hover:border-amber-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
                title="点击选择图片，或将图片拖拽至此处"
              >
                {displayImage && !imageLoadError ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={displayImage}
                      alt="饭店收款码"
                      fill
                      unoptimized
                      className="object-contain p-2"
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold space-y-1 backdrop-blur-2xs">
                      <Upload className="w-5 h-5" />
                      <span>点击更换图片</span>
                      <span className="text-[10px] text-neutral-200">支持拖拽/黏贴</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 text-neutral-400 space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-colors">
                      <QrCode className="w-6 h-6" />
                    </div>
                    {imageLoadError ? (
                      <div className="text-rose-500 text-xs">
                        <span>图片加载异常</span>
                        <div className="text-[10px] text-neutral-400 mt-0.5">点击重新上传</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-neutral-600 group-hover:text-amber-600 transition-colors">
                          点击或拖拽上传收款码
                        </div>
                        <p className="text-[10px] text-neutral-400">支持微信/支付宝/聚合码</p>
                      </>
                    )}
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-amber-600 text-xs font-bold space-y-2">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>图片上传中...</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 mt-2">
                前台收银效果预览 (点击或拖拽图片可更换)
              </span>
            </div>

            {/* Upload & URL Input */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  本地图片上传
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 disabled:opacity-60 shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>{uploading ? '正在上传图片...' : '选择收款码图片文件并上传'}</span>
                  </button>
                  <span className="text-[11px] text-neutral-400">
                    支持 PNG/JPG/WEBP，也可以直接拖拽或截图按 Ctrl+V 黏贴
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  收款码图片路径或网络链接：
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={qrCodeUrl}
                    onChange={(e) => {
                      setQrCodeUrl(e.target.value);
                      setImageLoadError(false);
                    }}
                    placeholder="可自动由上方上传生成，或填入 /uploads/... 或 https://..."
                    className="w-full px-3.5 py-2.5 text-xs bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                  <p className="text-[11px] text-neutral-400">
                    注：上传成功后此处自动显示为相对路径，请点击下方「保存全部配置」完成持久化保存。
                  </p>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClearQrCode}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline flex items-center space-x-1"
                  >
                    <span>清除当前收款码</span>
                  </button>
                  {displayImage && (
                    <a
                      href={displayImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
                    >
                      在新标签页查看大图 ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Points System Setting */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">积分比例与返现规则</h3>
            </div>
            <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              1 积分 = 1 元现金
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              每笔消费赠送积分比例 (%)
            </label>
            <div className="flex items-center space-x-3 max-w-xs">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={pointsRatio}
                  onChange={(e) => setPointsRatio(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-bold">%</span>
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>当前规则测算示例：</span>
            </div>
            <p className="text-neutral-600 leading-relaxed">
              • 顾客实付结账 <strong>100 元</strong> 时，将自动获得 <strong>{(100 * (pointsRatio / 100)).toFixed(2)}</strong> 积分。<br />
              • 下次结账时勾选“使用积分抵扣”，<strong>1 积分可直接抵扣 1 元现金</strong>。<br />
              • 积分与用户实名手机号唯一绑定，更换手机扫码也可凭借实名认证找回积分。
            </p>
          </div>
        </div>

        {/* Table QR Code Access Domain (WeChat compatibility & Custom Domain) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-neutral-900">扫码点餐桌贴域名配置 (解决微信打不开问题)</h3>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              微信扫码优化
            </span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            用于生成各餐桌专属点餐二维码（桌贴）的根网址。留空时默认使用当前网页所在的运行地址。
          </p>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              自定义外部访问根地址 (支持已备案独立域名、公网IP或中转地址)
            </label>
            <input
              type="text"
              placeholder="例如：https://order.yourrestaurant.com 或 http://192.168.1.100:3000"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              填写后，后台【餐桌管理】生成的所有桌贴二维码及点餐链接将自动切换为该域名。
            </p>
          </div>

          {/* WeChat Interception Explanation Box */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-600 space-y-2.5">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>为什么微信扫一扫打不开当前的 run.app 链接？</span>
            </div>
            <div className="space-y-1.5 text-[11px] leading-relaxed text-neutral-600">
              <p>
                <strong>1. 微信内置安全风控拦截</strong>：微信对海外公有云子域名（如 <code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded">*.run.app</code>、<code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded">*.vercel.app</code> 等）实行严格拦截策略，判定为非白名单外链，微信内置浏览器通常直接阻止访问或报“已停止访问该网页”。
              </p>
              <p>
                <strong>2. 境外服务器网络连接限制</strong>：<code className="text-neutral-800 bg-neutral-100 px-1 py-0.5 rounded">run.app</code> 属于 Google Cloud 境外节点，国内移动网络无法直接直连；电脑浏览器能打开通常是因为电脑处于代理或特定网络环境下。
              </p>
              <p>
                <strong>3. 顺畅在微信中使用的建议方案</strong>：
                <br />
                • <strong>方案 A（最推荐·正规商用）</strong>：使用在国内云厂商（腾讯云/阿里云等）购买并已<strong>ICP备案</strong>的自有域名（如 <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">order.yourcanteen.com</code>），指向您的服务器，并在此处配置该域名。
                <br />
                • <strong>方案 B（快捷局域网/过渡测试）</strong>：使用内网穿透（如 cpolar/Sunny-Ngrok）生成的国内合规中转域名，填入此处生成专属桌贴码。
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center space-x-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '保存配置中...' : '保存全部配置'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
