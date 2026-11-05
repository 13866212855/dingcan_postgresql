'use client';

import React from 'react';
import { X, QrCode, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Loader2, Smartphone, ExternalLink } from 'lucide-react';
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

  // 静态收款码模式：确认按钮三重门禁——
  // ① 基础延迟：每次打开随机 20~28 秒（预留真实支付时间；随机化让"干等过期"无法掐点）
  // ② 移动端额外要求：长按过二维码（识别手势）且发生过"页面切出→切回"（进入微信付款面板再返回）
  // ③ 45 秒防锁死逃生口：即使信号未齐也放行（避免真实付款顾客被卡死无法确认）
  // UI 状态盲化：占位按钮不显示倒计时/进度动画，计时阶段与动作门禁阶段共用同一文案——
  // 未付款者无法从界面分辨还差多久、卡在哪道门
  const CONFIRM_DELAY_BASE = 20;
  const CONFIRM_DELAY_JITTER = 9; // +0~8s → 每次打开 20~28s 随机
  const CONFIRM_ESCAPE_SECONDS = 45;
  const [confirmDelayLeft, setConfirmDelayLeft] = React.useState(0);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [longPressed, setLongPressed] = React.useState(false);
  const [returnedAfterHidden, setReturnedAfterHidden] = React.useState(false);
  const pressStartRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isOpen || isDynamic) return;
    setConfirmDelayLeft(CONFIRM_DELAY_BASE + Math.floor(Math.random() * CONFIRM_DELAY_JITTER));
    setElapsedSec(0);
    setLongPressed(false);
    setReturnedAfterHidden(false);
    const t = setInterval(() => {
      setConfirmDelayLeft((s) => (s > 0 ? s - 1 : 0));
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [isOpen, isDynamic]);

  // 可见性往返探测：微信内长按识别成功→收款面板弹出→本页 hidden；付款完成返回→ visible
  React.useEffect(() => {
    if (!isOpen || isDynamic) return;
    let hiddenOnce = false;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenOnce = true;
      } else if (hiddenOnce) {
        setReturnedAfterHidden(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isOpen, isDynamic]);

  // ⚠ Hooks 顺序红线：所有 React hook 必须位于下方 `if (!isOpen) return null` 之前，
  // 否则弹窗关闭/打开两态 hook 数量不一致 → React #310 "Rendered more hooks" 白屏崩溃

  // 积分即时立减金额（静态码模式：实付=标价×(1-积分比例)，由服务端算入 amount/final_amount）
  const rebateAmount = React.useMemo(() => {
    if (originalAmount === undefined) return 0;
    const payable = isDynamic ? dynamicPay.amount : amount;
    const r = Math.round((originalAmount - pointsDiscount - payable) * 100) / 100;
    return r > 0.005 ? r : 0;
  }, [originalAmount, pointsDiscount, amount, isDynamic, dynamicPay]);
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

  // 确认按钮门禁判定（仅静态模式使用）
  const actionGatesPassed =
    !isMobile || (longPressed && returnedAfterHidden) || elapsedSec >= CONFIRM_ESCAPE_SECONDS;
  const canConfirmStatic = confirmDelayLeft === 0 && actionGatesPassed;

  // 长按识别手势探测（≥400ms 视为长按；不阻断系统菜单，只做记录）
  const handlePressStart = () => {
    pressStartRef.current = Date.now();
  };
  const handlePressEnd = () => {
    if (pressStartRef.current !== null && Date.now() - pressStartRef.current >= 400) {
      setLongPressed(true);
    }
    pressStartRef.current = null;
  };

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
            {rebateAmount > 0 && (
              <div className="text-[11px] text-emerald-700 flex items-center justify-center space-x-1 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>积分即时返 · 扫码立减 ¥{rebateAmount.toFixed(2)}</span>
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
            /* ============ 静态收款码模式（长按识别 + 支付动作门禁） ============ */
            <div
              className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex flex-col items-center justify-center select-none"
              onPointerDown={handlePressStart}
              onPointerUp={handlePressEnd}
              onPointerCancel={() => { pressStartRef.current = null; }}
              onContextMenu={() => setLongPressed(true)}
            >
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
                {isMobile
                  ? '请您识别上面二维码，如实支付显示金额'
                  : <span>请用手机「扫一扫」上方二维码，如实输入金额 <strong className="text-neutral-700 font-bold">¥{amount.toFixed(2)}</strong> 完成支付</span>}
              </p>

              {/* 移动端支付动作步骤提示（兼作门禁进度反馈） */}
              {isMobile && (
                <div className="mt-2.5 w-full px-2 flex items-center justify-center gap-2 text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      longPressed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                        : 'bg-white border-neutral-200 text-neutral-400'
                    }`}
                  >
                    {longPressed ? '✓ 已识别二维码' : '① 长按识别二维码'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      returnedAfterHidden
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold'
                        : 'bg-white border-neutral-200 text-neutral-400'
                    }`}
                  >
                    {returnedAfterHidden ? '✓ 已返回本页' : '② 支付后返回本页'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {(!isDynamic || !dynamicPay) && (
            <div className="space-y-2 pt-1">
              {!canConfirmStatic ? (
                /* 状态盲化占位：不显示倒计时与脉冲动画；计时阶段/动作门禁阶段共用同一文案，
                   谎报者无法从界面分辨还差多久、卡在哪道门（不暴露"等待过期"信号） */
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 bg-neutral-100 text-neutral-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center"
                >
                  <span>请先完成二维码支付</span>
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
