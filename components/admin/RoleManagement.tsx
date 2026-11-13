'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Power,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  KeyRound,
  X,
  Lock,
} from 'lucide-react';
import { parseJsonResponse } from '@/lib/utils';

interface RoleRecord {
  id: number;
  role_key: string;
  name: string;
  permissions: string[];
  is_system: number;
  enabled: number;
  user_count?: number;
  created_at?: string;
}

interface CatalogItem {
  key: string;
  name: string;
  desc: string;
  module: string;
  sensitive?: boolean;
  destructive?: boolean;
  cost?: boolean;
  nonDelegable?: boolean;
}

interface RoleManagementProps {
  tenantId?: string;
}

/**
 * 「角色权限」模块（RBAC 核心 UI）：
 * 店长/管理员为本店创建自定义角色（如"创业者""店长助理"）并勾选权限；
 * 权限目录按模块分组展示，敏感项警告、破坏项默认不勾、永不下放项置灰。
 * 服务端双重防线：nonDelegable 键强制剔除 + 员工会话子集铁律。
 */
export default function RoleManagement({ tenantId = 'default' }: RoleManagementProps) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [actorPerms, setActorPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 编辑器状态（null=关闭；{mode:'create'} 新建；{mode:'edit', role} 编辑）
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; role?: RoleRecord } | null>(null);
  const [editName, setEditName] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/roles?tenant=${encodeURIComponent(tenantId)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await parseJsonResponse(res);
      if (data?.success && Array.isArray(data.data)) {
        setRoles(data.data);
        if (Array.isArray(data.catalog)) setCatalog(data.catalog);
        if (Array.isArray(data.actorPermissions)) setActorPerms(data.actorPermissions);
      } else {
        setError(data?.error || '获取角色列表失败');
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
        const res = await fetch(`/api/admin/roles?tenant=${encodeURIComponent(tenantId)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        const data = await parseJsonResponse(res);
        if (!ignore) {
          if (data?.success && Array.isArray(data.data)) {
            setRoles(data.data);
            if (Array.isArray(data.catalog)) setCatalog(data.catalog);
            if (Array.isArray(data.actorPermissions)) setActorPerms(data.actorPermissions);
          } else {
            setError(data?.error || '获取角色列表失败');
          }
        }
      } catch (e: any) {
        if (!ignore) setError('加载失败: ' + (e?.message || ''));
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [tenantId]);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    for (const item of catalog) {
      (groups[item.module] = groups[item.module] || []).push(item);
    }
    return groups;
  }, [catalog]);

  const openCreate = () => {
    setEditName('');
    setEditKey('');
    setEditPerms(new Set());
    setError('');
    setNotice('');
    setEditor({ mode: 'create' });
  };

  const openEdit = (role: RoleRecord) => {
    setEditName(role.name);
    setEditKey(role.role_key);
    setEditPerms(new Set(role.permissions || []));
    setError('');
    setNotice('');
    setEditor({ mode: 'edit', role });
  };

  const togglePerm = (key: string) => {
    setEditPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setError('请填写角色名称');
      return;
    }
    if (editor?.mode === 'create' && !editKey.trim()) {
      setError('请填写角色标识（英文小写，如 entrepreneur）');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isCreate = editor?.mode === 'create';
      const res = await fetch(`/api/admin/roles?tenant=${encodeURIComponent(tenantId)}`, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isCreate
            ? { role_key: editKey.trim(), name: editName.trim(), permissions: Array.from(editPerms) }
            : { id: editor?.role?.id, name: editName.trim(), permissions: Array.from(editPerms) }
        ),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        setNotice(`✅ ${data.message || '角色已保存'}`);
        setEditor(null);
        fetchRoles();
      } else {
        setError(data?.error || '保存失败');
      }
    } catch (e: any) {
      setError('保存请求失败: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (role: RoleRecord) => {
    const action = role.enabled === 1 ? '停用' : '启用';
    if (
      !confirm(
        `确定要${action}角色【${role.name}】吗？` +
          (action === '停用' ? `\n停用后其名下 ${role.user_count || 0} 名员工将立即失去全部权限（下次刷新生效）。` : '')
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/roles?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: role.id, enabled: role.enabled === 1 ? 0 : 1 }),
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        fetchRoles();
      } else {
        alert(data?.error || `${action}失败`);
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const handleDelete = async (role: RoleRecord) => {
    if (!confirm(`确定要删除角色【${role.name}（${role.role_key}）】吗？`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${role.id}?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      });
      const data = await parseJsonResponse(res);
      if (data?.success) {
        fetchRoles();
      } else {
        alert(data?.error || '删除失败');
      }
    } catch (e: any) {
      alert('操作失败: ' + (e?.message || ''));
    }
  };

  const permNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of catalog) m[c.key] = c.name;
    return m;
  }, [catalog]);

  return (
    <div className="space-y-4">
      {/* 说明卡 */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70 rounded-2xl p-4 text-xs text-neutral-700 flex items-start space-x-2.5">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <p className="font-bold text-neutral-800 mb-1 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>角色与权限（把本店管理能力灵活下放给创业者/店长助理）</span>
          </p>
          <p>
            为本店创建自定义角色并勾选权限，再到「店员配置」把角色分配给员工（手机号登录后台）。
            排序建议：勾选「管理员工账号」即可让创业者自建后厨/接单员；<b>收款与AI配置永不下放</b>（置灰项）；
            修改角色权限后，对应员工下一次刷新页面即生效，无需重新登录。
          </p>
        </div>
      </div>

      {error && !editor && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 角色列表 */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-neutral-100">
          <h3 className="text-sm font-bold text-neutral-900 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>本店角色（{roles.length}）</span>
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRoles}
              disabled={loading}
              className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition-colors cursor-pointer"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center space-x-1.5 transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>新建角色</span>
            </button>
          </div>
        </div>

        {loading && roles.length === 0 ? (
          <div className="py-14 text-center text-xs text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
            正在加载角色列表...
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {roles.map((role) => {
              const isEnabled = role.enabled === 1;
              return (
                <div key={role.id} className={`p-4 flex flex-wrap items-center gap-3 ${isEnabled ? '' : 'opacity-60'}`}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold text-neutral-900 text-sm">{role.name}</span>
                      <code className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 rounded text-[10px] text-neutral-500">
                        {role.role_key}
                      </code>
                      {role.is_system === 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                          系统内置
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-400">{role.user_count || 0} 名员工使用</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(role.permissions || []).slice(0, 6).map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px]">
                          {permNameMap[p] || p}
                        </span>
                      ))}
                      {(role.permissions || []).length > 6 && (
                        <span className="px-1.5 py-0.5 rounded bg-neutral-50 border border-neutral-200 text-neutral-500 text-[10px]">
                          +{role.permissions.length - 6} 项
                        </span>
                      )}
                      {(role.permissions || []).length === 0 && (
                        <span className="text-[10px] text-rose-500">（无权限·已停用等效）</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => openEdit(role)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>配置权限</span>
                    </button>
                    <button
                      onClick={() => handleToggleEnabled(role)}
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center space-x-1.5 ${
                        isEnabled
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                      <span>{isEnabled ? '启用中' : '已停用'}</span>
                    </button>
                    {role.is_system !== 1 && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="删除角色"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 角色编辑器 */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 text-base">
                    {editor.mode === 'create' ? '新建角色' : `配置角色权限：${editor.role?.name}`}
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    {editor.mode === 'create' ? '角色标识创建后不可修改' : `${editPerms.size} 项权限已勾选`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditor(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    角色名称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="如：创业者 / 店长助理"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">
                    角色标识 {editor.mode === 'create' && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    disabled={editor.mode === 'edit'}
                    placeholder="如 entrepreneur（小写英文）"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:bg-neutral-100 disabled:text-neutral-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <p className="font-bold text-neutral-700 mb-2">权限勾选（按模块分组）</p>
                <div className="space-y-3">
                  {Object.entries(groupedCatalog).map(([moduleName, items]) => (
                    <div key={moduleName} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <p className="text-[11px] font-bold text-neutral-500 mb-2">{moduleName}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {items.map((item) => {
                          const checked = editPerms.has(item.key);
                          const locked = !!item.nonDelegable;
                          return (
                            <label
                              key={item.key}
                              className={`flex items-start space-x-2 p-2.5 rounded-xl border transition-all select-none ${
                                locked
                                  ? 'bg-neutral-100/70 border-neutral-200 cursor-not-allowed opacity-70'
                                  : checked
                                  ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold shadow-2xs cursor-pointer'
                                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={locked}
                                onChange={() => togglePerm(item.key)}
                                className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 border-neutral-300 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <span className="flex-1">
                                <span className="flex items-center space-x-1 flex-wrap gap-y-0.5">
                                  <span className="text-xs">{item.name}</span>
                                  {locked && (
                                    <span className="inline-flex items-center text-[9px] text-neutral-400">
                                      <Lock className="w-2.5 h-2.5 mr-0.5" />
                                      仅管理员
                                    </span>
                                  )}
                                  {item.sensitive && !locked && (
                                    <span className="px-1 py-0.1 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">敏感</span>
                                  )}
                                  {item.destructive && (
                                    <span className="px-1 py-0.1 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">破坏性</span>
                                  )}
                                  {item.cost && (
                                    <span className="px-1 py-0.1 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">耗AI额度</span>
                                  )}
                                </span>
                                <span className={`block text-[10px] mt-0.5 leading-snug ${checked ? 'text-emerald-800' : 'text-neutral-400'}`}>
                                  {item.desc}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between space-x-2.5 shrink-0">
              <span className="text-[11px] text-neutral-400 hidden sm:block">
                已勾选 {editPerms.size} 项 · 收款/AI 配置永不下放（服务端强制）
              </span>
              <div className="flex items-center space-x-2.5 ml-auto">
                <button
                  onClick={() => setEditor(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-xs disabled:opacity-60"
                >
                  {saving ? '保存中...' : editor.mode === 'create' ? '创建角色' : '保存权限'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
