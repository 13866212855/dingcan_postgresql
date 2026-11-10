'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChefHat,
  Bike,
  UtensilsCrossed,
  Layers,
  Sparkles,
  Phone,
  MapPin,
  FileText,
} from 'lucide-react';
import { Order, OrderItem } from '@/types';
import { parseJsonResponse } from '@/lib/utils';
import { isReadyMadeDish, classifyOrderDishes } from '@/lib/dishClassifier';

interface KitchenDisplayViewProps {
  tenantId?: string;
  isStaffKitchen?: boolean; // 是否以后厨专员身份登录
}

// 格式化等待时长
function formatWaitTime(createdAt: string): { text: string; minutes: number; isUrgent: boolean } {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - created) / 1000));
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  const text = `${minutes}分${seconds < 10 ? '0' : ''}${seconds}秒`;
  return {
    text,
    minutes,
    isUrgent: minutes >= 15, // 超过15分钟告警
  };
}

export default function KitchenDisplayView({
  tenantId = 'default',
  isStaffKitchen = false,
}: KitchenDisplayViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState<'all_active' | 'ready_only' | 'cooking_only' | 'completed'>('all_active');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // 1秒刷新一次计时器以实时更新已等候时长
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % 100000), 1000);
    return () => clearInterval(timer);
  }, []);

  // 播放出餐/接单提示音
  const playChime = useCallback((type: 'new' | 'ready' = 'new') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (type === 'ready') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.18); // E5
      }

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // 忽略音频限制
    }
  }, []);

  // 拉取后厨订单
  const fetchKitchenOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/orders?tenant=${encodeURIComponent(tenantId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await parseJsonResponse(res);
      if (data?.success && Array.isArray(data.data)) {
        setOrders(data.data);
      } else {
        setError(data?.error || '拉取后厨订单失败');
      }
    } catch (e: any) {
      setError('网络请求失败: ' + (e?.message || ''));
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [tenantId]);

  // 定时静默轮询 (每 6 秒一次，确保后厨出单实时性)
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/orders?tenant=${encodeURIComponent(tenantId)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const data = await parseJsonResponse(res);
        if (!ignore && data?.success && Array.isArray(data.data)) {
          setOrders(data.data);
        }
      } catch (e: any) {
        if (!ignore) setError('网络请求失败: ' + (e?.message || ''));
      }
    };
    run();
    const interval = setInterval(() => {
      fetchKitchenOrders(true);
    }, 6000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [tenantId, fetchKitchenOrders]);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // 状态更新操作
  const handleUpdateKitchenStatus = async (
    order: Order,
    newKitchenStatus: '制作中' | '已备齐',
    newOrderStatus?: '制作中' | '已完成'
  ) => {
    setActionLoadingId(order.id);
    try {
      const targetOrderStatus =
        newOrderStatus ||
        (newKitchenStatus === '已备齐'
          ? order.order_type === '堂食'
            ? '已完成'
            : '制作中'
          : '制作中');

      const res = await fetch(`/api/orders/${order.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetOrderStatus,
          kitchenStatus: newKitchenStatus,
        }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        if (soundEnabled) playChime('ready');
        await fetchKitchenOrders(true);
      } else {
        alert(data?.error || '状态更新失败');
      }
    } catch (e: any) {
      alert('请求失败: ' + (e?.message || ''));
    } finally {
      setActionLoadingId(null);
    }
  };

  // 过滤活跃订单
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status === '待处理' || o.status === '制作中');
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders.filter((o) => o.status === '已完成').slice(0, 20);
  }, [orders]);

  // 待做菜品全店聚合汇总 (批量看板，供厨师一眼扫视)
  const dishAggregation = useMemo(() => {
    const map: Record<
      string,
      { name: string; quantity: number; isReady: boolean; tasteNotes: string[] }
    > = {};

    for (const order of activeOrders) {
      if (order.kitchen_status === '已备齐') continue;
      for (const item of order.items || []) {
        const key = item.dish_name;
        if (!map[key]) {
          map[key] = {
            name: key,
            quantity: 0,
            isReady: isReadyMadeDish(key),
            tasteNotes: [],
          };
        }
        map[key].quantity += item.quantity || 1;
        if (item.taste && !map[key].tasteNotes.includes(item.taste)) {
          map[key].tasteNotes.push(item.taste);
        }
      }
    }

    return Object.values(map).sort((a, b) => {
      // 炒菜排前面，现成排后面
      if (a.isReady !== b.isReady) return a.isReady ? 1 : -1;
      return b.quantity - a.quantity;
    });
  }, [activeOrders]);

  // 按选择的模式展示卡片列表
  const displayedOrders = useMemo(() => {
    if (filterMode === 'completed') return completedOrders;

    return activeOrders.filter((o) => {
      const { allReadyMade, hasCooking } = classifyOrderDishes(o.items);
      if (filterMode === 'ready_only') return allReadyMade;
      if (filterMode === 'cooking_only') return hasCooking;
      return true;
    });
  }, [activeOrders, completedOrders, filterMode]);

  return (
    <div className="space-y-4">
      {/* 顶部控制栏 */}
      <div className="bg-neutral-900 text-white p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-neutral-800">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <ChefHat className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black tracking-tight flex items-center space-x-2">
                <span>后厨备餐出餐大屏</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  KDS 实时看板
                </span>
              </h1>
              {isStaffKitchen && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                  后厨专属工作台
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              现成常备菜支持「⚡ 一键齐餐」，现炒菜品分工明确，与配送骑手并行作业
            </p>
          </div>
        </div>

        {/* 快捷操作与状态统计 */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* 待备餐计数 */}
          <div className="px-3 py-1.5 rounded-xl bg-neutral-800/80 border border-neutral-700/80 text-xs flex items-center space-x-2">
            <span className="text-neutral-400">待备餐:</span>
            <span className="text-amber-400 font-black text-sm">{activeOrders.length} 单</span>
          </div>

          {/* 声音开关 */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playChime('new');
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
            }`}
            title="新单提醒与出餐提示音"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? '提示音已开启' : '提示音已静音'}</span>
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={() => fetchKitchenOrders()}
            disabled={loading}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
            title="刷新后厨单据"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* 全屏按钮 */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="平板/电视全屏展示"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullscreen ? '退出全屏' : '全屏大屏'}</span>
          </button>
        </div>
      </div>

      {/* 待做菜品全店聚合面板（汇总统计） */}
      {dishAggregation.length > 0 && filterMode !== 'completed' && (
        <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-black text-amber-900">
                当前待出菜品批量汇总（共 {dishAggregation.reduce((acc, d) => acc + d.quantity, 0)} 份待配）
              </span>
            </div>
            <span className="text-[11px] text-amber-700/80">
              厨师一眼看清全锅炒制量，现成菜可统一提前装盘
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {dishAggregation.map((dish) => (
              <div
                key={dish.name}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-2 shadow-2xs transition-all ${
                  dish.isReady
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-white border-orange-300 text-orange-950 ring-1 ring-orange-400/20'
                }`}
              >
                <span>{dish.isReady ? '⚡' : '🔥'}</span>
                <span>{dish.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md font-black text-xs ${
                    dish.isReady ? 'bg-blue-200/70 text-blue-900' : 'bg-orange-500 text-white'
                  }`}
                >
                  ×{dish.quantity}
                </span>
                {dish.tasteNotes.length > 0 && (
                  <span className="text-[10px] text-amber-700 font-normal">
                    ({dish.tasteNotes.join('/')})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 视图筛选标签 */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterMode('all_active')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            filterMode === 'all_active'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
          }`}
        >
          <span>全部待备餐</span>
          <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-neutral-700 text-white">
            {activeOrders.length}
          </span>
        </button>

        <button
          onClick={() => setFilterMode('ready_only')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            filterMode === 'ready_only'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>⚡ 仅现成装配 (秒级出餐)</span>
          <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-blue-100 text-blue-800">
            {activeOrders.filter((o) => classifyOrderDishes(o.items).allReadyMade).length}
          </span>
        </button>

        <button
          onClick={() => setFilterMode('cooking_only')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            filterMode === 'cooking_only'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-orange-800 border border-orange-200 hover:bg-orange-50'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>🔥 需起锅现炒</span>
          <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-orange-100 text-orange-800">
            {activeOrders.filter((o) => classifyOrderDishes(o.items).hasCooking).length}
          </span>
        </button>

        <button
          onClick={() => setFilterMode('completed')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
            filterMode === 'completed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>已出餐记录 ({completedOrders.length})</span>
        </button>
      </div>

      {/* 订单卡片列表网格 */}
      {displayedOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-12 text-center shadow-2xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">当前没有待出餐订单</h3>
          <p className="text-xs text-neutral-500 mt-1">后厨工作井然有序，新单到达时将自动响铃并刷新</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedOrders.map((order) => {
            const { hasCooking, allReadyMade } = classifyOrderDishes(order.items);
            const wait = formatWaitTime(order.created_at);
            const isCookingNow = order.kitchen_status === '制作中';
            const isKitchenReady = order.kitchen_status === '已备齐';
            const isLoadingThis = actionLoadingId === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border-2 transition-all shadow-sm flex flex-col justify-between overflow-hidden ${
                  isKitchenReady
                    ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                    : wait.isUrgent
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : isCookingNow
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : allReadyMade
                    ? 'border-blue-400'
                    : 'border-neutral-200'
                }`}
              >
                {/* 卡片头部 */}
                <div
                  className={`p-3.5 border-b ${
                    wait.isUrgent
                      ? 'bg-rose-50 border-rose-200 text-rose-950'
                      : allReadyMade
                      ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                      : isCookingNow
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* 桌号 / 外卖标识 */}
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl font-black text-sm ${
                          order.order_type === '堂食'
                            ? 'bg-neutral-900 text-white'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {order.order_type === '堂食'
                          ? `🍽️ ${order.table_no || '堂食'} 号桌`
                          : '🛵 外卖配送'}
                      </span>

                      {/* 订单单号末4位 */}
                      <span className="text-[11px] font-mono font-bold text-neutral-500">
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                    </div>

                    {/* 等候时间计时器 */}
                    <div
                      className={`flex items-center space-x-1 text-xs font-bold px-2 py-0.5 rounded-lg ${
                        wait.isUrgent
                          ? 'bg-rose-500 text-white animate-pulse'
                          : wait.minutes >= 8
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-neutral-200/80 text-neutral-700'
                      }`}
                      title="距离下单时间已过"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{wait.text}</span>
                    </div>
                  </div>

                  {/* 现成 / 现炒 特性标识 */}
                  <div className="mt-2 flex items-center justify-between text-xs">
                    {allReadyMade ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-black text-[11px]">
                        <Zap className="w-3 h-3 text-blue-600" />
                        <span>⚡ 全现成常备单 (可秒出)</span>
                      </span>
                    ) : hasCooking ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 font-bold text-[11px]">
                        <Flame className="w-3 h-3 text-orange-600" />
                        <span>🔥 含现炒制作</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">标准单据</span>
                    )}

                    {/* 骑手状态提示（如果是外卖） */}
                    {order.order_type === '外卖' && (
                      <span className="text-[10px] text-neutral-500 flex items-center space-x-1">
                        <Bike className="w-3 h-3 text-blue-600" />
                        <span>
                          {order.rider_name
                            ? `骑手【${order.rider_name}】已接单`
                            : '等待骑手抢单'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 菜品明细清单 */}
                <div className="p-3.5 space-y-2.5 flex-1 divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                  {(order.items || []).map((item, idx) => {
                    const isReady = isReadyMadeDish(item.dish_name);

                    return (
                      <div key={idx} className="pt-2 first:pt-0">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-1.5 flex-1 pr-2">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold shrink-0 mt-0.5 ${
                                isReady
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {isReady ? '⚡ 现成' : '🔥 现炒'}
                            </span>
                            <span className="text-sm font-bold text-neutral-900 leading-snug">
                              {item.dish_name}
                            </span>
                          </div>
                          <span className="text-base font-black text-amber-600 shrink-0">
                            ×{item.quantity}
                          </span>
                        </div>

                        {/* 口味与制作要求（黄色重点高亮） */}
                        {item.taste && (
                          <div className="mt-1 ml-6 inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-300">
                            👉 {item.taste}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 整单整单顾客留言备注 */}
                  {order.notes && (
                    <div className="pt-2">
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">顾客留言：</span>
                          <span>{order.notes}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 外卖收货地址预览 */}
                  {order.order_type === '外卖' && order.delivery_address && (
                    <div className="pt-1 text-[11px] text-neutral-500 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span className="truncate">{order.delivery_address}</span>
                    </div>
                  )}
                </div>

                {/* 卡片底部操作按钮 */}
                <div className="p-3 bg-neutral-50 border-t border-neutral-100">
                  {order.status === '已完成' ? (
                    <div className="py-2 text-center text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>已出餐完成</span>
                    </div>
                  ) : allReadyMade ? (
                    /* 全单现成菜品：提供极其醒目的【⚡ 一键齐餐出餐】大按钮 */
                    <button
                      onClick={() => handleUpdateKitchenStatus(order, '已备齐', '已完成')}
                      disabled={isLoadingThis}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black rounded-xl text-xs shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      {isLoadingThis ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-300" />
                      )}
                      <span>⚡ 一键齐餐出餐 (无需翻炒)</span>
                    </button>
                  ) : (
                    /* 含热炒制作单：常规开火制作/出餐双按钮 */
                    <div className="flex items-center space-x-2">
                      {order.kitchen_status !== '制作中' ? (
                        <button
                          onClick={() => handleUpdateKitchenStatus(order, '制作中', '制作中')}
                          disabled={isLoadingThis}
                          className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>开火制作</span>
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 px-2 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-xl text-center border border-amber-300 flex items-center justify-center space-x-1">
                          <Flame className="w-3 h-3 text-orange-600 animate-pulse" />
                          <span>锅气翻炒中...</span>
                        </div>
                      )}

                      <button
                        onClick={() => handleUpdateKitchenStatus(order, '已备齐', '已完成')}
                        disabled={isLoadingThis}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>制作完成·出餐</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
