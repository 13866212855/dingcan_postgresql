'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Utensils,
  ClipboardList,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Clock,
  ChefHat,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Store,
  Volume2,
  VolumeX,
  XCircle,
  Eye,
  Calendar,
  MapPin,
  Users,
  Settings,
  Truck,
  CreditCard,
  Sparkles,
  BellRing,
  Building2,
  ChevronDown,
} from 'lucide-react';
import DishFormModal from '@/components/admin/DishFormModal';
import TableManagement from '@/components/admin/TableManagement';
import MemberManagement from '@/components/admin/MemberManagement';
import SettingsManagement from '@/components/admin/SettingsManagement';
import StoreManagement from '@/components/admin/StoreManagement';
import TenantManagement from '@/components/admin/TenantManagement';
import { Dish, Order, Tenant } from '@/types';
import { safeSetItem, safeRemoveItem } from '@/lib/storage';
import { alertNewOrder, unlockAudio, playOrderChime } from '@/lib/sound';

export default function AdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Multi-Tenant state:
  // 当直接访问 /admin 时（URL 无 tenant 参数），坚决严格锁定总后台 'default'，杜绝继承前台遗留的分店 cookie/localStorage！
  // 仅当 URL 中显式携带 ?tenant= 或 ?t= 时，才进入对应分店后台
  const [currentTenantId, setCurrentTenantId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const queryTenant = p.get('tenant') || p.get('t');
      if (queryTenant && queryTenant.trim()) {
        return queryTenant.trim().toLowerCase();
      }
      // 访问 /admin（无参）时，必须清理可能残留的分店缓存，确保纯正的总后台身份
      try {
        safeSetItem('dingcan_tenant_id', 'default');
        document.cookie = 'dingcan_tenant_id=default; path=/; max-age=2592000; SameSite=Lax';
      } catch {
        // ignore
      }
    }
    return 'default';
  });

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isTenantDropdownOpen, setIsTenantDropdownOpen] = useState(false);

  // 判定是否为集团总店(主店)超级管理员；子分店(如 gcxq)仅具备本分店运营权限，严格隔离其他分店与总店信息
  const isMasterAdmin = currentTenantId === 'default';

  // Store Brand state
  const [storeInfo, setStoreInfo] = useState<{ name: string; logo: string; slogan: string }>({
    name: '客来香·家常菜馆',
    logo: '',
    slogan: '地道现炒 · 现点现做',
  });

  // Switch and synchronize active tenant across state, URL, cookie and localStorage
  const updateActiveTenant = useCallback((newTenantId: string) => {
    const cleanId = (newTenantId || 'default').trim().toLowerCase();
    setCurrentTenantId(cleanId);
    if (typeof window !== 'undefined') {
      safeSetItem('dingcan_tenant_id', cleanId);
      document.cookie = `dingcan_tenant_id=${encodeURIComponent(cleanId)}; path=/; max-age=2592000; SameSite=Lax`;
      const url = new URL(window.location.href);
      if (cleanId && cleanId !== 'default') {
        url.searchParams.set('tenant', cleanId);
      } else {
        url.searchParams.delete('tenant');
        url.searchParams.delete('t');
      }
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, []);

  // Active Admin Tab: 'orders' | 'dishes' | 'tables' | 'members' | 'store' | 'tenants' | 'settings'
  const [activeTabState, setActiveTabState] = useState<
    'orders' | 'dishes' | 'tables' | 'members' | 'store' | 'tenants' | 'settings'
  >('orders');

  // 若处于子分店后台，严格杜绝非法进入“连锁分店”管理Tab（通过计算派生保证永不越权）
  const activeTab = (!isMasterAdmin && activeTabState === 'tenants') ? 'orders' : activeTabState;
  const setActiveTab = setActiveTabState;

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('全部');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [newOrderToast, setNewOrderToast] = useState<string>('');
  const [isAudioActivated, setIsAudioActivated] = useState(false);
  const knownOrderIdsRef = React.useRef<Set<string>>(new Set());

  // Dishes State
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);
  const [dishCategoryFilter, setDishCategoryFilter] = useState('全部');
  const [dishSearchQuery, setDishSearchQuery] = useState('');
  const [isDishModalOpen, setIsDishModalOpen] = useState(false);
  const [dishToEdit, setDishToEdit] = useState<Dish | null>(null);

  // Auto-unlock audio on any mobile/desktop user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      unlockAudio();
      setIsAudioActivated(true);
    };
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  const fetchTenants = useCallback(async (tenantId = currentTenantId) => {
    try {
      const res = await fetch(`/api/tenants?tenant=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTenants(data.data);
      }
    } catch (e) {
      console.error('加载租户列表失败:', e);
    }
  }, [currentTenantId]);

  const fetchStoreBranding = useCallback(async (tenantId = currentTenantId) => {
    try {
      const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setStoreInfo({
          name: data.data.restaurant_name || '客来香·家常菜馆',
          logo: data.data.restaurant_logo || '',
          slogan: data.data.restaurant_slogan || '地道现炒 · 现点现做',
        });
      }
    } catch (err) {
      console.error('Failed to load store branding in admin:', err);
    }
  }, [currentTenantId]);

  // Check auth session & load store branding
  useEffect(() => {
    let isCancelled = false;

    const checkAuthAndTenants = async () => {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        if (!isCancelled) {
          setIsAuthenticated(Boolean(data?.authenticated));
        }
      } catch {
        if (!isCancelled) {
          setIsAuthenticated(false);
        }
      }

      try {
        const res = await fetch(`/api/tenants?tenant=${encodeURIComponent(currentTenantId)}`);
        const data = await res.json();
        if (!isCancelled && data.success && Array.isArray(data.data)) {
          setTenants(data.data);
        }
      } catch (e) {
        console.error('加载租户列表失败:', e);
      }
    };

    checkAuthAndTenants();

    return () => {
      isCancelled = true;
    };
  }, [currentTenantId]);

  // Listen to browser navigation (back/forward) to keep active tenant in sync
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      const queryTenant = p.get('tenant') || p.get('t');
      if (queryTenant && queryTenant.trim()) {
        setCurrentTenantId(queryTenant.trim().toLowerCase());
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Reload branding when currentTenantId changes
  useEffect(() => {
    let isCancelled = false;

    const loadBranding = async () => {
      try {
        const res = await fetch(`/api/settings?tenant=${encodeURIComponent(currentTenantId)}`);
        const data = await res.json();
        if (!isCancelled && data.success && data.data) {
          setStoreInfo({
            name: data.data.restaurant_name || (currentTenantId === 'default' ? '客来香·家常菜馆' : currentTenantId),
            logo: data.data.restaurant_logo || '',
            slogan: data.data.restaurant_slogan || '地道现炒 · 现点现做',
          });
        }
      } catch (err) {
        console.error('Failed to load store branding in admin:', err);
      }
    };

    loadBranding();

    return () => {
      isCancelled = true;
    };
  }, [currentTenantId]);

  // Fetch Dishes
  const fetchDishes = useCallback(async () => {
    setLoadingDishes(true);
    try {
      const res = await fetch(`/api/dishes?all=1&tenant=${encodeURIComponent(currentTenantId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) return;

      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDishes(data.data);
      }
    } catch (err) {
      console.warn('Dishes fetch notice:', err);
    } finally {
      setLoadingDishes(false);
    }
  }, [currentTenantId]);

  // Fetch Orders & Trigger New Order Alert
  const fetchOrders = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoadingOrders(true);
      try {
        const res = await fetch(`/api/orders?tenant=${encodeURIComponent(currentTenantId)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return;

        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const fetchedOrders: Order[] = data.data;

          // Detect newly submitted orders
          if (knownOrderIdsRef.current.size > 0) {
            const brandNew = fetchedOrders.filter((o) => !knownOrderIdsRef.current.has(o.id));
            if (brandNew.length > 0) {
              const first = brandNew[0];
              const detail = first.table_no
                ? `${first.table_no}有新订餐`
                : first.delivery_contact
                  ? `外卖客户${first.delivery_contact}有新单`
                  : undefined;

              if (soundEnabled) {
                alertNewOrder(brandNew.length, detail);
              }

              const bannerText = `收到 ${brandNew.length} 笔新点餐订单！${
                first.table_no
                  ? `【${first.table_no}】`
                  : first.delivery_contact
                    ? `【外卖:${first.delivery_contact}】`
                    : ''
              } 金额: ¥${(first.final_amount ?? first.total_amount).toFixed(2)}`;
              setNewOrderToast(bannerText);
            }
          }

          // Keep known set up to date
          knownOrderIdsRef.current = new Set(fetchedOrders.map((o) => o.id));
          setOrders(fetchedOrders);
        }
      } catch (err) {
        console.warn('Orders fetch notice:', err);
      } finally {
        if (showSpinner) setLoadingOrders(false);
      }
    },
    [soundEnabled, currentTenantId]
  );

  // Fetch initial data on login
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const fetchSafe = async (url: string) => {
          try {
            const res = await fetch(url, {
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
        };

        const [dRes, oRes] = await Promise.all([
          fetchSafe(`/api/dishes?all=1&tenant=${encodeURIComponent(currentTenantId)}`),
          fetchSafe(`/api/orders?tenant=${encodeURIComponent(currentTenantId)}`),
        ]);
        if (isMounted) {
          if (dRes?.success && Array.isArray(dRes.data)) {
            setDishes(dRes.data);
          }
          if (oRes?.success && Array.isArray(oRes.data)) {
            setOrders(oRes.data);
            knownOrderIdsRef.current = new Set(oRes.data.map((o: Order) => o.id));
          }
        }
      } catch (err) {
        console.warn('Failed to load initial admin data:', err);
      }
    };

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, currentTenantId]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      fetchOrders(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefresh, fetchOrders]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudio();
    setIsAudioActivated(true);
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass, tenant: currentTenantId }),
      });

      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        safeSetItem('restaurant_admin_auth', 'true');
        updateActiveTenant(currentTenantId);
      } else {
        setLoginError(data.error || '用户名或密码错误');
      }
    } catch (err: any) {
      setLoginError('登录请求失败: ' + (err?.message || ''));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    safeRemoveItem('restaurant_admin_auth');
    setIsAuthenticated(false);
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: '待处理' | '制作中' | '已完成' | '已取消'
  ) => {
    try {
      const res = await fetch(`/api/orders/${orderId}?tenant=${encodeURIComponent(currentTenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, tenantId: currentTenantId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(true);
        if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
          setSelectedOrderDetail({
            ...selectedOrderDetail,
            status: newStatus,
          });
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Toggle Payment Status
  const handleTogglePaymentStatus = async (orderId: string, currentStatus: string) => {
    const newStatus = currentStatus === '已支付' ? '未支付' : '已支付';
    try {
      const res = await fetch(`/api/orders/${orderId}?tenant=${encodeURIComponent(currentTenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus, tenantId: currentTenantId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(true);
        if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
          setSelectedOrderDetail({
            ...selectedOrderDetail,
            payment_status: newStatus,
          });
        }
      }
    } catch (err) {
      console.error('Failed to toggle payment status:', err);
    }
  };

  // Toggle Dish Status (On/Off shelf)
  const handleToggleDishStatus = async (dish: Dish) => {
    const newStatus = dish.status === 1 ? 0 : 1;
    try {
      const res = await fetch(`/api/dishes/${dish.id}?tenant=${encodeURIComponent(currentTenantId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, tenantId: currentTenantId }),
      });
      const data = await res.json();
      if (data.success) {
        setDishes((prev) =>
          prev.map((d) => (d.id === dish.id ? { ...d, status: newStatus } : d))
        );
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Delete Dish
  const handleDeleteDish = async (dishId: number, name: string) => {
    if (!confirm(`确定要彻底删除菜品【${name}】吗？`)) return;
    try {
      const res = await fetch(`/api/dishes/${dishId}?tenant=${encodeURIComponent(currentTenantId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchDishes();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = orderStatusFilter === '全部' || o.status === orderStatusFilter;
      const matchSearch =
        !orderSearchQuery.trim() ||
        o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
        (o.table_no && o.table_no.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
        (o.delivery_contact && o.delivery_contact.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
        (o.delivery_phone && o.delivery_phone.includes(orderSearchQuery)) ||
        (o.notes && o.notes.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
        o.items?.some((i) => i.dish_name.toLowerCase().includes(orderSearchQuery.toLowerCase()));
      return matchStatus && matchSearch;
    });
  }, [orders, orderStatusFilter, orderSearchQuery]);

  // Order statistics
  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === '待处理').length;
    const cooking = orders.filter((o) => o.status === '制作中').length;
    const completed = orders.filter((o) => o.status === '已完成').length;
    const revenue = orders
      .filter((o) => o.status !== '已取消')
      .reduce((acc, o) => acc + (o.final_amount !== undefined ? o.final_amount : o.total_amount), 0);
    return { pending, cooking, completed, revenue, total: orders.length };
  }, [orders]);

  // Filtered Dishes
  const filteredDishes = useMemo(() => {
    return dishes.filter((d) => {
      const matchCat = dishCategoryFilter === '全部' || d.category === dishCategoryFilter;
      const matchSearch =
        !dishSearchQuery.trim() ||
        d.name.toLowerCase().includes(dishSearchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(dishSearchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [dishes, dishCategoryFilter, dishSearchQuery]);

  const dishCategories = useMemo(() => {
    const set = new Set<string>();
    dishes.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return ['全部', ...Array.from(set)];
  }, [dishes]);

  // 1. Loading screen during auth check
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 2. Admin Login View
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-100 via-amber-50/40 to-neutral-200 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 sm:p-8 shadow-xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white mx-auto flex items-center justify-center shadow-md mb-3 overflow-hidden relative shrink-0">
              {storeInfo.logo ? (
                <Image
                  src={storeInfo.logo}
                  alt={storeInfo.name}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Utensils className="w-7 h-7" />
              )}
            </div>
            <h1 className="text-xl font-black text-neutral-900">{storeInfo.name}</h1>
            <p className="text-xs text-neutral-500 mt-1">管理后台登录 · 验证管理员身份</p>

            {/* Tenant badge on login screen */}
            {isMasterAdmin ? (
              <div className="mt-3 inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-neutral-800 shadow-xs max-w-full">
                <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-neutral-500 shrink-0">系统登录:</span>
                <span className="font-bold text-amber-900 text-xs">总店管理后台 (主系统)</span>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs text-neutral-800 shadow-xs max-w-full">
                <Store className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] text-neutral-500 shrink-0">分店后台:</span>
                <span className="font-bold text-amber-900 text-xs">{storeInfo.name}</span>
                <span className="text-[10px] text-neutral-400">({currentTenantId})</span>
              </div>
            )}
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">用户名</label>
              <input
                id="admin-username"
                type="text"
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="请输入管理员账号"
                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">登录密码</label>
              <input
                id="admin-password"
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
            </div>

            <button
              id="btn-admin-login"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-98 disabled:opacity-70"
            >
              {isLoggingIn ? '验证中...' : '立即登录'}
            </button>
          </form>

          {/* Link to Front */}
          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <Link
              href={currentTenantId && currentTenantId !== 'default' ? `/?tenant=${encodeURIComponent(currentTenantId)}` : '/'}
              className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span>返回前台点餐页面 {currentTenantId && currentTenantId !== 'default' ? `(${storeInfo.name})` : ''}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin Dashboard
  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col text-neutral-900">
      {/* Top Admin Navigation Header */}
      <header className="bg-neutral-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black shadow-xs overflow-hidden relative shrink-0">
              {storeInfo.logo ? (
                <Image
                  src={storeInfo.logo}
                  alt={storeInfo.name}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Utensils className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold text-white">{storeInfo.name}</h1>
                {/* Branch Switcher Dropdown - 仅总店有权跨店切换与管理所有分店，子分店完全屏蔽其他店信息 */}
                {isMasterAdmin ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                      title="切换管理门店或进入多租户管理"
                    >
                      <Building2 className="w-3 h-3 text-amber-400" />
                      <span>
                        {tenants.find((t) => t.id === currentTenantId)?.name || '总店(主店)'}
                      </span>
                      <ChevronDown className="w-3 h-3 text-amber-400" />
                    </button>

                    {isTenantDropdownOpen && (
                      <div
                        className="absolute left-0 mt-1 w-56 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95"
                        onClick={() => setIsTenantDropdownOpen(false)}
                      >
                        <div className="px-3 py-1.5 border-b border-neutral-700 text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex justify-between items-center">
                          <span>选择管理门店 / 租户</span>
                          <span className="text-amber-400">共 {tenants.length || 1} 家</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1">
                          {tenants.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => {
                                updateActiveTenant(t.id);
                                setIsTenantDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-neutral-700 transition-colors ${
                                currentTenantId === t.id
                                  ? 'bg-amber-500/20 text-amber-300 font-bold'
                                  : 'text-neutral-200'
                              }`}
                            >
                              <span className="truncate">{t.name}</span>
                              {currentTenantId === t.id && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-neutral-700 pt-1 px-1">
                          <button
                            onClick={() => {
                              setActiveTab('tenants');
                              setIsTenantDropdownOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs text-amber-400 hover:bg-neutral-700 rounded-lg font-bold flex items-center space-x-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>添加/管理所有门店...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                    <Store className="w-3 h-3 text-amber-400" />
                    <span>分店后台</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-amber-400">
                {storeInfo.slogan || (isMasterAdmin ? '多租户架构 · 数据隔离 · 桌位协同 · 会员积分' : '分店独立运营 · 数据严格物理隔离')}
              </p>
            </div>
          </div>

          {/* Navigation Modules Switch */}
          <div className="hidden md:flex items-center bg-neutral-800 p-1 rounded-xl space-x-1">
            <button
              id="tab-orders"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'orders'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>订单中心</span>
              {stats.pending > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                  {stats.pending}
                </span>
              )}
            </button>

            <button
              id="tab-dishes"
              onClick={() => setActiveTab('dishes')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dishes'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>菜品库</span>
              <span className="text-[10px] text-neutral-400">({dishes.length})</span>
            </button>

            <button
              id="tab-tables"
              onClick={() => setActiveTab('tables')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'tables'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>餐桌管理</span>
            </button>

            <button
              id="tab-members"
              onClick={() => setActiveTab('members')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'members'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>会员积分</span>
            </button>

            <button
              id="tab-store"
              onClick={() => setActiveTab('store')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'store'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>店面品牌</span>
            </button>

            {/* 仅总店显示连锁分店管理菜单，子分店完全不显示 */}
            {isMasterAdmin && (
              <button
                id="tab-tenants"
                onClick={() => setActiveTab('tenants')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'tenants'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>连锁分店</span>
                {tenants.length > 0 && (
                  <span className="text-[10px] bg-amber-600/60 text-white px-1.5 py-0.2 rounded-full">
                    {tenants.length}
                  </span>
                )}
              </button>
            )}

            <button
              id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-neutral-300 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>收款配置</span>
            </button>
          </div>

          {/* User info & Links & Sound control */}
          <div className="flex items-center space-x-2">
            {/* Sound Notification Control & Test Button */}
            <button
              onClick={() => {
                unlockAudio();
                setIsAudioActivated(true);
                if (!soundEnabled) {
                  setSoundEnabled(true);
                  alertNewOrder(1, '声音提醒已开启');
                } else {
                  alertNewOrder(1, '测试语音播报正常');
                }
              }}
              className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/70'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
              title={soundEnabled ? '提示音已开启，点击测试播报效果' : '点击开启新订单提示音与语音'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
              )}
              <span className="hidden sm:inline font-bold">
                {soundEnabled ? '提示音开启 (点此测试)' : '提示音已关闭'}
              </span>
              <span className="sm:hidden text-[11px] font-bold">
                {soundEnabled ? '声音开' : '静音'}
              </span>
            </button>

            <Link
              href={currentTenantId && currentTenantId !== 'default' ? `/?tenant=${encodeURIComponent(currentTenantId)}` : '/'}
              target="_blank"
              className="hidden sm:flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>前台点餐</span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-rose-900/60 text-neutral-200 hover:text-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden overflow-x-auto px-2 py-2 bg-neutral-800/90 border-t border-neutral-700 space-x-1">
          {[
            { id: 'orders', label: '订单中心', icon: ClipboardList },
            { id: 'dishes', label: '菜品库', icon: Utensils },
            { id: 'tables', label: '餐桌管理', icon: MapPin },
            { id: 'members', label: '会员积分', icon: Users },
            { id: 'store', label: '店面品牌', icon: Store },
            ...(isMasterAdmin ? [{ id: 'tenants', label: '连锁门店', icon: Building2 }] : []),
            { id: 'settings', label: '收款配置', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isSel = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                  isSel ? 'bg-amber-500 text-white' : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Mobile Audio Activation Banner */}
      {!isAudioActivated && (
        <div
          onClick={() => {
            unlockAudio();
            setIsAudioActivated(true);
            playOrderChime();
          }}
          className="bg-amber-500/20 border-b border-amber-500/40 text-amber-200 px-4 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-amber-500/30 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span>📱 手机语音提示：点此激活新订单语音/提示音播报</span>
          </div>
          <span className="text-[11px] bg-amber-500 text-neutral-900 font-bold px-2.5 py-0.5 rounded-md">
            立即激活
          </span>
        </div>
      )}

      {/* New Order Realtime Toast Banner */}
      {newOrderToast && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs font-bold animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2">
            <BellRing className="w-4 h-4 animate-bounce shrink-0" />
            <span>{newOrderToast}</span>
          </div>
          <button
            onClick={() => setNewOrderToast('')}
            className="bg-white/25 hover:bg-white/35 px-2.5 py-1 rounded text-[11px] cursor-pointer"
          >
            关闭提示
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-5">
        {activeTab === 'orders' ? (
          /* ================= ORDER MANAGEMENT MODULE ================= */
          <div className="space-y-4">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs">
                <span className="text-[11px] text-neutral-500 font-medium">今日订单总量</span>
                <div className="text-xl font-black text-neutral-900 mt-1">{stats.total} 笔</div>
              </div>

              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[11px] text-amber-800 font-bold flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>待处理 (需接单)</span>
                </span>
                <div className="text-xl font-black text-amber-600 mt-1">{stats.pending} 笔</div>
              </div>

              <div className="bg-blue-50/80 p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs">
                <span className="text-[11px] text-blue-800 font-bold flex items-center space-x-1">
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>制作中 (后厨烹饪)</span>
                </span>
                <div className="text-xl font-black text-blue-600 mt-1">{stats.cooking} 笔</div>
              </div>

              <div className="bg-emerald-50/80 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[11px] text-emerald-800 font-bold">实付流水营收</span>
                <div className="text-xl font-black text-emerald-600 mt-1">
                  <span className="text-xs">¥</span>
                  {stats.revenue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Controls Bar: Filters, Auto-refresh, Sound, Search */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
              {/* Status Tabs */}
              <div className="flex flex-wrap gap-1.5">
                {['全部', '待处理', '制作中', '已完成', '已取消'].map((status) => {
                  const isSelected = orderStatusFilter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setOrderStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>

              {/* Right tools: Search, Sound chime, Auto refresh, manual refresh */}
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="搜索桌号 / 姓名 / 电话 / 单号"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Sound Toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? '新订单提示音：开' : '新订单提示音：关'}
                  className={`p-2 rounded-xl text-xs border transition-colors ${
                    soundEnabled
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Auto Refresh Toggle */}
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center space-x-1 ${
                    autoRefresh
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-neutral-400'
                    }`}
                  ></span>
                  <span>{autoRefresh ? '自动刷新' : '手动'}</span>
                </button>

                {/* Manual Refresh button */}
                <button
                  onClick={() => fetchOrders(false)}
                  disabled={loadingOrders}
                  className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin text-amber-600' : ''}`} />
                </button>
              </div>
            </div>

            {/* Orders List / Cards */}
            {loadingOrders && orders.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                正在读取订单数据...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
                暂无符合筛选条件的订单
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredOrders.map((order) => {
                  const isPending = order.status === '待处理';
                  const isCooking = order.status === '制作中';
                  const isDone = order.status === '已完成';
                  const isCancelled = order.status === '已取消';
                  const isPaid = order.payment_status === '已支付';
                  const isDelivery = order.order_type === '外卖';

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border transition-all shadow-2xs flex flex-col justify-between overflow-hidden ${
                        isPending
                          ? 'border-amber-400 ring-2 ring-amber-100'
                          : 'border-neutral-200/80 hover:shadow-xs'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="p-3.5 border-b border-neutral-100 flex items-start justify-between bg-neutral-50/50">
                        <div>
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-sm font-black text-neutral-900 bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-md flex items-center space-x-1">
                              {isDelivery ? (
                                <>
                                  <Truck className="w-3.5 h-3.5 text-amber-700" />
                                  <span>送餐外卖</span>
                                </>
                              ) : (
                                <>
                                  <MapPin className="w-3.5 h-3.5 text-amber-700" />
                                  <span>{order.table_no}</span>
                                </>
                              )}
                            </span>

                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isPending
                                  ? 'bg-amber-500 text-white'
                                  : isCooking
                                  ? 'bg-blue-500 text-white'
                                  : isDone
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-neutral-300 text-neutral-700'
                              }`}
                            >
                              {order.status}
                            </span>

                            {/* Payment status badge with toggle */}
                            <button
                              onClick={() => handleTogglePaymentStatus(order.id, order.payment_status)}
                              title="点击可直接切换收款状态"
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-transform active:scale-95 ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                              }`}
                            >
                              {isPaid ? '✓ 已收款' : '✕ 未收款'}
                            </button>
                          </div>

                          <div className="text-[10px] text-neutral-400 font-mono mt-1">
                            {order.id}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-neutral-500 flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(order.created_at).toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-sm font-black text-rose-600 mt-0.5">
                            ¥{(order.final_amount !== undefined ? order.final_amount : order.total_amount).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Address if external */}
                      {isDelivery && (
                        <div className="px-3.5 py-2 bg-amber-50/50 border-b border-neutral-100 text-[11px] text-neutral-700 space-y-0.5">
                          <div className="font-bold flex items-center space-x-1">
                            <span>送达：{order.delivery_address || '-'}</span>
                          </div>
                          <div className="text-neutral-500">
                            联系人：{order.delivery_contact} ({order.delivery_phone})
                          </div>
                        </div>
                      )}

                      {/* Items List */}
                      <div className="p-3.5 flex-1 space-y-1.5 text-xs">
                        <div className="font-semibold text-[11px] text-neutral-400 uppercase tracking-wider mb-1 flex justify-between">
                          <span>点餐明细 ({order.items?.reduce((acc, i) => acc + i.quantity, 0) || 0} 件)</span>
                          {(order.points_discount || 0) > 0 && (
                            <span className="text-amber-700 font-bold">
                              积分抵扣: -¥{order.points_discount?.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-0.5">
                              <div className="flex items-center flex-wrap gap-1">
                                <span className="text-neutral-800 font-medium">
                                  {item.dish_name}
                                </span>
                                {item.taste && (
                                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[10px] font-semibold border border-amber-300">
                                    {item.taste}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-2 text-neutral-500">
                                <span className="font-bold text-amber-600">x{item.quantity}</span>
                                <span className="w-12 text-right">¥{item.subtotal.toFixed(1)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Customer Notes */}
                        {order.notes && (
                          <div className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start space-x-1.5">
                            <span className="font-bold shrink-0">备注：</span>
                            <span>{order.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions Footer */}
                      <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedOrderDetail(order)}
                          className="px-2.5 py-1.5 rounded-lg text-xs text-neutral-600 hover:bg-neutral-200 transition-colors flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>明细</span>
                        </button>

                        <div className="flex items-center space-x-1.5">
                          {isPending && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, '制作中')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1"
                            >
                              <ChefHat className="w-3.5 h-3.5" />
                              <span>接单制作</span>
                            </button>
                          )}

                          {isCooking && (
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, '已完成')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center space-x-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>出餐完成</span>
                            </button>
                          )}

                          {!isDone && !isCancelled && (
                            <button
                              onClick={() => {
                                if (confirm(`确认取消此订单【${order.id}】吗？`)) {
                                  handleUpdateOrderStatus(order.id, '已取消');
                                }
                              }}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="取消订单"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'dishes' ? (
          /* ================= DISH MANAGEMENT MODULE ================= */
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="bg-white p-3.5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
              {/* Categories */}
              <div className="flex flex-wrap gap-1.5">
                {dishCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDishCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      dishCategoryFilter === cat
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Right Tools: Search & Add */}
              <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={dishSearchQuery}
                    onChange={(e) => setDishSearchQuery(e.target.value)}
                    placeholder="搜索菜品名称或描述"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  id="btn-add-dish"
                  onClick={() => {
                    setDishToEdit(null);
                    setIsDishModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-transform active:scale-95 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加新菜品</span>
                </button>
              </div>
            </div>

            {/* Dishes Table / Cards */}
            {loadingDishes ? (
              <div className="py-16 text-center text-xs text-neutral-400">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                正在加载菜品库...
              </div>
            ) : filteredDishes.length === 0 ? (
              <div className="py-16 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
                暂无符合条件的菜品，点击上方按钮新增
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                        <th className="py-3 px-4">菜品图片</th>
                        <th className="py-3 px-4">菜名 / 分类</th>
                        <th className="py-3 px-4">单价</th>
                        <th className="py-3 px-4 hidden md:table-cell">特色描述</th>
                        <th className="py-3 px-4">上下架状态</th>
                        <th className="py-3 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredDishes.map((dish) => {
                        const isOnShelf = dish.status === 1;
                        return (
                          <tr key={dish.id} className="hover:bg-neutral-50/70 transition-colors">
                            {/* Image */}
                            <td className="py-3 px-4">
                              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
                                <Image
                                  src={dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                                  alt={dish.name}
                                  fill
                                  className={`object-cover ${!isOnShelf ? 'grayscale opacity-60' : ''}`}
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            </td>

                            {/* Name & Category */}
                            <td className="py-3 px-4">
                              <div className="font-bold text-neutral-900 text-sm">{dish.name}</div>
                              <div className="flex items-center flex-wrap gap-1 mt-1">
                                <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 text-[10px] font-medium">
                                  {dish.category}
                                </span>
                                {dish.taste_options ? (
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] border border-amber-200">
                                    口味: {dish.taste_options}
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-md bg-neutral-50 text-neutral-400 text-[10px]">
                                    未配置口味
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Price */}
                            <td className="py-3 px-4">
                              <span className="text-sm font-black text-rose-600">
                                ¥{dish.price.toFixed(2)}
                              </span>
                            </td>

                            {/* Description */}
                            <td className="py-3 px-4 hidden md:table-cell text-neutral-500 max-w-xs truncate">
                              {dish.description || '-'}
                            </td>

                            {/* Shelf Status Switch */}
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleToggleDishStatus(dish)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                  isOnShelf
                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isOnShelf ? 'bg-emerald-500' : 'bg-neutral-400'
                                  }`}
                                ></span>
                                <span>{isOnShelf ? '上架中(在售)' : '已下架(停售)'}</span>
                              </button>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right space-x-1">
                              <button
                                onClick={() => {
                                  setDishToEdit(dish);
                                  setIsDishModalOpen(true);
                                }}
                                className="p-1.5 text-neutral-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors inline-block"
                                title="编辑菜品"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteDish(dish.id, dish.name)}
                                className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                                title="删除菜品"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'tables' ? (
          /* ================= TABLE MANAGEMENT MODULE ================= */
          <TableManagement tenantId={currentTenantId} />
        ) : activeTab === 'members' ? (
          /* ================= MEMBER MANAGEMENT MODULE ================= */
          <MemberManagement tenantId={currentTenantId} />
        ) : activeTab === 'store' ? (
          /* ================= STORE BRAND MODULE ================= */
          <StoreManagement
            tenantId={currentTenantId}
            onStoreUpdated={(newSettings) => {
              setStoreInfo({
                name: newSettings.restaurant_name || '客来香·家常菜馆',
                logo: newSettings.restaurant_logo || '',
                slogan: newSettings.restaurant_slogan || '地道现炒 · 现点现做',
              });
            }}
          />
        ) : activeTab === 'tenants' && isMasterAdmin ? (
          /* ================= TENANT MANAGEMENT MODULE (仅总店) ================= */
          <TenantManagement
            currentTenantId={currentTenantId}
            onSelectTenant={(tenantId) => {
              updateActiveTenant(tenantId);
            }}
            onTenantsUpdated={() => {
              fetchTenants();
              fetchStoreBranding(currentTenantId);
            }}
          />
        ) : activeTab === 'tenants' && !isMasterAdmin ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200 shadow-xs max-w-md mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-neutral-900 mb-2">连锁管理仅限总店后台</h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              您当前登录的是【{storeInfo.name}】独立分店后台。连锁分店多租户跨店管理属于总店超级管理权限，分店无法查看或修改其他门店数据。
            </p>
            <button
              onClick={() => setActiveTab('orders')}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              返回订单中心
            </button>
          </div>
        ) : (
          /* ================= SETTINGS MODULE ================= */
          <SettingsManagement tenantId={currentTenantId} />
        )}
      </main>

      {/* Dish Add/Edit Modal */}
      <DishFormModal
        isOpen={isDishModalOpen}
        onClose={() => setIsDishModalOpen(false)}
        dishToEdit={dishToEdit}
        onSuccess={() => fetchDishes()}
        tenantId={currentTenantId}
      />

      {/* Order Detail Modal */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  订单详情 · {selectedOrderDetail.order_type === '外卖' ? '送餐外卖' : selectedOrderDetail.table_no}
                </h3>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {selectedOrderDetail.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <span className="text-[11px] text-amber-800 font-medium block">厨房出单状态</span>
                  <span className="font-bold text-amber-900 text-sm mt-0.5 inline-block">
                    {selectedOrderDetail.status}
                  </span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="text-[11px] text-emerald-800 font-medium block">收款状态</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-emerald-900 text-sm">
                      {selectedOrderDetail.payment_status}
                    </span>
                    <button
                      onClick={() =>
                        handleTogglePaymentStatus(
                          selectedOrderDetail.id,
                          selectedOrderDetail.payment_status
                        )
                      }
                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors"
                    >
                      切换
                    </button>
                  </div>
                </div>
              </div>

              {selectedOrderDetail.order_type === '外卖' && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
                  <div className="font-bold text-neutral-700">外卖配送信息：</div>
                  <div>地址：{selectedOrderDetail.delivery_address || '-'}</div>
                  <div>
                    联系人：{selectedOrderDetail.delivery_contact} ({selectedOrderDetail.delivery_phone})
                  </div>
                </div>
              )}

              {selectedOrderDetail.notes && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <span className="font-bold text-neutral-700 block mb-1">顾客特殊要求备注：</span>
                  <span className="text-neutral-900">{selectedOrderDetail.notes}</span>
                </div>
              )}

              <div>
                <span className="font-bold text-neutral-600 block mb-2">菜品明细：</span>
                <div className="bg-neutral-50 rounded-xl p-3 divide-y divide-neutral-200/60">
                  {selectedOrderDetail.items?.map((item, idx) => (
                    <div key={idx} className="py-1.5 flex justify-between items-center">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-medium text-neutral-800">
                          {item.dish_name}
                        </span>
                        <span className="text-amber-600 font-bold">x{item.quantity}</span>
                        {item.taste && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[10px] font-medium border border-amber-300">
                            {item.taste}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-neutral-900">¥{item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}

                  <div className="pt-2 mt-1 space-y-1 text-xs">
                    <div className="flex justify-between text-neutral-600">
                      <span>菜品总额</span>
                      <span>¥{selectedOrderDetail.total_amount.toFixed(2)}</span>
                    </div>
                    {(selectedOrderDetail.points_discount || 0) > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>积分抵扣现金 ({selectedOrderDetail.points_used}分)</span>
                        <span>-¥{selectedOrderDetail.points_discount?.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm text-neutral-900 pt-1 border-t border-neutral-200">
                      <span>实收金额</span>
                      <span className="text-rose-600 text-base">
                        ¥{(selectedOrderDetail.final_amount !== undefined
                          ? selectedOrderDetail.final_amount
                          : selectedOrderDetail.total_amount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="px-4 py-2 rounded-xl text-xs bg-neutral-200 text-neutral-700 hover:bg-neutral-300 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
