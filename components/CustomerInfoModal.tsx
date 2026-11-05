'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Phone, Home, CheckCircle2, AlertCircle, ClipboardList } from 'lucide-react';
import { AppUser } from '@/types';
import { getClientUserId } from '@/lib/storage';

interface CustomerInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 保存成功后回调（携带更新后的用户资料） */
  onSaved: (user: AppUser) => void;
  /** 当前订单就餐方式：外卖时收件地址必填，堂食选填 */
  orderType: '堂食' | '外卖';
  tenantId?: string;
}

/**
 * 顾客联系信息收集弹窗（匿名用户结算拦截）：
 * 首次下单（本机客户端无姓名/手机号记录）时要求登记姓名、手机号与收件地址，
 * 供接单员联系与送餐；资料保存到本租户 users 表，下次下单不再询问。
 */
export default function CustomerInfoModal({
  isOpen,
  onClose,
  onSaved,
  orderType,
  tenantId = 'default',
}: CustomerInfoModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 每次打开时回填已有资料（hooks 必须位于早退之前）
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const addressRequired = orderType === '外卖';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('请输入您的姓名或称呼（接单员便于与您联系）');
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg('请输入正确的11位手机号码');
      return;
    }
    if (addressRequired && !address.trim()) {
      setErrorMsg('外卖订单请填写收件地址（含楼栋门牌号）');
      return;
    }

    setSubmitting(true);
    try {
      const userId = getClientUserId();
      // 先确保本租户用户记录存在（getOrCreateUser），再更新资料
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
      const data = await res.json();
      if (data.success && data.data) {
        onSaved(data.data);
      } else {
        setErrorMsg(data.error || '保存失败，请重试');
      }
    } catch {
      setErrorMsg('网络请求异常，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">下单登记</h2>
              <p className="text-[11px] text-amber-100">
                {addressRequired ? '外卖配送需要您的联系与收件信息' : '首次下单请登记联系信息'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">您的姓名 / 称呼 *</label>
            <div className="relative">
              <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：张先生 / 李女士"
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">手机号码 *</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                required
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11位手机号（接单员联系您用）"
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-700 mb-1">
              收件地址 {addressRequired ? '*' : '（选填 · 外卖配送用）'}
            </label>
            <div className="relative">
              <Home className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required={addressRequired}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={addressRequired ? '例如：幸福小区3号楼2单元501室' : '下次点外卖可自动带出'}
                className="w-full pl-9 pr-3 py-2.5 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-60 flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? '保存中...' : '保存并继续下单'}</span>
          </button>

          <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
            信息仅用于本店订单配送与联系，保存后下次下单自动带出
          </p>
        </form>
      </div>
    </div>
  );
}
