'use client';

import React, { useEffect, useState } from 'react';
import { X, ReceiptText, ChevronRight, Clock, Truck, MapPin } from 'lucide-react';
import { Order } from '@/types';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
  orderIds: string[];
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  onSelectOrder,
  orderIds,
}: OrderHistoryModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || orderIds.length === 0) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const promises = orderIds.map(async (id) => {
          try {
            const res = await fetch(`/api/orders/${id}`, {
              headers: { Accept: 'application/json' },
              cache: 'no-store',
            });
            if (!res.ok) return null;
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) return null;
            return await res.json();
          } catch {
            return null;
          }
        });
        const results = await Promise.all(promises);
        const validOrders = results
          .filter((r) => r?.success && r?.data)
          .map((r) => r.data)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setOrders(validOrders);
      } catch (err) {
        console.warn('Failed to load order history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, orderIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ReceiptText className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-bold text-neutral-900">我的订单历史</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="text-center py-10 text-xs text-neutral-400">正在查询订单记录...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-400">
              暂无已提交的订单记录
            </div>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                onClick={() => {
                  onSelectOrder(o.id);
                  onClose();
                }}
                className="p-3.5 bg-neutral-50 hover:bg-amber-50/50 rounded-2xl border border-neutral-200/80 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-neutral-900 flex items-center space-x-1">
                      {o.order_type === '外卖' ? (
                        <>
                          <Truck className="w-3.5 h-3.5 text-amber-600" />
                          <span>送餐到家</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                          <span>{o.table_no}</span>
                        </>
                      )}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        o.status === '制作中'
                          ? 'bg-blue-100 text-blue-700'
                          : o.status === '已完成'
                          ? 'bg-emerald-100 text-emerald-700'
                          : o.status === '已取消'
                          ? 'bg-neutral-200 text-neutral-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {o.status}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        o.payment_status === '已支付'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {o.payment_status === '已支付' ? '已付' : '未付'}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-500 font-mono flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(o.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>·</span>
                    <span>共 {o.items?.reduce((acc, i) => acc + i.quantity, 0) || 0} 件菜品</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm font-black text-rose-600">
                    ¥{(o.final_amount !== undefined ? o.final_amount : o.total_amount).toFixed(2)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-amber-600 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-neutral-200 text-neutral-700 hover:bg-neutral-300 transition-colors"
          >
            返回点餐
          </button>
        </div>
      </div>
    </div>
  );
}
