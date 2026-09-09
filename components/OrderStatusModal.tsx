'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Check,
  RefreshCw,
  CreditCard,
  Truck,
  MapPin,
  Sparkles,
  Phone,
  User,
} from 'lucide-react';
import { Order } from '@/types';
import PaymentModal from './PaymentModal';

interface OrderStatusModalProps {
  orderId: string | null;
  onClose: () => void;
  isNewlyCreated?: boolean;
  qrCodeUrl?: string;
  onPaymentSuccess?: () => void;
}

export default function OrderStatusModal({
  orderId,
  onClose,
  isNewlyCreated = false,
  qrCodeUrl = '',
  onPaymentSuccess,
}: OrderStatusModalProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const [showPayModal, setShowPayModal] = useState(false);
  const [confirmingPay, setConfirmingPay] = useState(false);

  const fetchOrder = React.useCallback(
    async (showSpinner = false) => {
      if (!orderId) return;
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;

        const data = await res.json();
        if (data.success && data.data) {
          setOrder(data.data);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        console.warn('Order status poll notice:', err);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    const loadInitial = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;

        const data = await res.json();
        if (isMounted && data.success && data.data) {
          setOrder(data.data);
          setLastRefreshed(new Date());
        }
      } catch (err) {
        console.warn('Order status load notice:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitial();

    const timer = setInterval(() => {
      fetchOrder(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [orderId, fetchOrder]);

  if (!orderId) return null;

  const handleConfirmPay = async () => {
    if (!order) return;
    setConfirmingPay(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: '已支付' }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayModal(false);
        await fetchOrder(true);
        if (onPaymentSuccess) onPaymentSuccess();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmingPay(false);
    }
  };

  const getStepIndex = (status?: string) => {
    switch (status) {
      case '待处理':
        return 1;
      case '制作中':
        return 2;
      case '已完成':
        return 3;
      case '已取消':
        return -1;
      default:
        return 1;
    }
  };

  const stepIndex = getStepIndex(order?.status);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          {/* Header Notification Banner */}
          {isNewlyCreated && (
            <div className="bg-emerald-500 text-white px-5 py-3.5 flex items-center space-x-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div className="text-xs">
                <span className="font-bold">下单成功！</span>
                <span className="opacity-90">后厨已收到您的菜单，正在准备中。</span>
              </div>
            </div>
          )}

          {/* Title bar */}
          <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-neutral-900 text-base">订单状态追踪</h3>
              <button
                onClick={() => fetchOrder(true)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors"
                title="刷新状态"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Step Progress Bar */}
            {stepIndex !== -1 ? (
              <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80">
                <div className="relative flex justify-between items-center mb-2">
                  <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-neutral-200 -z-0">
                    <div
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{
                        width: stepIndex === 1 ? '0%' : stepIndex === 2 ? '50%' : '100%',
                      }}
                    />
                  </div>

                  {/* Step 1 */}
                  <div className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        stepIndex >= 1
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold mt-1 text-neutral-800">已接单</span>
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        stepIndex >= 2
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      <ChefHat className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold mt-1 text-neutral-800">大厨现炒</span>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-center relative z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        stepIndex >= 3
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-neutral-200 text-neutral-500'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-bold mt-1 text-neutral-800">
                      {order?.order_type === '外卖' ? '配送完成' : '已上齐'}
                    </span>
                  </div>
                </div>

                <div className="text-center text-xs text-neutral-500 mt-2">
                  {stepIndex === 1 && '后厨已打印菜票，正在排单洗菜切配...'}
                  {stepIndex === 2 && '大厨正猛火现炒，色香味俱全即将出锅！'}
                  {stepIndex === 3 &&
                    (order?.order_type === '外卖'
                      ? '餐品已妥善送达，祝您用餐愉快！'
                      : '菜品已全部上齐，请慢用！如有需要请联系服务员。')}
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl border border-rose-200 text-center text-xs">
                该订单已被取消。如有疑问请咨询店内工作人员。
              </div>
            )}

            {/* Payment & Order Info Overview */}
            <div className="space-y-2 text-xs border border-neutral-100 p-3.5 rounded-2xl bg-white shadow-2xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span>订单编号：</span>
                <span className="font-mono font-medium text-neutral-900">{order?.id || orderId}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span>就餐方式：</span>
                <span className="font-bold flex items-center space-x-1 text-neutral-800">
                  {order?.order_type === '外卖' ? (
                    <>
                      <Truck className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-amber-800">送餐到家 (外卖)</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-amber-800">{order?.table_no}</span>
                    </>
                  )}
                </span>
              </div>

              {order?.order_type === '外卖' && (
                <>
                  <div className="flex justify-between text-neutral-600 pt-1 border-t border-neutral-100">
                    <span>送达地址：</span>
                    <span className="text-neutral-900 font-medium max-w-[200px] text-right">
                      {order.delivery_address || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>联系电话：</span>
                    <span className="text-neutral-900">
                      {order.delivery_contact} ({order.delivery_phone})
                    </span>
                  </div>
                </>
              )}

              {/* Payment Status Bar */}
              <div className="flex justify-between items-center pt-2 border-t border-neutral-100">
                <span>付款状态：</span>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      order?.payment_status === '已支付'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {order?.payment_status === '已支付' ? '✓ 已支付' : '未支付 (待结账)'}
                  </span>
                  {order?.payment_status === '未支付' && (
                    <button
                      onClick={() => setShowPayModal(true)}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-[10px] font-bold shadow-xs transition-colors flex items-center space-x-1"
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>立即结账</span>
                    </button>
                  )}
                </div>
              </div>

              {order?.notes && (
                <div className="flex justify-between text-neutral-600 pt-1 border-t border-neutral-100">
                  <span>口味备注：</span>
                  <span className="text-neutral-800 font-medium">{order.notes}</span>
                </div>
              )}
            </div>

            {/* Dishes List in Order */}
            <div>
              <h4 className="text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
                所点菜品明细
              </h4>
              <div className="bg-neutral-50 rounded-2xl p-3 divide-y divide-neutral-100">
                {order?.items && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <div key={index} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium text-neutral-800 flex items-center flex-wrap gap-1.5">
                          <span>{item.dish_name}</span>
                          <span className="text-neutral-400 font-normal">x {item.quantity}</span>
                          {item.taste && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-normal border border-amber-200/60">
                              {item.taste}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-neutral-900">
                        ¥{item.subtotal.toFixed(2)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-neutral-400 text-center py-2">加载明细中...</div>
                )}

                {/* Price Breakdown */}
                <div className="pt-3 mt-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-neutral-600">
                    <span>菜品原总价</span>
                    <span>¥{(order?.total_amount || 0).toFixed(2)}</span>
                  </div>

                  {(order?.points_discount || 0) > 0 && (
                    <div className="flex items-center justify-between text-amber-700">
                      <span className="flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>积分抵扣现金 ({order?.points_used}分)</span>
                      </span>
                      <span className="font-bold">-¥{order?.points_discount?.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-neutral-900 pt-1 border-t border-neutral-200">
                    <span className="font-bold">实付结账金额</span>
                    <span className="text-base font-black text-rose-600">
                      ¥{(order?.final_amount !== undefined ? order.final_amount : order?.total_amount || 0).toFixed(2)}
                    </span>
                  </div>

                  {(order?.points_earned || 0) > 0 && (
                    <div className="text-[11px] text-emerald-700 text-right">
                      本单已赠送积分：+{order?.points_earned} 分
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-[11px] text-neutral-400">
              自动同步进度 · {lastRefreshed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-neutral-800 text-white hover:bg-neutral-900 transition-colors"
            >
              关闭窗口
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal if user clicks 立即结账 */}
      {showPayModal && order && (
        <PaymentModal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          amount={order.final_amount !== undefined ? order.final_amount : order.total_amount}
          originalAmount={order.total_amount}
          pointsDiscount={order.points_discount}
          qrCodeUrl={qrCodeUrl}
          tableOrOrderInfo={`订单号: ${order.id} · ${order.order_type === '外卖' ? '送餐到家' : order.table_no}`}
          isConfirming={confirmingPay}
          onConfirmPaid={handleConfirmPay}
        />
      )}
    </>
  );
}
