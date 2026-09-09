'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Award,
  CreditCard,
  PlusCircle,
  ShieldCheck,
  AlertCircle,
  Phone,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { AppUser } from '@/types';

interface MemberManagementProps {
  tenantId?: string;
}

export default function MemberManagement({ tenantId = 'default' }: MemberManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rechargeModalUser, setRechargeModalUser] = useState<AppUser | null>(null);

  // Form state
  const [pointsDelta, setPointsDelta] = useState<number>(100);
  const [balanceDelta, setBalanceDelta] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users?tenant=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch members:', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/users?tenant=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.data)) {
          setUsers(data.data);
        }
      } catch (e) {
        console.error('Failed to fetch members:', e);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.phone && u.phone.includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const handleOpenRecharge = (u: AppUser) => {
    setRechargeModalUser(u);
    setPointsDelta(100);
    setBalanceDelta(0);
    setErrorMsg('');
  };

  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeModalUser) return;

    if (!rechargeModalUser.is_verified) {
      setErrorMsg('根据规定，用户必须先完成实名认证（绑定手机号）方可充值积分或余额。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/recharge?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rechargeModalUser.id,
          pointsDelta,
          balanceDelta,
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRechargeModalUser(null);
        fetchUsers();
      } else {
        setErrorMsg(data.error || '充值失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接异常');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPoints = users.reduce((acc, u) => acc + (u.points || 0), 0);
  const verifiedCount = users.filter((u) => u.is_verified === 1).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-amber-600" />
            <span>会员与积分资产管理</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            查看顾客实名身份、积分余额、累计消费统计，支持后台管理员给会员充值积分与余额
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>刷新列表</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-neutral-500">会员总数</span>
          <div className="text-2xl font-black text-neutral-900 mt-1">{users.length}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-emerald-600 font-bold">已实名认证会员</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{verifiedCount}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-2xs">
          <span className="text-xs text-amber-600 font-bold">全店总发放积分</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {totalPoints} <span className="text-xs font-normal text-neutral-500">分</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="根据会员手机号、姓名或用户ID筛选..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
        />
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold">
                <th className="py-3 px-4">会员信息 / 姓名</th>
                <th className="py-3 px-4">手机号码 (实名凭证)</th>
                <th className="py-3 px-4">认证状态</th>
                <th className="py-3 px-4">可用积分 (抵扣现金)</th>
                <th className="py-3 px-4">会员余额</th>
                <th className="py-3 px-4">累计消费</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-neutral-400">
                    暂未检索到符合条件的会员数据
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-neutral-900">{u.name || '顾客 (未实名)'}</div>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{u.id}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-700">
                      {u.phone || <span className="text-neutral-300">未绑定</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.is_verified ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>已实名</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500">
                          未实名
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-black text-amber-600 text-sm">{u.points || 0}</span>
                      <span className="text-[10px] text-neutral-400 ml-1">分 (=¥{(u.points || 0).toFixed(2)})</span>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-neutral-800">
                      ¥{(u.balance || 0).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-neutral-600">
                      ¥{(u.total_spent || 0).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenRecharge(u)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-[11px] shadow-2xs transition-all active:scale-95"
                      >
                        充值积分/余额
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recharge Modal */}
      {rechargeModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-neutral-200 animate-in zoom-in-95">
            <h3 className="font-bold text-neutral-900 text-base mb-1">
              会员充值与积分调整
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              当前会员：<strong>{rechargeModalUser.name || rechargeModalUser.phone || rechargeModalUser.id}</strong>
            </p>

            {errorMsg && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!rechargeModalUser.is_verified ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 mb-4">
                <p className="font-bold">该用户尚未完成实名认证</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  根据业务规范，用户必须先提供手机号和姓名进行实名登记，方可启用积分与余额充值。
                </p>
              </div>
            ) : null}

            <form onSubmit={handleRechargeSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  充值增加积分（正数增加，负数扣减，1分=1元）
                </label>
                <input
                  type="number"
                  step="1"
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(Number(e.target.value))}
                  placeholder="例如：100"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">
                  充值增加钱包余额（元）
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={balanceDelta}
                  onChange={(e) => setBalanceDelta(Number(e.target.value))}
                  placeholder="例如：50"
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl text-xs text-neutral-600 space-y-1">
                <div>充值后预计积分：<strong>{Math.max(0, (rechargeModalUser.points || 0) + pointsDelta)} 分</strong></div>
                <div>充值后预计余额：<strong>¥{Math.max(0, (rechargeModalUser.balance || 0) + balanceDelta).toFixed(2)}</strong></div>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRechargeModalUser(null)}
                  className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || !rechargeModalUser.is_verified}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? '处理中...' : '确认充值'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
