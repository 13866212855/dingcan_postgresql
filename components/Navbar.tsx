'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Utensils, ReceiptText, MapPin, Award, UserCheck } from 'lucide-react';
import { AppUser } from '@/types';

interface NavbarProps {
  currentTable: string;
  isTableLocked?: boolean;
  hasTables?: boolean;
  onChangeTable: () => void;
  onOpenOrders: () => void;
  onOpenMemberModal?: () => void;
  user?: AppUser | null;
  orderCount?: number;
  restaurantName?: string;
  restaurantLogo?: string;
  restaurantSlogan?: string;
  tenantId?: string;
}

export default function Navbar({
  currentTable,
  isTableLocked = false,
  hasTables = true,
  onChangeTable,
  onOpenOrders,
  onOpenMemberModal,
  user,
  orderCount = 0,
  restaurantName = '客来香·家常菜馆',
  restaurantLogo = '',
  restaurantSlogan = '地道现炒 · 现点现做',
  tenantId = 'default',
}: NavbarProps) {
  const adminHref =
    tenantId && tenantId !== 'default'
      ? `/admin?tenant=${encodeURIComponent(tenantId)}`
      : '/admin';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Restaurant Name & Brand: 点击直接进入后台管理登录入口 (/admin) */}
        <Link
          href={adminHref}
          id="nav-brand-admin-entry"
          title="点击打开餐厅管理后台登录页面"
          className="flex items-center space-x-2.5 p-1 -ml-1 rounded-xl hover:bg-neutral-100/80 active:scale-98 transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs overflow-hidden relative shrink-0 group-hover:shadow-md transition-shadow">
            {restaurantLogo ? (
              <Image
                src={restaurantLogo}
                alt={restaurantName || '店面图标'}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Utensils className="w-5 h-5 group-hover:scale-110 transition-transform" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h1 className="text-base font-bold text-neutral-900 leading-tight group-hover:text-amber-600 transition-colors">
                {restaurantName || '客来香·家常菜馆'}
              </h1>
              <span className="hidden sm:inline-block text-[10px] text-amber-700 bg-amber-100/80 group-hover:bg-amber-500 group-hover:text-white px-1.5 py-0.2 rounded-md font-medium transition-colors">
                后台登录
              </span>
            </div>
            <p className="text-xs text-neutral-500 group-hover:text-neutral-700 transition-colors line-clamp-1">
              {restaurantSlogan || '地道现炒 · 现点现做'}
            </p>
          </div>
        </Link>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2">
          {/* Table Badge: 当后台无设置桌位时完全隐藏，界面更简洁；有桌位或扫码锁定时才显示 */}
          {(hasTables || isTableLocked) && (
            <button
              id="btn-change-table"
              onClick={onChangeTable}
              title={isTableLocked ? '扫码入座锁定中' : '点击切换桌号'}
              className={`flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                isTableLocked
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>{currentTable && currentTable !== '自取/未指定桌位' ? currentTable : '选择桌号'}</span>
              {isTableLocked && (
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-normal">
                  已扫码
                </span>
              )}
            </button>
          )}

          {/* Member & Points button */}
          {onOpenMemberModal && (
            <button
              id="btn-member-center"
              onClick={onOpenMemberModal}
              className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              {user?.is_verified ? (
                <UserCheck className="w-3.5 h-3.5 text-orange-600" />
              ) : (
                <Award className="w-3.5 h-3.5 text-orange-500" />
              )}
              <span className="hidden sm:inline">
                {user?.is_verified ? user.name || '实名会员' : '实名/积分'}
              </span>
              <span className="sm:hidden">
                {user?.is_verified ? '会员' : '积分'}
              </span>
              {user && user.points > 0 && (
                <span className="ml-0.5 text-[10px] bg-orange-200 text-orange-900 font-bold px-1 rounded-full">
                  {user.points}分
                </span>
              )}
            </button>
          )}

          {/* My Orders button */}
          <button
            id="btn-my-orders"
            onClick={onOpenOrders}
            className="relative flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            <ReceiptText className="w-3.5 h-3.5 text-neutral-600" />
            <span>我的订单</span>
            {orderCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-rose-500 rounded-full">
                {orderCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
