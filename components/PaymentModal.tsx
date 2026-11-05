'use client';

import React from 'react';
import { X, QrCode, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Loader2, Smartphone, ExternalLink, Clock } from 'lucide-react';
import Image from 'next/image';

export interface DynamicPayData {
  orderId: string; // 平台订单号（轮询支付状态用）
  payUrl: string; // 手机端支付跳转链接
  qrCodeUrl: string; // PC 端二维码图片地址（5 分钟有效）
  tradeOrderId: string;
  amount: number;
  expiresAt: number; // 毫秒时间戳
}

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
  /** 动态在线支付数据（传入即进入虎皮椒动态模式；不传 = 传统静态收款码模式） */
  dynamicPay?: DynamicPayData | null;
  /** 动态模式轮询到账后的回调（自动确认，顾客无需点任何按钮） */
  onPaid?: () => void;
  /** 二维码过期后点击"刷新"由父组件重新拉起支付 */
  onRefreshPay?: () => void;
  /** 父组件正在向通道下单（刷新二维码期间禁用按钮） */
  isCreatingPay?: boolean;
  /** 轮询支付状态所需的租户上下文 */
  tenantId?: string;
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
  dynamicPay = null,
  onPaid,
  onRefreshPay,
  isCreatingPay = false,
  tenantId = 'default',
}: PaymentModalProps) {
  const [imgError, setImgError] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());
  const [paidDetected, setPaidDetected] = React.useState(false);

  const isDynamic = !!dynamicPay;

  // 静态收款码模式：确认按钮延迟 20 秒出现——
  // 为顾客预留"识别二维码 → 输入金额 → 完成支付"的真实操作时间，降低误点与未付先点的概率
  const CONFIRM_DELAY_SECONDS = 20;
  const [confirmDelayLeft, setConfirmDelayLeft] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen || isDynamic) return;
    setConfirmDelayLeft(CONFIRM_DELAY_SECONDS);
    const t = setInterval(() => {
      setConfirmDelayLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [isOpen, isDynamic]);
  const isMobile = React.useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
  }, []);

  // 倒计时 tick（每秒）
  React.useEffect(() => {
    if (!isOpen || !isDynamic) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isOpen, isDynamic]);

  // 支付状态轮询（每 2.5s）——回调到账后自动确认
  React.useEffect(() => {
    if (!isOpen || !isDynamic || paidDetected || !dynamicPay?.orderId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/pay/status?orderId=${encodeURIComponent(dynamicPay.orderId)}&tenant=${encodeURIComponent(tenantId)}`,
          { cache: 'no-store' }
        );
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;
        const data = await res.json();
        if (!stopped && data?.success && data?.data?.paymentStatus === '已支付') {
          setPaidDetected(true);
          setTimeout(() => onPaid?.(), 1200);
        }
      } catch {
        // 轮询失败静默，下一轮重试
      }
    };
    const timer = setInterval(poll, 2500);
    poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDynamic, paidDetected, dynamicPay?.orderId, tenantId]);

  // 打开新弹窗会话时重置内部状态
  React.useEffect(() => {
    if (isOpen) {
      setPaidDetected(false);
      setImgError(false);
    }
  }, [isOpen, dynamicPay?.orderId]);

  if (!isOpen) return null;

  const secondsLeft = isDynamic ? Math.max(0, Math.floor((dynamicPay.expiresAt - now) / 1000)) : 0;
  const qrExpired = isDynamic && secondsLeft <= 0;

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top bar */}
        <div className="bg-neutral-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <QrCode className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold">{isDynamic ? '在线支付 · 自动确认到账' : '饭店扫码结账'}</h3>
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
              ¥{(isDynamic ? dynamicPay.amount : amount).toFixed(2)}
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

          {isDynamic ? (
            /* ============ 动态在线支付模式 ============ */
            paidDetected ? (
              <div className="py-8 flex flex-col items-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-emerald-700">支付成功，已自动确认到账！</p>
                <p className="text-xs text-neutral-400">正在为您跳转订单状态…</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 手机端：拉起支付按钮 */}
                {isMobile && dynamicPay.payUrl ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        window.location.href = dynamicPay.payUrl!;
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-sm font-bold rounded-2xl shadow-md flex items-center justify-center space-x-2 transition-all active:scale-98"
                    >
                      <Smartphone className="w-4.5 h-4.5" />
                      <span>立即支付 ¥{(dynamicPay.amount).toFixed(2)}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </button>
                    <p className="text-[11px] text-neutral-500 leading-relaxed px-2">
                      点击后将拉起微信/支付宝完成付款（金额已自动带上，无需手动输入）。
                      支付完成后返回本页面，系统将<strong className="text-emerald-700">自动确认到账</strong>，无需点击任何按钮。
                    </p>
                  </div>
                ) : qrExpired ? (
                  /* PC 端二维码已过期 */
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center space-y-3 py-8">
                    <AlertCircle className="w-10 h-10 text-neutral-300" />
                    <p className="text-xs font-bold text-neutral-600">二维码已过期（有效期 5 分钟）</p>
                    <button
                      onClick={() => onRefreshPay?.()}
                      disabled={isCreatingPay}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-colors"
                    >
                      {isCreatingPay ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>{isCreatingPay ? '正在刷新...' : '刷新二维码重新支付'}</span>
                    </button>
                  </div>
                ) : (
                  /* PC 端：展示动态二维码 */
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center">
                    {dynamicPay.qrCodeUrl && !imgError ? (
                      <div className="relative w-52 h-52 rounded-xl overflow-hidden bg-white shadow-inner border border-neutral-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={dynamicPay.qrCodeUrl}
                          alt="支付二维码"
                          className="w-full h-full object-contain p-2"
                          onError={() => setImgError(true)}
                        />
                      </div>
                    ) : (
                      <div className="w-52 h-52 rounded-xl bg-white border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center p-4 text-center">
                        <QrCode className="w-14 h-14 text-neutral-300 mb-2" />
                        <p className="text-xs font-bold text-neutral-600">二维码加载失败</p>
                        <button
                          onClick={() => {
                            setImgError(false);
                            onRefreshPay?.();
                          }}
                          className="text-[11px] text-amber-600 underline mt-2"
                        >
                          点击重试
                        </button>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 mt-3 text-xs text-neutral-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        微信支付
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                        支付宝
                      </span>
                      <span className="text-[11px] text-neutral-400 tabular-nums">
                        {mmss(secondsLeft)} 后过期
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1.5">
                      请使用手机扫一扫；到账后本页自动确认
                    </p>
                  </div>
                )}

                {/* 轮询状态提示 */}
                <div className="flex items-center justify-center space-x-1.5 text-[11px] text-neutral-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>正在实时检测支付结果…</span>
                </div>
              </div>
            )
          ) : (
            /* ============ 静态收款码模式（原有逻辑，保留为回退） ============ */
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
                请您识别上面二维码，如实支付显示金额
              </p>
            </div>
          )}

          {/* Actions */}
          {(!isDynamic || !dynamicPay) && (
            <div className="space-y-2 pt-1">
              {confirmDelayLeft > 0 ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 bg-neutral-100 text-neutral-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center space-x-1.5"
                >
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>请先识别二维码完成支付（{confirmDelayLeft} 秒后可确认）</span>
                </button>
              ) : (
                <button
                  onClick={onConfirmPaid}
                  disabled={isConfirming}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-all active:scale-98 disabled:opacity-70"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isConfirming ? '提交中...' : '我已完成扫码支付'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                disabled={isConfirming}
                className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium rounded-xl transition-colors"
              >
                稍后再付 / 关闭
              </button>
            </div>
          )}

          {isDynamic && (
            <button
              onClick={onClose}
              disabled={isConfirming || paidDetected}
              className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium rounded-xl transition-colors"
            >
              {paidDetected ? '确认中...' : '稍后再付 / 关闭'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
