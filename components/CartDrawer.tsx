'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Send,
  AlertCircle,
  MapPin,
  Truck,
  Utensils,
  CreditCard,
  Clock,
  Award,
  Sparkles,
  ChevronDown,
  User,
  Phone,
  Home,
} from 'lucide-react';
import { CartItem, Dish, DiningTable, AppUser, AppSettings } from '@/types';

export interface CheckoutOrderData {
  tableNo: string;
  orderType: '堂食' | '外卖';
  deliveryAddress?: string;
  deliveryContact?: string;
  deliveryPhone?: string;
  paymentTiming: '餐前付款' | '餐后结账';
  paymentStatus: '未支付' | '已支付';
  pointsUsed: number;
  pointsDiscount: number;
  finalAmount: number;
  notes: string;
  itemTastes?: Record<number, string>;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalPrice: number;
  totalQuantity: number;
  onAdd: (dish: Dish) => void;
  onRemove: (dish: Dish) => void;
  onClear: () => void;
  currentTable: string;
  isTableLocked?: boolean;
  onChangeTable: (table: string) => void;
  freeTables: DiningTable[];
  totalTablesCount?: number;
  user: AppUser | null;
  onOpenMemberModal: () => void;
  settings: AppSettings | null;
  onSubmitOrder: (data: CheckoutOrderData) => Promise<void>;
  isSubmitting: boolean;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  totalPrice,
  totalQuantity,
  onAdd,
  onRemove,
  onClear,
  currentTable,
  isTableLocked = false,
  onChangeTable,
  freeTables,
  totalTablesCount,
  user,
  onOpenMemberModal,
  settings,
  onSubmitOrder,
  isSubmitting,
}: CartDrawerProps) {
  // 1. 就餐方式开关解析：后台未明确设为0即为启用
  const enableDineIn = settings?.enable_dine_in !== 0;
  const enableTakeout = settings?.enable_takeout !== 0;
  // 仅当两者均激活时，前端才显示消费就餐方式选择切换
  const showDiningModeSwitch = enableDineIn && enableTakeout;

  // 默认就餐方式推导：仅外卖激活时默认外卖，其他（仅堂食/两者激活/两者都不选）均默认堂食
  const defaultOrderType: '堂食' | '外卖' =
    !enableDineIn && enableTakeout ? '外卖' : '堂食';

  // 用户主动切换的就餐方式（仅在双模式激活时允许切换）
  const [userSelectedOrderType, setUserSelectedOrderType] = useState<'堂食' | '外卖' | null>(null);
  const orderType: '堂食' | '外卖' = showDiningModeSwitch
    ? (userSelectedOrderType || defaultOrderType)
    : defaultOrderType;

  // 桌号规则解析
  const requireTableNo = settings?.require_table_no !== 0;
  const tableInputMode = settings?.table_input_mode || 'select';

  // 2. 餐桌总数与堂食桌号区块显示判断：
  // 核心规则（极致精简设计）：
  // - 若顾客通过二维码扫码锁定桌号（isTableLocked），则展示已锁定桌号提示；
  // - 仅当后台明确开启“堂食下单必须选择或指定就餐桌号”（requireTableNo === true）且后台配置了餐桌（hasConfiguredTables === true）时，才展示桌号选择区块；
  // - 若后台未勾选必须指定桌号（即桌号非必填），或者店内餐桌数量为0，前端购物车结算界面彻底去掉“就餐桌号 / 区域”区块！
  const hasConfiguredTables = (totalTablesCount !== undefined ? totalTablesCount : freeTables.length) > 0;
  const showTableSection = orderType === '堂食' && (isTableLocked || (requireTableNo && hasConfiguredTables));

  // Dine-in Table
  const [userCustomTable, setUserCustomTable] = useState<string | null>(null);
  const selectedTable = userCustomTable !== null ? userCustomTable : (currentTable || '');
  const setSelectedTable = (table: string) => setUserCustomTable(table);

  const [manualTableInput, setManualTableInput] = useState(false);

  // Delivery Fields
  const [deliveryAddress, setDeliveryAddress] = useState(user?.delivery_address || '');
  const [deliveryContact, setDeliveryContact] = useState(user?.delivery_contact || user?.name || '');
  const [deliveryPhone, setDeliveryPhone] = useState(user?.delivery_phone || user?.phone || '');

  // 3. 支付付款时机配置解析：
  const enablePayBefore = settings?.enable_pay_before !== 0;
  const enablePayAfter = settings?.enable_pay_after !== 0;
  // 仅当堂食 且 后台同时勾选了餐前付款与餐后结账时，前端才展示选择切换区块
  const showPaymentTimingSwitch = orderType === '堂食' && enablePayBefore && enablePayAfter;

  // 默认付款时机推导：仅开启餐后结账时默认为餐后结账，其他（仅餐前/两者开启/两者皆未选）默认餐前付款
  const defaultPaymentTiming: '餐前付款' | '餐后结账' =
    !enablePayBefore && enablePayAfter ? '餐后结账' : '餐前付款';

  // 用户主动选择的付款时机
  const [userSelectedPaymentTiming, setUserSelectedPaymentTiming] = useState<'餐前付款' | '餐后结账' | null>(null);

  // 实际生效的付款时机（外卖强制餐前付款；堂食根据开关推导或用户选择）
  const effectivePaymentTiming: '餐前付款' | '餐后结账' =
    orderType === '外卖'
      ? '餐前付款'
      : showPaymentTimingSwitch
      ? (userSelectedPaymentTiming || defaultPaymentTiming)
      : defaultPaymentTiming;

  // Points usage
  const [usePoints, setUsePoints] = useState(false);

  // Per-dish taste selections: { [dishId: number]: string[] }
  const [itemTastes, setItemTastes] = useState<Record<number, string[]>>({});
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showAdditionalNotes, setShowAdditionalNotes] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Calculate points discount
  const availablePoints = user?.points || 0;
  // Maximum points usable cannot exceed total bill
  const maxPointsDeductible = Math.min(availablePoints, totalPrice);
  const pointsDiscount = usePoints ? maxPointsDeductible : 0;
  const finalAmount = Math.max(0, Math.round((totalPrice - pointsDiscount) * 100) / 100);

  const toggleItemTaste = (dishId: number, taste: string) => {
    setItemTastes((prev) => {
      const current = prev[dishId] || [];
      const updated = current.includes(taste)
        ? current.filter((t) => t !== taste)
        : [...current, taste];
      return { ...prev, [dishId]: updated };
    });
  };

  const handleTogglePoints = () => {
    if (!usePoints) {
      // User is turning points ON. Check if verified:
      if (!user?.is_verified) {
        onOpenMemberModal();
        return;
      }
      if (availablePoints <= 0) {
        setErrorMsg('您当前暂无可抵扣的积分');
        return;
      }
      setUsePoints(true);
    } else {
      setUsePoints(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (cartItems.length === 0) {
      setErrorMsg('购物车内暂无菜品');
      return;
    }

    if (orderType === '堂食') {
      const table = selectedTable.trim();
      // 仅当展示了桌号区块且要求必须选桌时才强制校验桌号；未开启或无桌号时无需校验
      if (showTableSection && requireTableNo && !table) {
        setErrorMsg('请选择或输入就餐桌号');
        return;
      }
      onChangeTable(
        showTableSection
          ? (table || '')
          : (isTableLocked ? (currentTable || '') : '')
      );
    } else {
      if (!deliveryAddress.trim()) {
        setErrorMsg('请填写外卖送达具体地址');
        return;
      }
      if (!deliveryContact.trim()) {
        setErrorMsg('请填写收餐人姓名或称呼');
        return;
      }
      if (!deliveryPhone.trim() || !/^1[3-9]\d{9}$/.test(deliveryPhone.trim())) {
        setErrorMsg('请填写有效的11位收餐人联系电话');
        return;
      }
    }

    try {
      const finalTableNo =
        orderType === '堂食'
          ? (showTableSection
              ? (selectedTable.trim() || '')
              : (isTableLocked ? (currentTable || '') : ''))
          : '外卖送餐';

      // 汇总各餐品所选口味属性
      const itemTasteSummaries: string[] = [];
      const itemTastesPayload: Record<number, string> = {};

      for (const item of cartItems) {
        const tastes = itemTastes[item.dish.id] || [];
        if (tastes.length > 0) {
          const tastesStr = tastes.join('、');
          itemTastesPayload[item.dish.id] = tastesStr;
          itemTasteSummaries.push(`${item.dish.name}（${tastesStr}）`);
        }
      }

      const tasteNotes = itemTasteSummaries.join('；');
      const finalNotes = [tasteNotes, additionalNotes.trim()].filter(Boolean).join(' | ');

      await onSubmitOrder({
        tableNo: finalTableNo,
        orderType,
        deliveryAddress: deliveryAddress.trim(),
        deliveryContact: deliveryContact.trim(),
        deliveryPhone: deliveryPhone.trim(),
        paymentTiming: effectivePaymentTiming,
        paymentStatus: '未支付', // Will be confirmed in PaymentModal if 餐前付款
        pointsUsed: usePoints ? pointsDiscount : 0,
        pointsDiscount,
        finalAmount,
        notes: finalNotes,
        itemTastes: itemTastesPayload,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || '下单失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-neutral-900 text-base">购物车与结算</h3>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              共 {totalQuantity} 件
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {cartItems.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs text-neutral-400 hover:text-rose-500 flex items-center space-x-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. 消费就餐方式：仅当后台同时激活堂食与外卖时才显示切换按钮；只开启一种或都未勾选时彻底不显示该区块 */}
          {showDiningModeSwitch && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                消费就餐方式
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserSelectedOrderType('堂食')}
                  className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    orderType === '堂食'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>到店堂食</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserSelectedOrderType('外卖')}
                  className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    orderType === '外卖'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>送餐到家 (外卖)</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. 就餐桌号 / 送餐信息：
              - 当为堂食时：仅在后台有设置餐桌（餐桌数量>0）或已扫码绑定桌位时才显示桌号区块；若后台餐桌数量为0且未扫码，彻底不显示该区块！
              - 当为外卖时：展示收餐地址和联系电话 */}
          {orderType === '堂食' ? (
            showTableSection ? (
              <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>就餐桌号 / 区域</span>
                  {requireTableNo ? (
                    <span className="text-rose-500 font-bold">*</span>
                  ) : (
                    <span className="text-[11px] text-neutral-400 font-normal">(非必填)</span>
                  )}
                </label>

                <div className="flex items-center space-x-2">
                  {!isTableLocked && tableInputMode === 'both' && (
                    <button
                      type="button"
                      onClick={() => setManualTableInput(!manualTableInput)}
                      className="text-[11px] text-amber-700 underline font-medium hover:text-amber-800 cursor-pointer"
                    >
                      {manualTableInput ? '切换下拉选桌' : '手动输入桌号'}
                    </button>
                  )}

                  {isTableLocked ? (
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                      ★ 扫码绑定桌号
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                      {requireTableNo ? '堂食需选桌' : '自取/自由入座'}
                    </span>
                  )}
                </div>
              </div>

              {isTableLocked ? (
                <div className="px-3 py-2 bg-white rounded-xl border border-amber-300 text-xs font-bold text-amber-900 flex items-center justify-between">
                  <span>当前入座：{selectedTable}</span>
                  <span className="text-[11px] text-amber-600 font-normal">二维码直连</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {tableInputMode === 'input' || (tableInputMode === 'both' && manualTableInput) ? (
                    <div>
                      <input
                        type="text"
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        placeholder={
                          requireTableNo
                            ? '请输入就餐桌号 (如: A08、8号桌、散台3)'
                            : '请输入就餐桌号 (可留空，系统将按自取/自由就座处理)'
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium text-neutral-800"
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedTable}
                        onChange={(e) => setSelectedTable(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium text-neutral-800 appearance-none pr-8"
                      >
                        <option value="">
                          {requireTableNo ? '-- 请选择空闲桌位 --' : '-- 暂不指定 (自取/自由入座) --'}
                        </option>
                        {freeTables.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name} (空闲可用)
                          </option>
                        ))}
                        {selectedTable && !freeTables.some((t) => t.name === selectedTable) && (
                          <option value={selectedTable}>{selectedTable} (当前已选)</option>
                        )}
                      </select>
                      <ChevronDown className="w-4 h-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  )}

                  {freeTables.length === 0 && tableInputMode === 'select' && (
                    <p className="text-[11px] text-amber-700">
                      提示：暂无可供选择的空闲餐桌，若服务员已为您排位，可在下方订单备注说明。
                    </p>
                  )}
                </div>
              )}
            </div>
            ) : null
          ) : (
            /* Delivery Address & Contact Details */
            <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>送餐联系信息</span>
                </label>
                {user?.delivery_address && (
                  <span className="text-[10px] text-neutral-500 bg-neutral-200/60 px-2 py-0.5 rounded-full">
                    已读取历史地址
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-neutral-600 mb-1">
                  送达地址（包含楼栋门牌号）
                </label>
                <div className="relative">
                  <Home className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="例如：幸福小区3号楼2单元501室"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">联系人</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={deliveryContact}
                      onChange={(e) => setDeliveryContact(e.target.value)}
                      placeholder="称呼/姓名"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1">手机号码</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      maxLength={11}
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      placeholder="11位手机号"
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. 支付付款时机配置：
              - 仅在堂食 且 后台同时勾选了【餐前付款】与【餐后结账】时才展示选择切换按钮供顾客选择；
              - 若后台仅激活其中一种或一种都未勾选，前端彻底不显示该区块，界面保持最简！ */}
          {showPaymentTimingSwitch && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                支付付款时机
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserSelectedPaymentTiming('餐前付款')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    effectivePaymentTiming === '餐前付款'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>餐前付款 (立付)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserSelectedPaymentTiming('餐后结账')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    effectivePaymentTiming === '餐后结账'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>餐后结账 (先吃后付)</span>
                </button>
              </div>
            </div>
          )}

          {/* Points & Membership Cash Discount */}
          <div className="p-3.5 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-neutral-900">会员积分抵现 (1积分=1元)</span>
              </div>
              <button
                type="button"
                onClick={onOpenMemberModal}
                className="text-[11px] text-amber-700 hover:text-amber-800 underline font-medium"
              >
                {user?.is_verified ? '查看会员资产' : '实名认证绑定'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-neutral-600">
                当前可用：
                <strong className="text-amber-700 font-bold">{availablePoints}</strong> 积分
                {availablePoints > 0 && (
                  <span className="text-[11px] text-neutral-500 ml-1">
                    (最高可抵 ¥{maxPointsDeductible.toFixed(2)})
                  </span>
                )}
              </div>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={handleTogglePoints}
                  className="w-4 h-4 text-amber-600 rounded border-neutral-300 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-neutral-800">
                  使用积分抵扣
                </span>
              </label>
            </div>

            {usePoints && pointsDiscount > 0 && (
              <div className="p-2 bg-white/80 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>本次抵扣 {pointsDiscount} 积分</span>
                </span>
                <span className="font-bold text-rose-600">-¥{pointsDiscount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Selected Items List */}
          <div>
            <h4 className="text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">
              已选菜品清单 ({totalQuantity} 件)
            </h4>
            <div className="divide-y divide-neutral-100 max-h-56 overflow-y-auto pr-1">
              {cartItems.map(({ dish, quantity }) => {
                const tasteOptions = (dish.taste_options || '')
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                const selectedTastesForDish = itemTastes[dish.id] || [];

                return (
                  <div key={dish.id} className="py-2.5 space-y-1.5">
                    {/* Dish header & quantity */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-neutral-100 border border-neutral-100">
                        <Image
                          src={dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
                          alt={dish.name}
                          fill
                          className="object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {dish.name}
                        </div>
                        <div className="text-[11px] text-rose-600 font-semibold">
                          ¥{dish.price}
                        </div>
                      </div>
                      {/* Quantity controls */}
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onRemove(dish)}
                          className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center hover:bg-neutral-200 active:scale-90 transition-transform"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-neutral-900 w-4 text-center">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdd(dish)}
                          className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 active:scale-90 transition-transform"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Per-Dish Taste Customization: ONLY shown if dish has taste_options configured */}
                    {tasteOptions.length > 0 && (
                      <div className="pl-14 pr-1 pt-0.5">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-neutral-500 font-medium">口味偏好（可选）：</span>
                          {selectedTastesForDish.length > 0 && (
                            <span className="text-amber-600 font-medium truncate max-w-[170px]">
                              已选: {selectedTastesForDish.join('、')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tasteOptions.map((opt) => {
                            const isChecked = selectedTastesForDish.includes(opt);
                            return (
                              <button
                                type="button"
                                key={opt}
                                onClick={() => toggleItemTaste(dish.id, opt)}
                                className={`px-2 py-0.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                                    : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100'
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional: Foldable additional notes */}
          <div className="pt-1">
            {!showAdditionalNotes ? (
              <button
                type="button"
                onClick={() => setShowAdditionalNotes(true)}
                className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors flex items-center space-x-1"
              >
                <span>+ 补充整单其他特殊要求（选填）</span>
              </button>
            ) : (
              <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-150 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-neutral-600">整单其他特殊要求（选填）</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdditionalNotes(false);
                      setAdditionalNotes('');
                    }}
                    className="text-[11px] text-neutral-400 hover:text-neutral-600"
                  >
                    收起
                  </button>
                </div>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="如：带两副餐具、放门口等（如无特殊需要可不填）"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}
          </div>
        </form>

        {/* Footer Checkout Bar */}
        <div className="p-4 bg-white border-t border-neutral-100 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-neutral-500">
              {pointsDiscount > 0 ? '原价 ¥' + totalPrice.toFixed(2) + ' · 折后实付' : '应付实付'}
            </div>
            <div className="text-xl font-black text-rose-600 leading-none">
              <span className="text-sm font-normal">¥</span>
              {finalAmount.toFixed(2)}
            </div>
          </div>

          <button
            id="btn-submit-order"
            type="button"
            onClick={handleSubmit}
            disabled={cartItems.length === 0 || isSubmitting}
            className={`px-7 py-3 rounded-2xl text-sm font-bold text-white shadow-md flex items-center space-x-2 transition-all ${
              cartItems.length === 0 || isSubmitting
                ? 'bg-neutral-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-98'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-1.5">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>提交中...</span>
              </span>
            ) : (
              <>
                <span>
                  {effectivePaymentTiming === '餐前付款'
                    ? '去支付并下单'
                    : '确认下单 (餐后付)'}
                </span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
