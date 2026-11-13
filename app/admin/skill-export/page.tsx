'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  FolderArchive,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import MarkdownDocViewer from '@/components/admin/MarkdownDocViewer';
import { parseJsonResponse } from '@/lib/utils';

interface SkillFileItem {
  id: string;
  relativePath: string;
  zipPath: string;
  title: string;
  summary: string;
  category: '主规范' | '参考规范';
  content: string;
  bytes: number;
  lines: number;
}

interface PromptTemplate {
  id: string;
  title: string;
  desc: string;
  prompt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function SkillExportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<SkillFileItem[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [totalLines, setTotalLines] = useState(0);
  const [selectedFileId, setSelectedFileId] = useState<string>('skill-md');
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const fetchBundleData = async () => {
    const res = await fetch('/api/skills/my-create-multenant', { cache: 'no-store' });
    const data = await parseJsonResponse<any>(res, { success: false });
    if (!data.success) {
      throw new Error(data.error || '加载技能包失败');
    }
    return data;
  };

  const applyBundleData = (data: any) => {
    setFiles(data.files || []);
    setPromptTemplates(data.promptTemplates || []);
    setTotalBytes(data.totalBytes || 0);
    setTotalLines(data.totalLines || 0);
    if (data.files?.length > 0) {
      setSelectedFileId((prev) =>
        data.files.some((f: SkillFileItem) => f.id === prev) ? prev : data.files[0].id
      );
    }
  };

  const loadSkillBundle = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchBundleData();
      applyBundleData(data);
    } catch (err: any) {
      setError(err?.message || '网络异常，无法读取技能文件');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchBundleData()
      .then((data) => {
        if (!cancelled) {
          applyBundleData(data);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || '网络异常，无法读取技能文件');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFile = useMemo(
    () => files.find((f) => f.id === selectedFileId) || files[0] || null,
    [files, selectedFileId]
  );

  const handleCopyFile = async (file: SkillFileItem) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFileId(file.id);
      setTimeout(() => setCopiedFileId(null), 1800);
    } catch {
      setError('浏览器剪贴板权限受限，请切换至“原始源码”手动复制');
    }
  };

  const handleDownloadSingleFile = (file: SkillFileItem) => {
    const blob = new Blob([file.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.relativePath.split('/').pop() || 'SKILL.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyPrompt = async (tpl: PromptTemplate) => {
    try {
      await navigator.clipboard.writeText(tpl.prompt);
      setCopiedPromptId(tpl.id);
      setTimeout(() => setCopiedPromptId(null), 1800);
    } catch {
      setError('复制提示词失败，请手动选中文本复制');
    }
  };

  const handleDownloadZip = async () => {
    if (downloadingZip) return;
    setDownloadingZip(true);
    setError('');
    try {
      const res = await fetch('/api/skills/my-create-multenant?download=zip', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`下载失败 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my_create_multenant.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || '打包下载技能包失败');
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 顶栏：三区结构（面包屑标题 — 核心视图切换 — 一键下载ZIP主按钮） */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>管理后台</span>
            </Link>
            <span className="text-slate-300" aria-hidden="true">/</span>
            <h1 className="text-base font-semibold text-slate-900 truncate whitespace-nowrap">
              my_create_multenant 架构技能工作台
            </h1>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFileId(f.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFile?.id === f.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {f.category === '主规范' ? '主规范手册' : f.title.replace(/^\d+\.\s*/, '')}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloadingZip || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{downloadingZip ? '正在打包...' : '下载完整技能包 (.zip)'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadSkillBundle}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-900 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重新加载</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧栏：技能文件目录 + 提示词模板 */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">技能包文件清单</h2>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {files.length} 个文件 · {formatBytes(totalBytes)}
                </span>
              </div>

              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {files.map((file) => {
                    const isSelected = activeFile?.id === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                          isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-900'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="text-sm font-medium truncate">{file.title}</span>
                          </div>
                          <span
                            className={`text-[11px] font-mono tabular-nums shrink-0 ${
                              isSelected ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            {formatBytes(file.bytes)}
                          </span>
                        </div>
                        <div
                          className={`mt-1 text-xs leading-relaxed line-clamp-2 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {file.summary}
                        </div>
                        <div
                          className={`mt-1.5 text-[11px] font-mono tabular-nums ${
                            isSelected ? 'text-slate-400' : 'text-slate-400'
                          }`}
                        >
                          {file.relativePath} · {file.lines} 行
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>本地落盘位置</span>
                <span className="font-mono text-slate-800">skills/my_create_multenant/</span>
              </div>
            </section>

            {/* 快捷新项目调用提示词 */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">新项目快捷调用提示词</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {promptTemplates.map((tpl) => {
                  const isCopied = copiedPromptId === tpl.id;
                  return (
                    <div key={tpl.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{tpl.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{tpl.desc}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(tpl)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                          )}
                          <span>{isCopied ? '已复制' : '复制'}</span>
                        </button>
                      </div>
                      <p className="mt-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5 leading-relaxed">
                        {tpl.prompt}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>

          {/* 右侧主文档阅读与导出区 */}
          <section className="lg:col-span-8 xl:col-span-9 bg-white rounded-xl border border-slate-200 overflow-hidden min-h-[640px] flex flex-col">
            {loading ? (
              <div className="p-8 space-y-4">
                <div className="h-7 w-1/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-64 w-full bg-slate-100 rounded-lg animate-pulse mt-6" />
              </div>
            ) : !activeFile ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <p className="text-sm text-slate-600 mb-4">暂未找到可展示的技能文件</p>
                <button
                  type="button"
                  onClick={loadSkillBundle}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium cursor-pointer"
                >
                  重新读取技能目录
                </button>
              </div>
            ) : (
              <>
                {/* 文档工具栏 */}
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-white">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{activeFile.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{activeFile.zipPath}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{activeFile.lines} 行</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(activeFile.bytes)}</span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mt-1">{activeFile.title}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* 视图切换 */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setViewMode('rendered')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          viewMode === 'rendered'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>结构化阅读</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('raw')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          viewMode === 'raw'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>原始 Markdown</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopyFile(activeFile)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedFileId === activeFile.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>{copiedFileId === activeFile.id ? '已复制全文' : '复制本文件'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadSingleFile(activeFile)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>导出单文件</span>
                    </button>
                  </div>
                </div>

                {/* 文档正文区 */}
                <motion.div
                  key={`${activeFile.id}-${viewMode}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="p-6 sm:p-8 flex-1 overflow-x-auto"
                >
                  {viewMode === 'rendered' ? (
                    <MarkdownDocViewer content={activeFile.content} />
                  ) : (
                    <pre className="p-5 rounded-lg bg-slate-950 text-slate-100 text-[13px] leading-relaxed font-mono overflow-x-auto whitespace-pre-wrap break-words">
                      {activeFile.content}
                    </pre>
                  )}
                </motion.div>

                {/* 底部汇总结算条 */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
                  <span>
                    导入其他项目方式：将压缩包解压至新项目根目录 <code className="font-mono text-slate-700">skills/my_create_multenant/</code> 即可使用
                  </span>
                  <span className="font-mono tabular-nums">
                    全包总计 {files.length} 个文件 · {totalLines} 行 · {formatBytes(totalBytes)}
                  </span>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
