'use client';

import React from 'react';
import Image from 'next/image';
import { X, QrCode, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPaid: () => void;
  amount: number;
  originalAmount?: number;
  pointsDiscount?: number;
  qrCodeUrl?: string;
  tableOrOrderInfo?: string;
  isConfirming?: boolean;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirmPaid,
  amount,
  originalAmount,
  pointsDiscount = 0,
  qrCodeUrl,
  tableOrOrderInfo = '',
  isConfirming = false,
}: PaymentModalProps) {
  const [imgError, setImgError] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top bar */}
        <div className="bg-neutral-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">饭店扫码结账</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 text-center space-y-4">
          {/* Amount Box */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5">
            <span className="text-xs text-neutral-500">应付实付金额</span>
            <div className="text-3xl font-black text-rose-600 my-0.5">
              ¥{amount.toFixed(2)}
            </div>
            {pointsDiscount > 0 && originalAmount !== undefined && (
              <div className="text-[11px] text-amber-800 flex items-center justify-center space-x-1 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>原价 ¥{originalAmount.toFixed(2)} · 已积分抵扣 ¥{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
            {tableOrOrderInfo && (
              <p className="text-xs text-neutral-500 mt-1">{tableOrOrderInfo}</p>
            )}
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center">
            {qrCodeUrl && !imgError ? (
              <div className="relative w-56 h-56 rounded-xl overflow-hidden bg-white shadow-inner border border-neutral-200">
                <Image
                  src={qrCodeUrl}
                  alt="饭店收款码"
                  fill
                  unoptimized
                  className="object-contain p-2"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="w-56 h-56 rounded-xl bg-white border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center p-4 text-center">
                <QrCode className="w-16 h-16 text-neutral-300 mb-2" />
                <p className="text-xs font-bold text-neutral-600">店内统一收款码</p>
                <p className="text-[10px] text-neutral-400 mt-1">
                  （管理员可在后台上传微信/支付宝收款码）
                </p>
              </div>
            )}

            <div className="flex items-center space-x-2 mt-3 text-xs text-neutral-600">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                微信支付
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                支付宝
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                云闪付
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5">
              请打开手机扫一扫完成支付
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={onConfirmPaid}
              disabled={isConfirming}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all active:scale-98 disabled:opacity-70"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isConfirming ? '提交中...' : '我已完成扫码支付'}</span>
            </button>

            <button
              onClick={onClose}
              disabled={isConfirming}
              className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium rounded-xl transition-colors"
            >
              稍后再付 / 关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
