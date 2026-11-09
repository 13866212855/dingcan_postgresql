'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Home,
  CheckCircle2,
  AlertCircle,
  Truck,
  MapPin,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { AppUser } from '@/types';
import { getClientUserId } from '@/lib/storage';
import { parseJsonResponse } from '@/lib/utils';

interface CustomerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 保存成功后回调（携带更新后的用户资料） */
  onSaved: (user: AppUser) => void;
  /** 当前订单就餐方式：外卖时收件地址必填，堂食选填 */
  orderType: '堂食' | '外卖';
  /** 已有的默认用户资料（新老用户回填，避免老用户重复手输） */
  initialUser?: AppUser | null;
  tenantId?: string;
}

/**
 * 顾客配送地址与联系信息确认/登记弹窗（外卖每次必确认 + 免费智能定位）：
 * 1. 真实外卖场景：老用户自动回显历史地址，只需一眼核对、一键确认；地址有变动时随时编辑或一键自动定位。
 * 2. 免费定位能力：浏览器 HTML5 原生 GPS 定位 + 服务端逆地理编码（免签 OpenStreetMap / 免费高德 API），0成本将坐标转为真实街道。
 * 3. 堂食单：首次匿名用户输入称呼与手机；老用户直接通过。
 */
export default function CustomerInfoModal({
  isOpen,
  onClose,
  onSaved,
  orderType,
  initialUser,
  tenantId = 'default',
}: CustomerInfoModalProps) {
  const [name, setName] = useState(() => initialUser?.name || initialUser?.delivery_contact || '');
  const [phone, setPhone] = useState(() => initialUser?.phone || initialUser?.delivery_phone || '');
  const [address, setAddress] = useState(() => initialUser?.delivery_address || '');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationSuccessTip, setLocationSuccessTip] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isDelivery = orderType === '外卖';

  // 每次弹窗打开时：优先回显 initialUser（老用户省去打字成本）
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setErrorMsg('');
        setLocationSuccessTip('');
        if (initialUser) {
          setName(initialUser.name || initialUser.delivery_contact || '');
          setPhone(initialUser.phone || initialUser.delivery_phone || '');
          setAddress(initialUser.delivery_address || '');
        }
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialUser]);

  if (!isOpen) return null;

  // 方案 A：一键免费获取当前位置并自动逆地理填充地址
  const handleAutoLocate = () => {
    setErrorMsg('');
    setLocationSuccessTip('');

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMsg('当前浏览器或设备不支持地理定位功能，请手动输入地址');
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // 调用服务端免费逆地理编码接口，将经纬度转为中文具体路名
          const res = await fetch(
            `/api/location/geocode?lat=${latitude}&lng=${longitude}&tenant=${encodeURIComponent(tenantId)}`
          );
          const json = await parseJsonResponse<any>(res, { success: false });

          if (json.success && json.data?.formattedAddress) {
            const formatted = json.data.formattedAddress;
            // 贴心地保留或提示用户补全门牌号
            const currentHouseNumber = address.match(/\d+号|\d+栋|\d+单元|\d+室/)?.[0] || '';
            const finalAddr = currentHouseNumber && !formatted.includes(currentHouseNumber)
              ? `${formatted} ${currentHouseNumber}`
              : formatted;

            setAddress(finalAddr);
            setLocationSuccessTip('已自动定位到当前街道，请确认并补充门牌号');
          } else if (json.data?.note) {
            // 备用兜底提示
            setLocationSuccessTip('已定位到当前坐标，请在输入框确认或补充具体地址');
          } else {
            setErrorMsg(json.error || '解析当前街道失败，请手动填写');
          }
        } catch {
          setErrorMsg('定位解析服务网络超时，请手动输入地址');
        } finally {
          setLocating(false);
        }
      },
      (geoError) => {
        setLocating(false);
        let tip = '获取定位失败，请手动填写';
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            tip = '定位权限已被拒绝，请允许浏览器获取位置，或直接手动填写';
            break;
          case geoError.POSITION_UNAVAILABLE:
            tip = '当前位置信号弱，无法精确定位，请手动输入地址';
            break;
          case geoError.TIMEOUT:
            tip = '定位请求超时，请检查网络或直接手动输入';
            break;
        }
        setErrorMsg(tip);
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 60000,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('请填写收餐人姓名或称呼');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg('请填写正确的11位有效手机号码');
      return;
    }
    if (isDelivery && !address.trim()) {
      setErrorMsg('外卖订单请填写具体送达地址（含楼栋门牌号）');
      return;
    }

    setSubmitting(true);
    try {
      const userId = getClientUserId();
      // 确保本租户该用户已存在
      await fetch(`/api/users?id=${encodeURIComponent(userId)}&tenant=${encodeURIComponent(tenantId)}`);
      const res = await fetch(`/api/users?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: name.trim(),
          phone: phone.trim(),
          delivery_address: address.trim(),
          delivery_contact: name.trim(),
          delivery_phone: phone.trim(),
          tenant_id: tenantId,
        }),
      });
      const data = await parseJsonResponse<any>(res, { success: false });
      if (data.success && data.data) {
        onSaved(data.data);
      } else {
        setErrorMsg(data.error || '保存地址信息失败，请重试');
      }
    } catch {
      setErrorMsg('网络连接异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const hasHistoryAddress = Boolean(initialUser?.delivery_address?.trim());

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs shrink-0">
              {isDelivery ? <Truck className="w-4.5 h-4.5 text-white" /> : <User className="w-4.5 h-4.5 text-white" />}
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {isDelivery ? '确认外卖送达地址' : '下单联系人登记'}
              </h2>
              <p className="text-[11px] text-amber-100">
                {isDelivery
                  ? (hasHistoryAddress ? '请核对本次配送地址，支持修改或一键定位' : '请填写送餐地址，接单员将准时送达')
                  : '请留下您的称呼与电话，方便出餐叫号'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-1.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {locationSuccessTip && (
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center space-x-1.5 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{locationSuccessTip}</span>
            </div>
          )}

          {/* 外卖收件地址（带自动定位功能） */}
          {isDelivery && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-neutral-800 flex items-center space-x-1">
                  <Home className="w-3.5 h-3.5 text-amber-600" />
                  <span>外卖配送地址 <strong className="text-rose-500">*</strong></span>
                </label>
                {/* 免费自动定位快捷按钮 */}
                <button
                  type="button"
                  disabled={locating}
                  onClick={handleAutoLocate}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200/80 transition-all cursor-pointer disabled:opacity-60 active:scale-95"
                >
                  {locating ? (
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                  ) : (
                    <MapPin className="w-3 h-3 text-amber-600" />
                  )}
                  <span>{locating ? '定位中...' : '📍 自动定位'}</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setLocationSuccessTip('');
                  }}
                  placeholder="例如：幸福里小区3栋2单元501室（可点击右上角自动定位填入街道）"
                  className="w-full px-3 py-2 text-xs bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white resize-none leading-relaxed text-neutral-800"
                />
              </div>

              {hasHistoryAddress && (
                <div className="flex items-center space-x-1 text-[10px] text-neutral-400 mt-1">
                  <Info className="w-3 h-3 text-neutral-400" />
                  <span>已自动带出您上次使用的地址，本次配送若有变更可直接修改</span>
                </div>
              )}
            </div>
          )}

          {/* 收件人与联系电话 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                {isDelivery ? '收餐人称呼' : '您的称呼'} <strong className="text-rose-500">*</strong>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：张先生"
                  className="w-full pl-8 pr-2.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-neutral-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                联系手机号 <strong className="text-rose-500">*</strong>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="tel"
                  required
                  maxLength={11}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11位手机号"
                  className="w-full pl-8 pr-2.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-neutral-800"
                />
              </div>
            </div>
          </div>

          {!isDelivery && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                家庭/常住地址（选填）
              </label>
              <div className="relative">
                <Home className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="方便下次点外送直接使用"
                  className="w-full pl-8 pr-2.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-neutral-800"
                />
              </div>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={submitting || locating}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-60 flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {submitting
                  ? '保存中...'
                  : isDelivery
                  ? (hasHistoryAddress ? '确认此地址，去付款' : '确认地址并去付款')
                  : '确认信息并去付款'}
              </span>
            </button>
            <p className="text-[10px] text-neutral-400 text-center mt-2 leading-relaxed">
              {isDelivery ? '确认后将保存为最新默认收货地址' : '联系信息仅用于本店出餐核对与联系'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
