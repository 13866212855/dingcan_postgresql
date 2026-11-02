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
} from 'lucide-react';
import { StaffUser } from '@/types';

interface StaffManagementProps {
  tenantId?: string;
}

/**
 * 子租户「接单员管理」模块（mymultenant 技能 Tier 3 角色落地）：
 * 店长在此为本店配置接单员账号；接单员用手机号+密码登录本店后台，
 * 仅能看到并处理本店订单（前端 RBAC 物理裁剪 + 服务端严格租户隔离）。
 */
export default function StaffManagement({ tenantId = 'default' }: StaffManagementProps) {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 新增表单
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/staff?tenant=${encodeURIComponent(tenantId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setStaffList(data.data);
      } else {
        setError(data.error || '获取接单员列表失败');
      }
    } catch (e: any) {
      setError('加载失败: ' + (e?.message || ''));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      setError('请填写接单员姓名和手机号');
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice(`✅ ${data.message || '接单员已添加'}`);
        setNewName('');
        setNewPhone('');
        setNewPassword('');
        fetchStaff();
      } else {
        setError(data.error || '添加失败');
      }
    } catch (e: any) {
      setError('添加请求失败: ' + (e?.message || ''));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleEnabled = async (staff: StaffUser) => {
    const action = staff.enabled === 1 ? '停用' : '启用';
    if (!confirm(`确定要${action}接单员【${staff.name}】吗？${action === '停用' ? '停用后将立即无法登录和处理订单。' : ''}`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: staff.enabled === 1 ? 0 : 1 }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
      } else {
        alert(data.error || `${action}失败`);
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleResetPassword = async (staff: StaffUser) => {
    const pwd = prompt(`为接单员【${staff.name}】设置新密码：`, '123456');
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
      const data = await res.json();
      if (data.success) {
        alert(`已重置【${staff.name}】的登录密码`);
      } else {
        alert(data.error || '重置失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleDelete = async (staff: StaffUser) => {
    if (!confirm(`确定要删除接单员【${staff.name}（${staff.phone}）】吗？删除后其将无法登录本店后台。`)) return;
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchStaff();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  return (
    <div className="space-y-4">
      {/* 角色说明卡 */}
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-indigo-200/70 rounded-2xl p-4 text-xs text-neutral-700 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <p className="font-bold text-neutral-800 mb-1 flex items-center space-x-1.5">
            <UserCog className="w-3.5 h-3.5 text-indigo-500" />
            <span>接单员角色说明（谁来接收和处理顾客订单）</span>
          </p>
          <p>
            在此为本店添加接单员账号（手机号 + 初始密码，默认 123456）。接单员打开本店后台地址
            <code className="mx-1 px-1.5 py-0.5 bg-white border border-neutral-200 rounded text-[10px]">
              /admin?tenant={tenantId}
            </code>
            在登录页切换为「接单员登录」，用手机号登录后<b>只能看到本店订单中心</b>：接收新订单提醒（含语音）、接单制作、出餐完成、核对收款，其余管理功能对其完全隐藏。数据严格隔离：本店接单员看不到其他门店的任何订单。
          </p>
        </div>
      </div>

      {/* 新增接单员表单 */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-neutral-900">添加本店接单员</h3>
          <button
            onClick={fetchStaff}
            disabled={loading}
            className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition-colors"
            title="刷新列表"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">姓名 *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="如：张强"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">手机号（登录账号）*</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="如：13800138000"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
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
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-sky-600 hover:from-indigo-600 hover:to-sky-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center space-x-1.5 transition-transform active:scale-95 disabled:opacity-60"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{adding ? '添加中...' : '添加接单员'}</span>
          </button>
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

      {/* 接单员列表 */}
      {loading && staffList.length === 0 ? (
        <div className="py-16 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          正在加载接单员列表...
        </div>
      ) : staffList.length === 0 ? (
        <div className="py-14 text-center text-xs text-neutral-400 bg-white rounded-2xl border border-neutral-200">
          本店还没有接单员——在上方添加后，员工即可用手机号登录接收和处理本店订单
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                  <th className="py-3 px-4">姓名</th>
                  <th className="py-3 px-4">手机号（登录账号）</th>
                  <th className="py-3 px-4">角色</th>
                  <th className="py-3 px-4">状态</th>
                  <th className="py-3 px-4 hidden md:table-cell">添加时间</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {staffList.map((staff) => {
                  const isEnabled = staff.enabled === 1;
                  return (
                    <tr key={staff.id} className={`hover:bg-neutral-50/70 transition-colors ${isEnabled ? '' : 'opacity-60'}`}>
                      <td className="py-3 px-4">
                        <div className="font-bold text-neutral-900 flex items-center space-x-1.5">
                          <UserCog className={`w-3.5 h-3.5 ${isEnabled ? 'text-indigo-500' : 'text-neutral-300'}`} />
                          <span>{staff.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-neutral-700 flex items-center space-x-1">
                          <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{staff.phone}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                          接单员
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleEnabled(staff)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                            isEnabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                          }`}
                          title={isEnabled ? '点击停用（立即失去登录权限）' : '点击重新启用'}
                        >
                          <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                          <span>{isEnabled ? '启用中' : '已停用'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell text-neutral-400">
                        {staff.created_at ? new Date(staff.created_at).toLocaleString('zh-CN', {
                          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                        }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => handleResetPassword(staff)}
                          className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                          title="重置登录密码"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(staff)}
                          className="p-1.5 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                          title="删除接单员"
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
