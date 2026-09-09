'use client';

import React from 'react';
import Image from 'next/image';
import { X, Plus, Minus } from 'lucide-react';
import { Dish } from '@/types';

interface DishModalProps {
  dish: Dish | null;
  onClose: () => void;
  quantityInCart: number;
  onAdd: (dish: Dish) => void;
  onRemove: (dish: Dish) => void;
}

export default function DishModal({
  dish,
  onClose,
  quantityInCart,
  onAdd,
  onRemove,
}: DishModalProps) {
  if (!dish) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Dish Image */}
        <div className="relative w-full h-56 bg-neutral-100 shrink-0">
          <Image
            src={dish.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'}
            alt={dish.name}
            fill
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-xs"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/60 text-white backdrop-blur-xs">
            {dish.category}
          </span>
        </div>

        {/* Dish Info */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-lg font-bold text-neutral-900">{dish.name}</h2>
            <div className="text-xl font-bold text-rose-600 shrink-0">
              <span className="text-sm font-normal">¥</span>{dish.price}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-neutral-600 mb-6">
            {dish.description || '精选优质新鲜食材，厨师现炒现烹，口感绝佳。'}
          </p>

          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 mb-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>状态：{dish.status === 1 ? '现做在售' : '暂时沽清'}</span>
              <span>主厨推荐 · 现点现做</span>
            </div>
            {dish.taste_options && (
              <div className="pt-1.5 border-t border-neutral-200/60 text-xs">
                <span className="text-neutral-500 font-medium">支持口味定制：</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {dish.taste_options.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 text-[10px] border border-amber-200/80 font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] text-neutral-500">小计金额</span>
            <span className="text-base font-bold text-rose-600">
              ¥{(dish.price * Math.max(1, quantityInCart)).toFixed(2)}
            </span>
          </div>

          {quantityInCart === 0 ? (
            <button
              onClick={() => onAdd(dish)}
              disabled={dish.status !== 1}
              className={`px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-xs transition-colors flex items-center space-x-1.5 ${
                dish.status === 1
                  ? 'bg-amber-500 hover:bg-amber-600 active:scale-95'
                  : 'bg-neutral-300 cursor-not-allowed'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{dish.status === 1 ? '加入购物车' : '已售罄'}</span>
            </button>
          ) : (
            <div className="flex items-center space-x-3 bg-white px-3 py-1.5 rounded-full border border-neutral-200 shadow-2xs">
              <button
                onClick={() => onRemove(dish)}
                className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700 hover:bg-neutral-200 active:scale-90 transition-transform"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold text-neutral-900 min-w-5 text-center">
                {quantityInCart}
              </span>
              <button
                onClick={() => onAdd(dish)}
                className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 active:scale-90 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
