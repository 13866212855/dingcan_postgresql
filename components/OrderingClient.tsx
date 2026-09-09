'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  AlertCircle,
  Sparkles,
  RefreshCw,
  QrCode,
  Truck,
  MapPin,
  Award,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import TableSelectModal from '@/components/TableSelectModal';
import DishModal from '@/components/DishModal';
import CartDrawer, { CheckoutOrderData } from '@/components/CartDrawer';
import OrderStatusModal from '@/components/OrderStatusModal';
import OrderHistoryModal from '@/components/OrderHistoryModal';
import MemberModal from '@/components/MemberModal';
import PaymentModal from '@/components/PaymentModal';
import { Dish, CartItem, DiningTable, AppUser, AppSettings } from '@/types';
import { useStorageItem, getClientUserId, safeSetItem } from '@/lib/storage';
import { safeFetchJson } from '@/lib/fetchUtils';

interface OrderingClientProps {
  initialDishes: Dish[];
  initialDesk?: string;
  initialSettings?: AppSettings | null;
  initialTables?: DiningTable[];
  initialTenantId?: string;
}

export default function OrderingClient({
  initialDishes,
  initialDesk = '',
  initialSettings = null,
  initialTables = [],
  initialTenantId = 'default',
}: OrderingClientProps) {
  // Tenant state
  const [tenantId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const t = p.get('tenant') || p.get('t');
      if (t) return t.trim();
    }
    return initialTenantId || 'default';
  });

  // Dishes state initialized with SSR data
  const [dishes, setDishes] = useState<Dish[]>(initialDishes || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtering
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart state
  const [cart, setCart] = useState<Record<number, CartItem>>({});

  // Table state
  const [currentTable, setCurrentTable] = useStorageItem('restaurant_table_no', initialDesk || '');
  const [isTableLocked] = useState(() => {
    if (initialDesk) return true;
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return Boolean(p.get('desk')?.trim());
    }
    return false;
  });
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [allTables, setAllTables] = useState<DiningTable[]>(initialTables || []);
  const [freeTables, setFreeTables] = useState<DiningTable[]>(
    (initialTables || []).filter((t) => t.is_occupied === 0)
  );

  // User & Settings state
  const [user, setUser] = useState<AppUser | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(initialSettings);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  // Modals
  const [activeDish, setActiveDish] = useState<Dish | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<CheckoutOrderData | null>(null);

  // Orders state
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isNewlyCreatedOrder, setIsNewlyCreatedOrder] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [rawOrderIds, setRawOrderIds] = useStorageItem('restaurant_my_order_ids', '[]');

  const placedOrderIds = useMemo(() => {
    try {
      const parsed = JSON.parse(rawOrderIds);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [rawOrderIds]);

  // Read URL params for ?desk=... on mount if table not set
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deskParam = params.get('desk')?.trim();
    if (deskParam && deskParam !== currentTable) {
      setCurrentTable(deskParam);
    }
  }, [currentTable, setCurrentTable]);

  // 当后台没有配置任何桌位时，若本地仍缓存了旧的“自取/未指定桌位”，自动清理以保持纯净
  useEffect(() => {
    if (!isTableLocked && currentTable === '自取/未指定桌位') {
      setCurrentTable('');
    }
  }, [isTableLocked, currentTable, setCurrentTable]);

  // Persist current active tenant to storage & cookie for seamless navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && tenantId) {
      safeSetItem('dingcan_tenant_id', tenantId);
      document.cookie = `dingcan_tenant_id=${encodeURIComponent(tenantId)}; path=/; max-age=2592000; SameSite=Lax`;
    }
  }, [tenantId]);

  // Initial load for user, settings, free tables
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadInitialData = async () => {
      const userId = getClientUserId();
      try {
        const results = await Promise.allSettled([
          userId
            ? safeFetchJson<{ success: boolean; data: AppUser }>(
                `/api/users?id=${encodeURIComponent(userId)}&tenant=${encodeURIComponent(tenantId)}`,
                { signal: abortController.signal }
              )
            : Promise.resolve(null),
          // Only fetch settings if not already provided or if tenant changed
          !initialSettings || tenantId !== initialTenantId
            ? safeFetchJson<{ success: boolean; data: AppSettings }>(
                `/api/settings?tenant=${encodeURIComponent(tenantId)}`,
                { signal: abortController.signal }
              )
            : Promise.resolve(null),
          // Only fetch tables if empty or tenant changed
          initialTables.length === 0 || tenantId !== initialTenantId
            ? safeFetchJson<{ success: boolean; data: DiningTable[] }>(
                `/api/tables?tenant=${encodeURIComponent(tenantId)}`,
                { signal: abortController.signal }
              )
            : Promise.resolve(null),
        ]);

        if (!isMounted || abortController.signal.aborted) return;

        const userRes = results[0].status === 'fulfilled' ? results[0].value : null;
        const setRes = results[1].status === 'fulfilled' ? results[1].value : null;
        const tablesRes = results[2].status === 'fulfilled' ? results[2].value : null;

        if (userRes?.success && userRes.data) {
          setUser(userRes.data);
        }
        if (setRes?.success && setRes.data) {
          setSettings(setRes.data);
        }
        if (tablesRes?.success && Array.isArray(tablesRes.data)) {
          setAllTables(tablesRes.data);
          setFreeTables(tablesRes.data.filter((t) => t.is_occupied === 0));
        }
      } catch (err: any) {
        if (isMounted && err?.name !== 'AbortError') {
          console.warn('Notice: Remote ordering sync postponed, using local/SSR data:', err?.message || err);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [tenantId, initialSettings, initialTables, initialTenantId]);

  // Refresh User and Settings (on demand)
  const fetchUserAndSettings = useCallback(async () => {
    const userId = getClientUserId();
    if (!userId) return;

    try {
      const [userRes, setRes] = await Promise.allSettled([
        safeFetchJson<{ success: boolean; data: AppUser }>(
          `/api/users?id=${encodeURIComponent(userId)}&tenant=${encodeURIComponent(tenantId)}`
        ),
        safeFetchJson<{ success: boolean; data: AppSettings }>(
          `/api/settings?tenant=${encodeURIComponent(tenantId)}`
        ),
      ]);
      const userData = userRes.status === 'fulfilled' ? userRes.value : null;
      const setData = setRes.status === 'fulfilled' ? setRes.value : null;

      if (userData?.success && userData.data) {
        setUser(userData.data);
      }
      if (setData?.success && setData.data) {
        setSettings(setData.data);
      }
    } catch (e: any) {
      console.warn('Notice: User/settings reload postponed:', e?.message || e);
    }
  }, [tenantId]);

  // Refresh free tables (on demand)
  const fetchFreeTables = useCallback(async () => {
    try {
      const data = await safeFetchJson<{ success: boolean; data: DiningTable[] }>(
        `/api/tables?onlyFree=true&tenant=${encodeURIComponent(tenantId)}`
      );
      if (data?.success && Array.isArray(data.data)) {
        setFreeTables(data.data);
      }
    } catch (e: any) {
      console.warn('Notice: Tables reload postponed:', e?.message || e);
    }
  }, [tenantId]);

  // Refresh dishes
  const fetchDishes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const json = await safeFetchJson<{ success: boolean; data: Dish[]; error?: string }>(
        `/api/dishes?tenant=${encodeURIComponent(tenantId)}`
      );
      if (json?.success && Array.isArray(json.data)) {
        setDishes(json.data);
      } else {
        setError(json?.error || '获取菜品失败');
      }
    } catch (err: any) {
      setError(err?.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const handleTableChange = (newTable: string) => {
    setCurrentTable(newTable);
  };

  // Cart operations
  const addToCart = (dish: Dish) => {
    if (dish.status !== 1) return;
    setCart((prev) => {
      const existing = prev[dish.id];
      const newQty = existing ? existing.quantity + 1 : 1;
      return {
        ...prev,
        [dish.id]: { dish, quantity: newQty },
      };
    });
  };

  const removeFromCart = (dish: Dish) => {
    setCart((prev) => {
      const existing = prev[dish.id];
      if (!existing) return prev;
      if (existing.quantity <= 1) {
        const next = { ...prev };
        delete next[dish.id];
        return next;
      }
      return {
        ...prev,
        [dish.id]: { dish, quantity: existing.quantity - 1 },
      };
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const cartList = useMemo(() => Object.values(cart), [cart]);

  const { totalQuantity, totalPrice } = useMemo(() => {
    let q = 0;
    let p = 0;
    for (const item of cartList) {
      q += item.quantity;
      p += item.dish.price * item.quantity;
    }
    return { totalQuantity: q, totalPrice: Math.round(p * 100) / 100 };
  }, [cartList]);

  // Submit order execution
  const executeSubmitOrder = async (orderData: CheckoutOrderData, paymentStatus: '未支付' | '已支付') => {
    setIsSubmitting(true);
    try {
      const userId = getClientUserId();
      const payload = {
        tableNo: orderData.tableNo,
        orderType: orderData.orderType,
        deliveryAddress: orderData.deliveryAddress,
        deliveryContact: orderData.deliveryContact,
        deliveryPhone: orderData.deliveryPhone,
        paymentTiming: orderData.paymentTiming,
        paymentStatus,
        pointsUsed: orderData.pointsUsed,
        notes: orderData.notes,
        userId,
        tenant_id: tenantId,
        items: cartList.map((item) => ({
          dishId: item.dish.id,
          quantity: item.quantity,
          taste: orderData.itemTastes?.[item.dish.id] || '',
        })),
      };

      const res = await fetch(`/api/orders?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '下单失败');
      }

      // Success
      clearCart();
      setIsCartOpen(false);
      setIsPaymentModalOpen(false);
      setPendingCheckoutData(null);

      // Save order id to local state
      const createdOrder = data.data;
      const newOrders = [createdOrder.id, ...placedOrderIds];
      setRawOrderIds(JSON.stringify(newOrders));

      setActiveOrderId(createdOrder.id);
      setIsNewlyCreatedOrder(true);

      // Refresh user profile (points updated) and free tables
      fetchUserAndSettings();
      fetchFreeTables();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called from CartDrawer checkout button
  const handleStartCheckout = async (orderData: CheckoutOrderData) => {
    if (orderData.paymentTiming === '餐前付款' || orderData.orderType === '外卖') {
      // Must open PaymentModal first
      setPendingCheckoutData(orderData);
      setIsPaymentModalOpen(true);
    } else {
      // 餐后付款: directly create order as '未支付'
      await executeSubmitOrder(orderData, '未支付');
    }
  };

  // Confirm payment in PaymentModal
  const handleConfirmPaidInModal = async () => {
    if (!pendingCheckoutData) return;
    await executeSubmitOrder(pendingCheckoutData, '已支付');
  };

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return ['全部', ...Array.from(set)];
  }, [dishes]);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchCat = selectedCategory === '全部' || dish.category === selectedCategory;
      const matchSearch =
        !searchQuery.trim() ||
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dish.description && dish.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [dishes, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col antialiased text-neutral-800">
      {/* Top Navbar */}
      <Navbar
        currentTable={currentTable}
        isTableLocked={isTableLocked}
        hasTables={allTables.length > 0}
        onChangeTable={() => {
          fetchFreeTables();
          setIsTableModalOpen(true);
        }}
        onOpenOrders={() => setIsHistoryModalOpen(true)}
        onOpenMemberModal={() => setIsMemberModalOpen(true)}
        user={user}
        orderCount={placedOrderIds.length}
        restaurantName={settings?.restaurant_name}
        restaurantLogo={settings?.restaurant_logo}
        restaurantSlogan={settings?.restaurant_slogan}
        tenantId={tenantId}
      />

      {/* QR Code Desk Announcement Banner */}
      {isTableLocked && (
        <div className="bg-amber-500 text-white text-xs py-2 px-4 shadow-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-amber-200 shrink-0" />
              <span>
                您已通过餐桌专属二维码成功入座：<strong>{currentTable}</strong>，点餐将自动送达！
              </span>
            </div>
            <button
              onClick={() => setIsTableModalOpen(true)}
              className="text-[11px] underline text-amber-100 hover:text-white shrink-0 ml-2"
            >
              更换桌号
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-28 space-y-5">
        {/* Search Bar & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索招牌菜、热炒、时蔬、饮品..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-neutral-400 hover:text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded-md"
              >
                清除
              </button>
            )}
          </div>
          <button
            onClick={fetchDishes}
            disabled={loading}
            title="刷新菜品"
            className="p-2.5 bg-white border border-neutral-200 rounded-2xl hover:bg-neutral-50 text-neutral-600 shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-neutral-600 border border-neutral-200/80 hover:bg-neutral-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Dishes Grid */}
        <div>
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center space-x-3 text-xs text-rose-700 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {filteredDishes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200/70 p-6">
              <Sparkles className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-neutral-700">没有找到匹配的菜品</p>
              <p className="text-xs text-neutral-400 mt-1">请尝试切换分类或搜索其他关键词</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDishes.map((dish) => {
                const inCartQty = cart[dish.id]?.quantity || 0;
                const isSoldOut = dish.status !== 1;

                return (
                  <div
                    key={dish.id}
                    className={`bg-white rounded-2xl border border-neutral-200/70 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col ${
                      isSoldOut ? 'opacity-70 grayscale-[30%]' : ''
                    }`}
                  >
                    {/* Dish Image */}
                    <div
                      className="relative h-44 w-full bg-neutral-100 cursor-pointer overflow-hidden group"
                      onClick={() => setActiveDish(dish)}
                    >
                      <Image
                        src={dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                        alt={dish.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="text-[10px] bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-full font-medium">
                          {dish.category}
                        </span>
                      </div>
                      {isSoldOut && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center">
                          <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                            已售罄
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dish Information */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h3
                          onClick={() => setActiveDish(dish)}
                          className="font-bold text-neutral-900 text-sm hover:text-amber-600 transition-colors cursor-pointer line-clamp-1"
                        >
                          {dish.name}
                        </h3>
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-1 leading-relaxed">
                          {dish.description || '精选优质新鲜食材，大厨地道现炒。'}
                        </p>
                      </div>

                      {/* Price & Cart Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="text-rose-600 font-black text-lg leading-none">
                          <span className="text-xs font-bold">¥</span>
                          {dish.price}
                        </div>

                        {!isSoldOut && (
                          <div className="flex items-center space-x-2">
                            {inCartQty > 0 ? (
                              <>
                                <button
                                  onClick={() => removeFromCart(dish)}
                                  className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center active:scale-90 transition-transform"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-xs font-bold text-neutral-900 w-4 text-center">
                                  {inCartQty}
                                </span>
                                <button
                                  onClick={() => addToCart(dish)}
                                  className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center active:scale-90 transition-transform shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => addToCart(dish)}
                                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center space-x-1 active:scale-95 transition-all shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>选购</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalQuantity > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-neutral-900 text-white rounded-3xl p-3 px-4 shadow-2xl flex items-center justify-between border border-neutral-800 backdrop-blur-md">
            <div
              className="flex items-center space-x-3 cursor-pointer flex-1"
              onClick={() => {
                fetchFreeTables();
                setIsCartOpen(true);
              }}
            >
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-md">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-neutral-900">
                  {totalQuantity}
                </span>
              </div>

              <div>
                <div className="text-base font-black text-white leading-tight">
                  <span className="text-xs font-medium text-neutral-400">合计：</span>
                  <span className="text-amber-400">¥{totalPrice.toFixed(2)}</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  {currentTable && currentTable !== '自取/未指定桌位'
                    ? `当前桌号: ${currentTable}`
                    : (allTables.length > 0 ? '到店堂食 / 外卖送餐' : '现点现做 · 美味即享')}
                </div>
              </div>
            </div>

            <button
              id="btn-checkout"
              onClick={() => {
                fetchFreeTables();
                setIsCartOpen(true);
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-2xl shadow-md active:scale-95 transition-all"
            >
              去结算
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <DishModal
        dish={activeDish}
        onClose={() => setActiveDish(null)}
        onAdd={addToCart}
        onRemove={removeFromCart}
        quantityInCart={activeDish ? cart[activeDish.id]?.quantity || 0 : 0}
      />

      <TableSelectModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        currentTable={currentTable}
        onSelectTable={handleTableChange}
        tenantId={tenantId}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartList}
        totalPrice={totalPrice}
        totalQuantity={totalQuantity}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onClear={clearCart}
        currentTable={currentTable}
        isTableLocked={isTableLocked}
        onChangeTable={handleTableChange}
        freeTables={freeTables}
        totalTablesCount={allTables.length}
        user={user}
        onOpenMemberModal={() => setIsMemberModalOpen(true)}
        settings={settings}
        onSubmitOrder={handleStartCheckout}
        isSubmitting={isSubmitting}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirmPaid={handleConfirmPaidInModal}
        amount={pendingCheckoutData?.finalAmount ?? totalPrice}
        originalAmount={totalPrice}
        pointsDiscount={pendingCheckoutData?.pointsDiscount ?? 0}
        qrCodeUrl={settings?.payment_qr_code}
        tableOrOrderInfo={
          pendingCheckoutData
            ? pendingCheckoutData.orderType === '外卖'
              ? `送餐外卖 · ${pendingCheckoutData.deliveryAddress}`
              : `到店堂食 · ${pendingCheckoutData.tableNo}`
            : ''
        }
        isConfirming={isSubmitting}
      />

      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        user={user}
        pointsRatio={settings?.points_ratio || 1}
        onUserUpdated={(u) => setUser(u)}
        tenantId={tenantId}
      />

      <OrderStatusModal
        orderId={activeOrderId}
        onClose={() => {
          setActiveOrderId(null);
          setIsNewlyCreatedOrder(false);
        }}
        isNewlyCreated={isNewlyCreatedOrder}
        qrCodeUrl={settings?.payment_qr_code}
        onPaymentSuccess={() => {
          fetchUserAndSettings();
        }}
      />

      <OrderHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        orderIds={placedOrderIds}
        onSelectOrder={(id) => {
          setActiveOrderId(id);
          setIsNewlyCreatedOrder(false);
        }}
      />
    </div>
  );
}
