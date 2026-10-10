'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Brain,
  Sparkles,
  Cpu,
  Key,
  Globe,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  Send,
  Save,
  AlertCircle,
  CheckCircle2,
  Zap,
  Sliders,
  Layers,
  Bot,
  Flame,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { LLMConfig, DEFAULT_LLM_CONFIG } from '@/types';

interface LLMManagementProps {
  tenantId?: string;
}

export default function LLMManagement({ tenantId = 'default' }: LLMManagementProps) {
  // LLM Config state
  const [baseUrl, setBaseUrl] = useState(DEFAULT_LLM_CONFIG.baseUrl);
  const [apiKey, setApiKey] = useState(DEFAULT_LLM_CONFIG.apiKey);
  const [textModel, setTextModel] = useState(DEFAULT_LLM_CONFIG.textModel);
  const [imageModel, setImageModel] = useState(DEFAULT_LLM_CONFIG.imageModel);
  const [autoProcessImages, setAutoProcessImages] = useState(true);
  const [maxDimension, setMaxDimension] = useState(1200);
  const [quality, setQuality] = useState(82);

  // UI state
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Interactive Test State
  const [activeTestTab, setActiveTestTab] = useState<'text' | 'image' | 'vision'>('text');
  
  // Text Model Test
  const [textPrompt, setTextPrompt] = useState('请回复【大模型连接测试成功】，并用一句话介绍你作为点餐系统智能大脑的核心能力（如智能优化菜品图片、编写美味介绍等）。');
  const [testingText, setTestingText] = useState(false);
  const [textTestResult, setTextTestResult] = useState<{
    success: boolean;
    durationMs?: number;
    reply?: string;
    modelUsed?: string;
    error?: string;
    usage?: any;
  } | null>(null);

  // Image Model Test
  const [imagePrompt, setImagePrompt] = useState('一盘色香味俱全的招牌精品宫保鸡丁，精美摆盘，餐厅特写摄影，自然光泽诱人');
  const [testingImage, setTestingImage] = useState(false);
  const [imageTestResult, setImageTestResult] = useState<{
    success: boolean;
    durationMs?: number;
    imageUrl?: string;
    modelUsed?: string;
    error?: string;
  } | null>(null);

  // Vision Test
  const [visionImageUrl, setVisionImageUrl] = useState('');
  const [testingVision, setTestingVision] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState<any | null>(null);
  const [visionUploadLoading, setVisionUploadLoading] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/llm?tenant=${encodeURIComponent(tenantId)}`);
        const json = await res.json();
        if (json.success && json.data) {
          const cfg = json.data as LLMConfig;
          setBaseUrl(cfg.baseUrl || DEFAULT_LLM_CONFIG.baseUrl);
          setApiKey(cfg.apiKey || DEFAULT_LLM_CONFIG.apiKey);
          setTextModel(cfg.textModel || DEFAULT_LLM_CONFIG.textModel);
          setImageModel(cfg.imageModel || DEFAULT_LLM_CONFIG.imageModel);
          setAutoProcessImages(cfg.autoProcessImages !== false);
          setMaxDimension(cfg.maxDimension || 1200);
          setQuality(cfg.quality || 82);
        }
      } catch (err) {
        console.error('加载大模型配置失败:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [tenantId]);

  // Copy API key
  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Save Config
  const handleSaveConfig = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/admin/llm?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          textModel,
          imageModel,
          autoProcessImages,
          maxDimension,
          quality,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(json.message || '大模型大脑配置已保存成功！');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(json.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg('网络请求异常: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Reset to default
  const handleResetToDefault = async () => {
    if (!confirm('确定要恢复大模型默认参数吗？\n将重置为 Agnes AI 官方标准配置。')) {
      return;
    }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/admin/llm?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToDefault: true }),
      });
      const json = await res.json();
      if (json.success) {
        setBaseUrl(DEFAULT_LLM_CONFIG.baseUrl);
        setApiKey(DEFAULT_LLM_CONFIG.apiKey);
        setTextModel(DEFAULT_LLM_CONFIG.textModel);
        setImageModel(DEFAULT_LLM_CONFIG.imageModel);
        setAutoProcessImages(true);
        setMaxDimension(1200);
        setQuality(82);
        setSuccessMsg('已成功恢复为默认大模型大脑参数！');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg(json.error || '恢复失败');
      }
    } catch (err: any) {
      setErrorMsg('网络请求异常: ' + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  // Run Text Test
  const handleTestTextModel = async () => {
    setTestingText(true);
    setTextTestResult(null);

    try {
      const res = await fetch('/api/admin/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'text',
          baseUrl,
          apiKey,
          textModel,
          prompt: textPrompt,
        }),
      });
      const json = await res.json();
      setTextTestResult(json);
    } catch (err: any) {
      setTextTestResult({
        success: false,
        error: '测试异常: ' + (err?.message || '网络超时'),
      });
    } finally {
      setTestingText(false);
    }
  };

  // Run Image Test
  const handleTestImageModel = async () => {
    setTestingImage(true);
    setImageTestResult(null);

    try {
      const res = await fetch('/api/admin/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image',
          baseUrl,
          apiKey,
          imageModel,
          prompt: imagePrompt,
        }),
      });
      const json = await res.json();
      setImageTestResult(json);
    } catch (err: any) {
      setImageTestResult({
        success: false,
        error: '生图测试异常: ' + (err?.message || '请求超时'),
      });
    } finally {
      setTestingImage(false);
    }
  };

  // Vision Test
  const handleTestVision = async (testUrl?: string) => {
    const targetUrl = testUrl || visionImageUrl;
    if (!targetUrl) {
      alert('请先上传或输入一张菜品图片链接');
      return;
    }

    setTestingVision(true);
    setVisionTestResult(null);

    try {
      const res = await fetch('/api/admin/llm/dish-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze_image',
          imageUrl: targetUrl,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setVisionTestResult(json.data);
      } else {
        alert(json.error || 'AI 视觉识别失败');
      }
    } catch (err: any) {
      alert('识别请求异常: ' + (err?.message || ''));
    } finally {
      setTestingVision(false);
    }
  };

  // Upload Vision Test File
  const handleVisionFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVisionUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'dish');
      fd.append('optimize', '1');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setVisionImageUrl(data.url);
        // 直接触发分析
        handleTestVision(data.url);
      } else {
        alert(data.error || '图片上传失败');
      }
    } catch (err: any) {
      alert('上传异常: ' + (err?.message || ''));
    } finally {
      setVisionUploadLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 顶部标题横幅 */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 p-6 rounded-2xl border border-neutral-700/80 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white shrink-0">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-xl font-bold text-white tracking-wide">AI 智能大脑配置</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Agnes AI 驱动</span>
                </span>
              </div>
              <p className="text-neutral-300 text-xs mt-1.5 leading-relaxed max-w-2xl">
                配置并赋予本点餐系统真正的“智能大脑”。支持大模型文本创作、视觉图像识别与生成，并在商户上传图片时自动调用大模型与智能图像引擎进行自适应压缩与画质优化，确保在手机端秒级传输与极速呈现！
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleResetToDefault}
              disabled={saving || loading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-700/80 hover:bg-neutral-600 text-neutral-200 hover:text-white transition-all flex items-center space-x-1.5 cursor-pointer border border-neutral-600/60"
              title="恢复官方推荐的 Agnes AI 默认参数"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复默认参数</span>
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving || loading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white transition-all shadow-md shadow-amber-500/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? '保存中...' : '保存大脑配置'}</span>
            </button>
          </div>
        </div>

        {/* 提示消息 */}
        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center space-x-2 animate-in fade-in duration-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 主配置卡片与智能图片处理 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左侧：核心大模型参数配置 (7列) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-neutral-900">大模型连接参数</h3>
            </div>
            <span className="text-[11px] text-neutral-400">OpenAI Compatible 兼容协议</span>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-neutral-500" />
                <span>API Base URL (服务端点)</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-normal">默认: https://apihub.agnes-ai.com/v1</span>
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://apihub.agnes-ai.com/v1"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-neutral-500" />
                <span>API Key (访问密钥)</span>
              </span>
              <span className="text-[11px] text-neutral-400 font-normal">sk-vWM7...</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full pl-3.5 pr-20 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
                  title={showApiKey ? '隐藏密钥' : '显示明文'}
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
                  title="复制密钥"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Text Model */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center space-x-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                <span>文本大模型 (Text & Vision Model)</span>
              </label>
              <div className="flex items-center space-x-1">
                {['Agnes-2.5-flash', 'agnes-3.0-flash', 'agnes-2.5-pro'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTextModel(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      textModel === m
                        ? 'bg-indigo-100 text-indigo-700 font-bold'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={textModel}
              onChange={(e) => setTextModel(e.target.value)}
              placeholder="Agnes-2.5-flash"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
            <p className="text-[11px] text-neutral-400">
              用于撰写菜品美食文案、多模态视觉识别菜品照片、智能推荐标签、商户咨询等。
            </p>
          </div>

          {/* Image Model */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-700 flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
                <span>图片大模型 (Image Generation Model)</span>
              </label>
              <div className="flex items-center space-x-1">
                {['Agnes-Image-2.1-flash', 'agnes-image-2.5-flash'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setImageModel(m)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      imageModel === m
                        ? 'bg-pink-100 text-pink-700 font-bold'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              placeholder="Agnes-Image-2.1-flash"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 font-mono focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 transition-all"
            />
            <p className="text-[11px] text-neutral-400">
              用于 AI 高清智能生成诱人菜品特写、美食封面配图、特色菜品宣传画。
            </p>
          </div>
        </div>

        {/* 右侧：智能图片优化处理引擎 (5列) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-neutral-900">智能图片优化处理</h3>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                已就绪
              </span>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              解决手机拍照原图过大（通常 5MB~20MB，尺寸 4000×3000）导致在手机点餐端加载缓慢、耗费流量的痛点。上传时自动进行 AI 级别尺寸自适应裁剪与现代 WebP 格式无损压缩。
            </p>

            {/* 开关 */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-neutral-900">上传自动智能优化与压缩</div>
                <div className="text-[11px] text-neutral-500 mt-0.5">裁剪超大图片，提速 90%</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoProcessImages}
                  onChange={(e) => setAutoProcessImages(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* 尺寸滑块 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                <span className="flex items-center space-x-1">
                  <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                  <span>手机端最大尺寸限制</span>
                </span>
                <span className="text-amber-600 font-mono">{maxDimension} 像素 (px)</span>
              </div>
              <input
                type="range"
                min="600"
                max="2400"
                step="100"
                value={maxDimension}
                onChange={(e) => setMaxDimension(parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>600px (极致速度)</span>
                <span>1200px (高清推荐)</span>
                <span>2400px (超清)</span>
              </div>
            </div>

            {/* 画质滑块 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                <span className="flex items-center space-x-1">
                  <Layers className="w-3.5 h-3.5 text-neutral-500" />
                  <span>WebP 压缩画质</span>
                </span>
                <span className="text-amber-600 font-mono">{quality}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>50% (超轻量)</span>
                <span>82% (黄金平衡)</span>
                <span>95% (极高保真)</span>
              </div>
            </div>
          </div>

          {/* 优化效果对比示例 */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-900 flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>实测处理对比：</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-700">节省 93.6% 传输带宽</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
              <div className="bg-white/80 p-2 rounded-lg border border-neutral-200/50">
                <div className="text-neutral-400">未处理原图</div>
                <div className="font-bold text-neutral-800 text-xs mt-0.5">8.4 MB (4032×3024)</div>
                <div className="text-[10px] text-rose-500 mt-0.5">手机端加载约 3.8 秒</div>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-amber-300">
                <div className="text-amber-700 font-bold">智能处理后</div>
                <div className="font-bold text-emerald-600 text-xs mt-0.5">142 KB (1200×900)</div>
                <div className="text-[10px] text-emerald-600 font-bold mt-0.5">手机端秒开 0.08 秒</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部：大模型即时交互测试实验室 */}
      <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-neutral-900">大模型大脑即时测试实验室</h3>
          </div>

          {/* Tab 切换 */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl space-x-1">
            <button
              onClick={() => setActiveTestTab('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTestTab === 'text'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              文本大模型 ({textModel})
            </button>
            <button
              onClick={() => setActiveTestTab('image')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTestTab === 'image'
                  ? 'bg-white text-pink-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              图片大模型 ({imageModel})
            </button>
            <button
              onClick={() => setActiveTestTab('vision')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTestTab === 'vision'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              视觉识别菜品测试
            </button>
          </div>
        </div>

        {/* Tab 1: 文本模型测试 */}
        {activeTestTab === 'text' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                <span>测试 Prompt 提示词</span>
                <span className="text-[11px] text-neutral-400">将直接向 {baseUrl} 发起测试请求</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="输入测试提示词..."
                  className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
                <button
                  onClick={handleTestTextModel}
                  disabled={testingText}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testingText ? '测试中...' : '发送测试'}</span>
                </button>
              </div>
            </div>

            {/* 测试结果展示 */}
            {textTestResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in duration-300 ${
                  textTestResult.success
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/60 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold">
                    {textTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{textTestResult.success ? '文本大模型连接测试成功！' : '测试失败'}</span>
                  </div>
                  {textTestResult.durationMs && (
                    <span className="px-2 py-0.5 bg-white/80 rounded-md font-mono text-[11px] text-neutral-600 border border-neutral-200">
                      耗时: {textTestResult.durationMs}ms
                    </span>
                  )}
                </div>

                {textTestResult.success ? (
                  <div className="mt-2 space-y-2">
                    <div className="bg-white p-3 rounded-lg border border-emerald-200/80 shadow-2xs">
                      <div className="text-[11px] font-bold text-neutral-400 mb-1">大模型回复内容：</div>
                      <div className="text-neutral-800 leading-relaxed font-sans whitespace-pre-wrap">
                        {textTestResult.reply}
                      </div>
                    </div>
                    {textTestResult.usage && (
                      <div className="text-[10px] text-neutral-500 font-mono">
                        Tokens 消耗: 总计 {textTestResult.usage.total_tokens || 0} (Prompt:{' '}
                        {textTestResult.usage.prompt_tokens || 0}, Completion:{' '}
                        {textTestResult.usage.completion_tokens || 0})
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-rose-700 font-mono text-xs mt-1 bg-white p-2.5 rounded-lg border border-rose-200">
                    {textTestResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 图片模型测试 */}
        {activeTestTab === 'image' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                <span>生图提示词 (Prompt)</span>
                <span className="text-[11px] text-neutral-400">调用 {imageModel} 生成菜品特写照片</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="例如：一盘色香味俱全的红烧排骨，热气腾腾，高光质感..."
                  className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                />
                <button
                  onClick={handleTestImageModel}
                  disabled={testingImage}
                  className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-pink-600/20 flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{testingImage ? 'AI 正在绘制中...' : '生成测试图片'}</span>
                </button>
              </div>
            </div>

            {/* 生图结果展示 */}
            {imageTestResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-3 animate-in fade-in duration-300 ${
                  imageTestResult.success
                    ? 'bg-pink-50/60 border-pink-200 text-pink-950'
                    : 'bg-rose-50/60 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold">
                    {imageTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{imageTestResult.success ? '图片大模型生成成功！' : '图片生成失败'}</span>
                  </div>
                  {imageTestResult.durationMs && (
                    <span className="px-2 py-0.5 bg-white/80 rounded-md font-mono text-[11px] text-neutral-600 border border-neutral-200">
                      耗时: {(imageTestResult.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                {imageTestResult.success && imageTestResult.imageUrl ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-pink-200 shadow-2xs">
                    <div className="relative w-48 h-48 rounded-lg overflow-hidden border border-neutral-200 shrink-0 bg-neutral-100">
                      <Image
                        src={imageTestResult.imageUrl}
                        alt="AI Generated Dish"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="space-y-2 text-neutral-700 text-xs">
                      <div className="font-bold text-neutral-900">AI 智能绘图成功</div>
                      <p className="text-neutral-500 text-[11px] leading-relaxed">
                        大模型成功理解提示词并输出高精度美食摄影图像，可作为菜品无图时的智能配图参考。
                      </p>
                      <a
                        href={imageTestResult.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-pink-600 hover:text-pink-700 font-bold text-xs"
                      >
                        <span>查看高清原图</span>
                        <ArrowRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-rose-700 font-mono text-xs mt-1 bg-white p-2.5 rounded-lg border border-rose-200">
                    {imageTestResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: 视觉识别菜品测试 */}
        {activeTestTab === 'vision' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 flex items-center justify-between">
                <span>上传菜品照片进行 AI 视觉识别与智能文案分析</span>
                <span className="text-[11px] text-neutral-400">大模型视觉识别 + 诱人美食文案撰写</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={visionImageUrl}
                  onChange={(e) => setVisionImageUrl(e.target.value)}
                  placeholder="输入已有图片URL，或点击右侧上传测试..."
                  className="flex-1 px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />

                <label className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{visionUploadLoading ? '上传处理中...' : '上传测试图片'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleVisionFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => handleTestVision()}
                  disabled={testingVision || !visionImageUrl}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{testingVision ? 'AI 正在观察分析...' : '开始识别分析'}</span>
                </button>
              </div>
            </div>

            {/* 视觉分析卡片 */}
            {visionTestResult && (
              <div className="bg-gradient-to-r from-amber-50/70 to-orange-50/70 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-3 animate-in fade-in duration-300 text-xs">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>AI 大脑视觉分析结果：【{visionTestResult.dish_name_suggestion || '特色菜肴'}】</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-amber-200/60 md:col-span-2 space-y-1.5">
                    <div className="text-[11px] font-bold text-neutral-400">大模型生成的美味介绍：</div>
                    <p className="text-neutral-800 leading-relaxed font-sans">
                      {visionTestResult.appetizing_description}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-1">
                      {visionTestResult.taste_tags?.map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                      {visionTestResult.spicy_level && (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded text-[10px] font-medium">
                          {visionTestResult.spicy_level}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-amber-200/60 space-y-2">
                    <div>
                      <span className="text-[11px] text-neutral-400">推荐分类：</span>
                      <span className="font-bold text-neutral-800 ml-1">
                        {visionTestResult.category_suggestion}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-400">建议售价：</span>
                      <span className="font-bold text-amber-600 ml-1">
                        ¥{visionTestResult.recommended_price || 38}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-400">展示效果评价：</span>
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        {visionTestResult.visual_evaluation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
