'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserCog,
  Plus,
  RefreshCw,
  Trash2,
  KeyRound,
  Power,
  Smartphone,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChefHat,
  Bike,
  ArrowLeftRight,
} from 'lucide-react';
import { StaffUser } from '@/types';
import { parseJsonResponse } from '@/lib/utils';

interface StaffManagementProps {
  tenantId?: string;
}

/**
 * 子租户「店员与角色配置」模块：
 * 店长在此为本店配置两类专业员工账号：
 * 1. 🍳 后厨备餐员 (kitchen) —— 登录后使用后厨备餐大屏，实时汇总菜品，一键齐餐出餐
 * 2. 🛵 接单配送员 (order_handler) —— 登录后如同外卖骑手，抢单接单、到店提货、去送货与送达
 */
export default function StaffManagement({ tenantId = 'default' }: StaffManagementProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 新增表单状态
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'kitchen' | 'order_handler'>('kitchen');
  const [adding, setAdding] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/staff?tenant=${encodeURIComponent(tenantId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await parseJsonResponse(res);
      if (data?.success && Array.isArray(data.data)) {
        setStaffList(data.data);
      } else {
        setError(data?.error || '获取员工列表失败');
      }
    } catch (e: any) {
      setError('加载失败: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/admin/staff?tenant=${encodeURIComponent(tenantId)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const data = await parseJsonResponse(res);
        if (!ignore) {
          if (data?.success && Array.isArray(data.data)) {
            setStaffList(data.data);
          } else {
            setError(data?.error || '获取员工列表失败');
          }
        }
      } catch (e: any) {
        if (!ignore) setError('加载失败: ' + (e?.message || ''));
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      setError('请填写员工姓名和手机号');
      return;
    }
    setAdding(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/admin/staff?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          password: newPassword.trim() || undefined,
          role: newRole,
        }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        setNotice(`✅ ${data.message || '员工已成功添加'}`);
        setNewName('');
        setNewPhone('');
        setNewPassword('');
        fetchStaff();
      } else {
        setError(data?.error || '添加失败');
      }
    } catch (e: any) {
      setError('添加请求失败: ' + (e?.message || ''));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleEnabled = async (staff: StaffUser) => {
    const action = staff.enabled === 1 ? '停用' : '启用';
    if (
      !confirm(
        `确定要${action}员工【${staff.name}】吗？${
          action === '停用' ? '停用后将立即无法登录和处理订单。' : ''
        }`
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: staff.enabled === 1 ? 0 : 1 }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        fetchStaff();
      } else {
        alert(data?.error || `${action}失败`);
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleSwitchRole = async (staff: StaffUser) => {
    const targetRole = staff.role === 'kitchen' ? 'order_handler' : 'kitchen';
    const targetLabel = targetRole === 'kitchen' ? '后厨备餐员' : '接单配送员';
    if (!confirm(`确定将员工【${staff.name}】的角色切换为【${targetLabel}】吗？`)) return;

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        fetchStaff();
      } else {
        alert(data?.error || '切换角色失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleResetPassword = async (staff: StaffUser) => {
    const pwd = prompt(`为员工【${staff.name}】设置新密码：`, '123456');
    if (pwd === null) return;
    if (!pwd.trim()) {
      alert('密码不能为空');
      return;
    }
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd.trim() }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        alert(`已重置【${staff.name}】的登录密码`);
      } else {
        alert(data?.error || '重置失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleDelete = async (staff: StaffUser) => {
    if (
      !confirm(
        `确定要删除员工【${staff.name}（${staff.phone}）】吗？删除后其将无法登录本店后台。`
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        fetchStaff();
      } else {
        alert(data?.error || '删除失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  return (
    <div className="space-y-4">
      {/* 双角色系统说明卡 */}
      <div className="bg-gradient-to-r from-amber-50 via-sky-50 to-indigo-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-neutral-700 shadow-2xs">
        <div className="flex items-start space-x-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed space-y-2">
            <p className="font-bold text-neutral-900 flex items-center space-x-2">
              <UserCog className="w-4 h-4 text-indigo-600" />
              <span>后厨与接单配送员角色协同体系（职责物理解耦与高效协同）</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white/80 rounded-xl border border-amber-200">
                <div className="font-bold text-amber-900 flex items-center space-x-1.5 mb-1">
                  <ChefHat className="w-4 h-4 text-amber-600" />
                  <span>🍳 后厨备餐员 (Kitchen)</span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  登录后默认展示<b>【后厨备餐大屏】</b>。实时汇总待做菜品总量，区分现成常备菜（米饭/烤鸭腿/饮料等一键出餐）与需起锅现炒菜品，专注菜品制作与齐餐。
                </p>
              </div>
              <div className="p-3 bg-white/80 rounded-xl border border-blue-200">
                <div className="font-bold text-blue-900 flex items-center space-x-1.5 mb-1">
                  <Bike className="w-4 h-4 text-blue-600" />
                  <span>🛵 接单配送员 (Rider / Delivery)</span>
                </div>
                <p className="text-[11px] text-neutral-600">
                  外卖配送员如同美团外卖骑手：<b>接单抢单 → 到店提货 → 开始配送 → 送达完成</b>。后厨做菜与骑手抢单并行流转，互不干扰且无死锁。
                </p>
              </div>
            </div>
            <p className="text-[11px] text-neutral-500">
              店员登录地址：
              <code className="mx-1 px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px]">
                /admin?tenant={tenantId}
              </code>
              选择「店员/接单员登录」，输入手机号与密码即可。
            </p>
          </div>
        </div>
      </div>

      {/* 新增员工表单 */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center space-x-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>添加本店员工 (后厨 / 配送接单员)</span>
          </h3>
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition-colors cursor-pointer"
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">姓名 *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：张师傅 / 李小哥"
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">
                手机号（登录账号）*
              </label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="如：13800138000"
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">岗位角色 *</label>
              <div className="flex rounded-xl p-0.5 bg-neutral-100 border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setNewRole('kitchen')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                    newRole === 'kitchen'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5" />
                  <span>后厨备餐员</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewRole('order_handler')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                    newRole === 'order_handler'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>接单配送员</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-600 mb-1">初始密码</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="默认 123456"
                className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={adding}
              className="px-5 py-2.5 bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-black hover:to-neutral-900 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>
                {adding
                  ? '添加中...'
                  : `确认添加${newRole === 'kitchen' ? '【后厨备餐员】' : '【接单配送员】'}`}
              </span>
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
      </div>

      {/* 员工列表 */}
      {loading && staffList.length === 0 ? (
        <div className="py-16 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          正在加载员工列表...
        </div>
      ) : staffList.length === 0 ? (
        <div className="py-14 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
          本店暂无配置员工，在上方添加后厨或接单员后即可协助打理门店
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                  <th className="py-3 px-4">员工姓名</th>
                  <th className="py-3 px-4">手机号（登录账号）</th>
                  <th className="py-3 px-4">分配角色</th>
                  <th className="py-3 px-4">账号状态</th>
                  <th className="py-3 px-4 hidden md:table-cell">创建时间</th>
                  <th className="py-3 px-4 text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {staffList.map((staff) => {
                  const isEnabled = staff.enabled === 1;
                  const isKitchen = staff.role === 'kitchen';

                  return (
                    <tr
                      key={staff.id}
                      className={`hover:bg-neutral-50/70 transition-colors ${
                        isEnabled ? '' : 'opacity-60 bg-neutral-50/40'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-neutral-900 flex items-center space-x-2">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isKitchen
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {isKitchen ? (
                              <ChefHat className="w-4 h-4" />
                            ) : (
                              <Bike className="w-4 h-4" />
                            )}
                          </div>
                          <span>{staff.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-neutral-700 flex items-center space-x-1">
                          <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{staff.phone}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center space-x-1.5">
                          {isKitchen ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-black flex items-center space-x-1">
                              <ChefHat className="w-3.5 h-3.5 text-amber-600" />
                              <span>后厨备餐员</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black flex items-center space-x-1">
                              <Bike className="w-3.5 h-3.5 text-blue-600" />
                              <span>接单配送员</span>
                            </span>
                          )}
                          <button
                            onClick={() => handleSwitchRole(staff)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors cursor-pointer"
                            title={`切换为【${isKitchen ? '接单配送员' : '后厨备餐员'}】`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleEnabled(staff)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                          }`}
                          title={isEnabled ? '点击停用（立即失去登录权限）' : '点击重新启用'}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isEnabled ? 'bg-emerald-500' : 'bg-neutral-400'
                            }`}
                          ></span>
                          <span>{isEnabled ? '正常在岗' : '已停用'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 hidden md:table-cell text-neutral-400">
                        {staff.created_at
                          ? new Date(staff.created_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleResetPassword(staff)}
                          className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block cursor-pointer"
                          title="重置登录密码"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block cursor-pointer"
                          title="删除员工"
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
  );
}
