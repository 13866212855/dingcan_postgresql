'use client';

import React, { useState } from 'react';
import { X, Award, ShieldCheck, Phone, User, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { AppUser } from '@/types';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AppUser | null;
  onUserUpdated: (user: AppUser) => void;
  pointsRatio?: number;
  tenantId?: string;
}

export default function MemberModal({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  pointsRatio = 1,
  tenantId = 'default',
}: MemberModalProps) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [name, setName] = useState(user?.name || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!phone || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg('请输入正确的11位有效手机号码');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('请输入您的真实姓名或称谓');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/verify?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user?.id,
          phone: phone.trim(),
          name: name.trim(),
          tenant_id: tenantId,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        onUserUpdated(data.data);
        setSuccessMsg('实名认证成功！您已开通会员权益与积分抵现功能。');
      } else {
        setErrorMsg(data.error || '实名认证失败，请重试');
      }
    } catch {
      setErrorMsg('网络请求异常，请稍后再试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">会员中心 · 积分权益</h2>
              <p className="text-xs text-amber-100">消费返积分 · 积分可直接抵现</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Member Card */}
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-xl p-4 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  {user?.is_verified ? '★ 尊享实名会员' : '☆ 游客会员 (未实名)'}
                </span>
                <h3 className="text-base font-bold mt-0.5">
                  {user?.is_verified ? user.name : '客来香优享顾客'}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-400">可用积分</span>
                <div className="text-xl font-black text-amber-400">
                  {user?.points ?? 0} <span className="text-xs font-normal text-white">分</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-700/60 flex items-center justify-between text-xs text-neutral-300">
              <span>可抵扣现金：<strong className="text-amber-400">¥{(user?.points ?? 0).toFixed(2)}</strong></span>
              <span>累计消费：¥{(user?.total_spent ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Privilege explanation */}
          <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>会员专属特权说明</span>
            </div>
            <p className="text-neutral-600 leading-relaxed">
              • 每次点餐结账均可获得消费金额 <strong>{pointsRatio}%</strong> 的积分奖励。<br />
              • 积分可用于下次点餐结账时<strong>1:1 充当现金直接抵扣</strong>。<br />
              • 绑定实名手机号后，更换浏览器或设备可通过同一手机号找回积分资产。
            </p>
          </div>

          {/* Real name status or verification form */}
          {user?.is_verified ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start space-x-3 text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-emerald-950">已完成实名认证</p>
                <p className="text-emerald-700 mt-0.5">
                  实名姓名：{user.name} | 手机号码：{user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''}
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  您在结算时可自由使用积分抵扣菜品金额。
                </p>
              </div>
            </div>
          ) : (
            <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-neutral-900">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>实名制信息登记（开通积分抵扣）</span>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">您的姓名 / 称呼</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：张先生 / 李女士"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">手机号码（实名凭证）</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      maxLength={11}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="请输入11位手机号码"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-60"
                >
                  {submitting ? '提交登记中...' : '提交实名认证'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
