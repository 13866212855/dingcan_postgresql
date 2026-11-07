'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Settings,
  QrCode,
  Upload,
  Percent,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  HelpCircle,
  Globe,
  Utensils,
  Truck,
  MapPin,
  Info,
  CreditCard,
  Clock,
  Mail,
  Send,
  Brain,
  ArrowRight,
  Printer,
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Bell,
  Volume2,
  Smartphone,
} from 'lucide-react';
import { AppSettings } from '@/types';

interface SettingsManagementProps {
  tenantId?: string;
}

export default function SettingsManagement({ tenantId = 'default' }: SettingsManagementProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [localPreview, setLocalPreview] = useState('');
  const [pointsRatio, setPointsRatio] = useState(1);
  const [customDomain, setCustomDomain] = useState('');
  // 消费就餐方式配置
  const [enableDineIn, setEnableDineIn] = useState(true);
  const [enableTakeout, setEnableTakeout] = useState(true);
  // 就餐桌号配置
  const [requireTableNo, setRequireTableNo] = useState(true);
  const [tableInputMode, setTableInputMode] = useState<'select' | 'input' | 'both'>('select');
  // 支付付款时机配置 (餐前付款 / 餐后结账)
  const [enablePayBefore, setEnablePayBefore] = useState(true);
  const [enablePayAfter, setEnablePayAfter] = useState(true);

  // 高德地图免费 Web API Key（用于外卖精准定位逆地理转换，每天免费 5000 次）
  const [amapWebKey, setAmapWebKey] = useState('');

  // 在线支付通道（虎皮椒）配置
  const [payMode, setPayMode] = useState<'static' | 'xunhupay'>('static');
  const [xhuAppid, setXhuAppid] = useState('');
  const [xhuSecretInput, setXhuSecretInput] = useState(''); // 留空 = 保留已保存密钥不改动
  const [xhuGateway, setXhuGateway] = useState('https://api.xunhupay.com/payment/do.html');
  const [payNotifyBase, setPayNotifyBase] = useState('');
  const [xhuSecretConfigured, setXhuSecretConfigured] = useState(false);

  // 云打印机对接配置
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false);
  const [printerType, setPrinterType] = useState<'webhook' | 'feie' | 'yilianyun'>('webhook');
  const [printerName, setPrinterName] = useState('');
  const [printerSn, setPrinterSn] = useState('');
  const [printerKey, setPrinterKey] = useState('');
  const [printerWebhookUrl, setPrinterWebhookUrl] = useState('');
  const [printerSecretToken, setPrinterSecretToken] = useState('');
  const [printerCopies, setPrinterCopies] = useState(1);
  const [printerTicketHeader, setPrinterTicketHeader] = useState('');
  const [printerTicketFooter, setPrinterTicketFooter] = useState('');
  const [testPrintLoading, setTestPrintLoading] = useState(false);
  const [testPrintResult, setTestPrintResult] = useState<{ success?: boolean; text?: string } | null>(null);

  // 微信新订单强提醒（PushPlus 推送加 · 0元免费微信消息直推）
  const [pushplusEnabled, setPushplusEnabled] = useState(false);
  const [pushplusToken, setPushplusToken] = useState('');
  const [pushplusTopic, setPushplusTopic] = useState('');
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ success?: boolean; text?: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success?: boolean; text?: string; diagnostics?: any } | null>(null);

  // 邮件通知 (QQ 邮箱 SMTP) 服务配置状态
  const [smtpHost, setSmtpHost] = useState('smtp.qq.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpUser, setSmtpUser] = useState('527194933@qq.com');
  const [smtpPass, setSmtpPass] = useState('rvlehugdnsmccajh');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [notifyEmailTo, setNotifyEmailTo] = useState('527194933@qq.com');
  const [smtpTimeout, setSmtpTimeout] = useState(15);
  const [diagnosingEmail, setDiagnosingEmail] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [showDiagnosticSection, setShowDiagnosticSection] = useState(false);
  const [showOverseasGuide, setShowOverseasGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setQrCodeUrl(data.data.payment_qr_code || '');
          setPointsRatio(data.data.points_ratio ?? 1);
          setCustomDomain(data.data.custom_domain || '');
          setEnableDineIn(data.data.enable_dine_in !== 0);
          setEnableTakeout(data.data.enable_takeout !== 0);
          setRequireTableNo(data.data.require_table_no !== 0);
          if (data.data.table_input_mode) {
            setTableInputMode(data.data.table_input_mode);
          }
          setEnablePayBefore(data.data.enable_pay_before !== 0);
          setEnablePayAfter(data.data.enable_pay_after !== 0);
          if (data.data.amap_web_key) setAmapWebKey(data.data.amap_web_key);
          // 在线支付通道配置加载（密钥不回显，仅显示是否已配置）
          setPayMode(data.data.pay_mode === 'xunhupay' ? 'xunhupay' : 'static');
          setXhuAppid(data.data.xhu_appid || '');
          setXhuGateway(data.data.xhu_gateway || 'https://api.xunhupay.com/payment/do.html');
          setPayNotifyBase(data.data.pay_notify_base || '');
          setXhuSecretConfigured(data.data.xhu_secret_configured === 1);
          setXhuSecretInput('');
          // 打印配置加载
          setAutoPrintEnabled(data.data.auto_print_enabled === 1);
          if (data.data.printer_type) setPrinterType(data.data.printer_type);
          setPrinterName(data.data.printer_name || '');
          setPrinterSn(data.data.printer_sn || '');
          setPrinterKey(data.data.printer_key || '');
          setPrinterWebhookUrl(data.data.printer_webhook_url || '');
          setPrinterSecretToken(data.data.printer_secret_token || '');
          setPrinterCopies(data.data.printer_copies ?? 1);
          setPrinterTicketHeader(data.data.printer_ticket_header || '');
          setPrinterTicketFooter(data.data.printer_ticket_footer ?? '谢谢惠顾，欢迎再次光临！');
          // SMTP 邮件配置加载
          if (data.data.smtp_host) setSmtpHost(data.data.smtp_host);
          if (data.data.smtp_port) setSmtpPort(Number(data.data.smtp_port) || 465);
          if (data.data.smtp_secure !== undefined) setSmtpSecure(data.data.smtp_secure === 1);
          if (data.data.smtp_user) setSmtpUser(data.data.smtp_user);
          if (data.data.smtp_pass) setSmtpPass(data.data.smtp_pass);
          if (data.data.notify_email_to) setNotifyEmailTo(data.data.notify_email_to);
          if (data.data.smtp_timeout) setSmtpTimeout(Number(data.data.smtp_timeout) || 15);
          // 微信新订单强提醒 (PushPlus) 配置加载
          setPushplusEnabled(data.data.pushplus_enabled === 1);
          setPushplusToken(data.data.pushplus_token || '');
          setPushplusTopic(data.data.pushplus_topic || '');
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [tenantId]);

  const uploadFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('请选择有效的图片文件（JPG/PNG/WEBP）');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setImageLoadError(false);

    // Immediate local visual preview
    try {
      const objUrl = URL.createObjectURL(file);
      setLocalPreview(objUrl);
    } catch {
      // ignore
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'qr');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setQrCodeUrl(data.url);
        setSuccessMsg('收款码图片已成功上传并生成链接，请点击下方「保存全部配置」！');
      } else {
        setErrorMsg(data.error || '上传图片失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接异常');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          uploadFile(file);
          break;
        }
      }
    }
  };

  const handleClearQrCode = () => {
    setQrCodeUrl('');
    setLocalPreview('');
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTestPrint = async () => {
    setTestPrintLoading(true);
    setTestPrintResult(null);
    try {
      const res = await fetch(`/api/printer/test?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customSettings: {
            printer_type: printerType,
            printer_name: printerName.trim(),
            printer_sn: printerSn.trim(),
            printer_key: printerKey.trim(),
            printer_webhook_url: printerWebhookUrl.trim(),
            printer_secret_token: printerSecretToken.trim(),
            printer_copies: printerCopies,
            printer_ticket_header: printerTicketHeader.trim(),
            printer_ticket_footer: printerTicketFooter.trim(),
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestPrintResult({
          success: true,
          text: `✔ ${data.message || '测试小票指令已成功推送至云打印机/接口！'}`,
        });
      } else {
        setTestPrintResult({
          success: false,
          text: '❌ 打印推送失败：' + (data.error || '请检查打印机设备ID、API密钥或网络'),
        });
      }
    } catch (e: any) {
      setTestPrintResult({
        success: false,
        text: '❌ 打印异常：' + (e.message || '网络连接超时'),
      });
    } finally {
      setTestPrintLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const res = await fetch(`/api/email/test?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          toEmail: notifyEmailTo.trim() || '527194933@qq.com',
          customConfig: {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 465,
            secure: smtpSecure,
            user: smtpUser.trim(),
            pass: smtpPass.trim(),
            timeout: Number(smtpTimeout) || 15,
            notifyTo: notifyEmailTo.trim(),
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailResult({
          success: true,
          text: `✔ 测试邮件已成功送达至 ${notifyEmailTo.trim() || '527194933@qq.com'}（Message ID: ${data.messageId || 'ok'}），请打开邮箱查收！`,
        });
      } else {
        setTestEmailResult({
          success: false,
          text: '❌ 发送失败：' + (data.error || '未知原因'),
          diagnostics: data.diagnostics,
        });
      }
    } catch (e: any) {
      setTestEmailResult({
        success: false,
        text: '❌ 发送异常：' + (e.message || '网络连接超时'),
      });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleDiagnoseEmail = async () => {
    setDiagnosingEmail(true);
    setDiagnosticReport(null);
    setShowDiagnosticSection(true);
    try {
      const res = await fetch(`/api/email/test?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'diagnose',
          customConfig: {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 465,
            secure: smtpSecure,
            user: smtpUser.trim(),
            pass: smtpPass.trim(),
            timeout: Number(smtpTimeout) || 15,
            notifyTo: notifyEmailTo.trim(),
          },
        }),
      });
      const data = await res.json();
      if (data.data) {
        setDiagnosticReport(data.data);
      } else {
        setDiagnosticReport({
          overallStatus: 'failed',
          summary: data.error || '体检诊断服务接口调用失败',
          steps: [],
          recommendations: ['请检查网络连接或稍后重试'],
        });
      }
    } catch (e: any) {
      setDiagnosticReport({
        overallStatus: 'failed',
        summary: e.message || '网络请求超时',
        steps: [],
        recommendations: ['无法连通诊断服务，请检查网络'],
      });
    } finally {
      setDiagnosingEmail(false);
    }
  };

  const handleTestPushPlus = async () => {
    if (!pushplusToken.trim()) {
      setTestPushResult({ success: false, text: '❌ 请先在下方输入您的 PushPlus Token' });
      return;
    }
    setTestPushLoading(true);
    setTestPushResult(null);
    try {
      const res = await fetch('/api/settings/test-pushplus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: pushplusToken.trim(),
          topic: pushplusTopic.trim(),
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestPushResult({
          success: true,
          text: `✔ ${data.message || '测试消息已成功发送至您的微信，请留意手机是否有微信提示音！'}`,
        });
      } else {
        setTestPushResult({
          success: false,
          text: `❌ 发送失败：${data.error || '请检查 Token 是否有效'}`,
        });
      }
    } catch (e: any) {
      setTestPushResult({
        success: false,
        text: `❌ 发送异常：${e.message || '网络连接超时'}`,
      });
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/settings?tenant=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_qr_code: qrCodeUrl.trim(),
          points_ratio: Number(pointsRatio) || 1,
          custom_domain: customDomain.trim(),
          enable_dine_in: enableDineIn ? 1 : 0,
          enable_takeout: enableTakeout ? 1 : 0,
          require_table_no: requireTableNo ? 1 : 0,
          table_input_mode: tableInputMode,
          enable_pay_before: enablePayBefore ? 1 : 0,
          enable_pay_after: enablePayAfter ? 1 : 0,
          amap_web_key: amapWebKey.trim(),
          pay_mode: payMode,
          xhu_appid: xhuAppid.trim(),
          ...(xhuSecretInput.trim() !== '' ? { xhu_secret: xhuSecretInput.trim() } : {}),
          xhu_gateway: xhuGateway.trim(),
          pay_notify_base: payNotifyBase.trim(),
          auto_print_enabled: autoPrintEnabled ? 1 : 0,
          printer_type: printerType,
          printer_name: printerName.trim(),
          printer_sn: printerSn.trim(),
          printer_key: printerKey.trim(),
          printer_webhook_url: printerWebhookUrl.trim(),
          printer_secret_token: printerSecretToken.trim(),
          printer_copies: printerCopies,
          printer_ticket_header: printerTicketHeader.trim(),
          printer_ticket_footer: printerTicketFooter.trim(),
          smtp_host: smtpHost.trim(),
          smtp_port: Number(smtpPort) || 465,
          smtp_secure: smtpSecure ? 1 : 0,
          smtp_user: smtpUser.trim(),
          smtp_pass: smtpPass.trim(),
          notify_email_to: notifyEmailTo.trim(),
          smtp_timeout: Number(smtpTimeout) || 15,
          pushplus_enabled: pushplusEnabled ? 1 : 0,
          pushplus_token: pushplusToken.trim(),
          pushplus_topic: pushplusTopic.trim(),
          tenantId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('系统运营就餐方式、桌号规则、支付付款时机、收款码与积分配置已成功保存并立即生效！');
      } else {
        setErrorMsg(data.error || '保存失败');
      }
    } catch (err: any) {
      setErrorMsg(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const displayImage = localPreview || qrCodeUrl;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <h2 className="text-base font-bold text-neutral-900 flex items-center space-x-2">
          <Settings className="w-5 h-5 text-amber-600" />
          <span>运营就餐方式、桌号规则与收款配置</span>
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          配置前端就餐方式（到店堂食 / 送餐到家）、就餐桌号必填与录入模式，以及收款码与会员积分
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. 消费就餐方式配置 (堂食 / 外卖 复选框) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Utensils className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">消费就餐方式配置</h3>
            </div>
            <span className="text-xs text-neutral-400">支持自由勾选与组合控制</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            配置前端顾客结账下单时支持的就餐方式。可只选一个、两个都选或都不选：
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* 堂食复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enableDineIn
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-dine-in"
                type="checkbox"
                checked={enableDineIn}
                onChange={(e) => setEnableDineIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Utensils className="w-3.5 h-3.5 text-amber-600" />
                  <span>到店堂食</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在餐厅店内就餐，支持选桌入座、扫码直达桌号点餐。
                </p>
              </div>
            </label>

            {/* 外卖送餐复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enableTakeout
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-takeout"
                type="checkbox"
                checked={enableTakeout}
                onChange={(e) => setEnableTakeout(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Truck className="w-3.5 h-3.5 text-amber-600" />
                  <span>送餐到家 (外卖)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在线下单并填写送达地址与联系电话，由门店骑手配送。
                </p>
              </div>
            </label>
          </div>

          {/* 交互规则状态实时反馈提示条 */}
          <div className="p-3.5 rounded-xl border bg-neutral-50/80 border-neutral-200/80 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <Info className="w-4 h-4 text-amber-600" />
              <span>前端生效表现预览：</span>
            </div>
            {enableDineIn && enableTakeout && (
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                ★ <strong>堂食与外卖均已勾选激活</strong>：前端结算界面将展示<strong>【到店堂食】与【送餐到家 (外卖)】</strong>选择按钮，供顾客自主切换。
              </p>
            )}
            {enableDineIn && !enableTakeout && (
              <p className="text-[11px] text-blue-700 leading-relaxed">
                ★ <strong>仅激活【到店堂食】</strong>：前端结算界面<strong>不显示切换按钮</strong>，顾客默认且仅能以<strong>到店堂食</strong>方式下单。
              </p>
            )}
            {!enableDineIn && enableTakeout && (
              <p className="text-[11px] text-purple-700 leading-relaxed">
                ★ <strong>仅激活【送餐到家 (外卖)】</strong>：前端结算界面<strong>不显示切换按钮</strong>，顾客默认且仅能以<strong>送餐到家 (外卖)</strong>方式下单。
              </p>
            )}
            {!enableDineIn && !enableTakeout && (
              <p className="text-[11px] text-amber-700 leading-relaxed">
                ★ <strong>两项均未勾选</strong>：系统安全兜底机制生效，前端<strong>不显示切换按钮</strong>，自动默认按<strong>【到店堂食】</strong>模式处理。
              </p>
            )}
          </div>

          {/* 高德地图 Web 服务 API Key 配置（可选免费额度升级） */}
          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>外卖智能定位逆地理转换（可选高精度增强 Key）</span>
              </label>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                默认免配置即用（自带双重免费定位解析）
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              外卖顾客下单时支持一键自动定位。系统默认自带免签公共逆地理服务；若您希望达到国内最高精度（精确至小区与门牌号），可在此填入您的高德地图开放平台 <strong>Web 服务类型的 Key</strong>（个人开发者可免费申请，<strong>每天 5,000 次免费调用额度</strong>，单店终身免费）。
            </p>
            <div className="relative">
              <input
                type="text"
                value={amapWebKey}
                onChange={(e) => setAmapWebKey(e.target.value)}
                placeholder="留空即使用系统内置免签定位；亦可填入高德 Web 服务 Key (如: 32位十六进制字符串)"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* 2. 就餐桌号运营配置 */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">就餐桌号规则配置</h3>
            </div>
            <span className="text-xs text-neutral-400">堂食选桌与录入方式</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            设置堂食点餐时对餐桌号的要求与录入交互方式：
          </p>

          <div className="space-y-3 pt-1">
            {/* 桌号必填开关 */}
            <label className="flex items-start space-x-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-100/60 transition-colors">
              <input
                id="checkbox-require-table-no"
                type="checkbox"
                checked={requireTableNo}
                onChange={(e) => setRequireTableNo(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-neutral-900">
                  堂食点餐必须选择或输入就餐桌号
                </span>
                <p className="text-[11px] text-neutral-500">
                  开启后，堂食结算窗口展示桌号选择框并必须指定桌号；若关闭，前端结算窗口彻底去掉桌号区块（极致精简），订单自动归为“自取/未指定桌位”。
                </p>
              </div>
            </label>

            {/* 桌号录入模式 */}
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
              <label className="block text-xs font-bold text-neutral-800">
                前端桌号提供方式
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'select' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="select"
                    checked={tableInputMode === 'select'}
                    onChange={() => setTableInputMode('select')}
                    className="sr-only"
                  />
                  <span>仅下拉选择店内桌号</span>
                </label>
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'input' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="input"
                    checked={tableInputMode === 'input'}
                    onChange={() => setTableInputMode('input')}
                    className="sr-only"
                  />
                  <span>允许手动填写任意桌号</span>
                </label>
                <label className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center space-x-2 ${tableInputMode === 'both' ? 'bg-amber-500 text-white border-amber-500 font-bold' : 'bg-white text-neutral-700 border-neutral-200'}`}>
                  <input
                    type="radio"
                    name="tableInputMode"
                    value="both"
                    checked={tableInputMode === 'both'}
                    onChange={() => setTableInputMode('both')}
                    className="sr-only"
                  />
                  <span>双模式 (下拉或手输)</span>
                </label>
              </div>
              <p className="text-[11px] text-neutral-500">
                提示：若开启了扫码桌贴，通过微信/相机扫桌上二维码打开的用户将直接自动锁定该桌号，无需顾客手动挑选。
              </p>
            </div>
          </div>
        </div>

        {/* 3. 支付付款时机配置 (餐前付款 / 餐后结账 复选框) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">支付付款时机配置</h3>
            </div>
            <span className="text-xs text-neutral-400">立付与先吃后付控制</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            配置前端顾客结账下单时允许的付款时机。可勾选餐前、餐后或两者兼备：
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* 餐前付款复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enablePayBefore
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-pay-before"
                type="checkbox"
                checked={enablePayBefore}
                onChange={(e) => setEnablePayBefore(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                  <span>餐前付款 (立付)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客在提交订单时立即扫码支付，资金先到账再制作出餐（快餐、外卖等常用）。
                </p>
              </div>
            </label>

            {/* 餐后结账复选框 */}
            <label
              className={`flex items-start space-x-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                enablePayAfter
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/60'
              }`}
            >
              <input
                id="checkbox-enable-pay-after"
                type="checkbox"
                checked={enablePayAfter}
                onChange={(e) => setEnablePayAfter(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-amber-600 rounded-md border-neutral-300 focus:ring-amber-500 cursor-pointer"
              />
              <div className="space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-xs text-neutral-900">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>餐后结账 (先吃后付)</span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  顾客先下单厨房立即出单烹饪，吃完离店前再到前台或线上扫码结算（正餐酒楼常用）。
                </p>
              </div>
            </label>
          </div>

          {/* 前端联动表现反馈提示条 */}
          <div className="p-3.5 rounded-xl border bg-neutral-50/80 border-neutral-200/80 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <Info className="w-4 h-4 text-amber-600" />
              <span>前端生效表现预览：</span>
            </div>
            {enablePayBefore && enablePayAfter && (
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                ★ <strong>餐前与餐后均已勾选激活</strong>：堂食结算时将展示<strong>【餐前付款 (立付)】与【餐后结账 (先吃后付)】</strong>选择按钮，供顾客自主选择。
              </p>
            )}
            {enablePayBefore && !enablePayAfter && (
              <p className="text-[11px] text-blue-700 leading-relaxed">
                ★ <strong>仅激活【餐前付款】</strong>：前端结算界面<strong>彻底隐藏该区块</strong>，界面极致精简，系统默认且仅支持<strong>餐前付款</strong>。
              </p>
            )}
            {!enablePayBefore && enablePayAfter && (
              <p className="text-[11px] text-purple-700 leading-relaxed">
                ★ <strong>仅激活【餐后结账】</strong>：前端结算界面<strong>彻底隐藏该区块</strong>，界面极致精简，系统默认且仅支持<strong>餐后结账</strong>。
              </p>
            )}
            {!enablePayBefore && !enablePayAfter && (
              <p className="text-[11px] text-amber-700 leading-relaxed">
                ★ <strong>两项均未勾选</strong>：系统安全兜底机制生效，前端结算界面<strong>彻底隐藏该区块</strong>，系统自动默认采用<strong>【餐前付款】</strong>。
              </p>
            )}
          </div>
        </div>

        {/* 4. Payment QR Code Section */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-neutral-700" />
              <h3 className="text-sm font-bold text-neutral-900">饭店收款二维码 (餐前结账与线上支付)</h3>
            </div>
            <span className="text-xs text-neutral-400">支持微信/支付宝/聚合收款码</span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            顾客选择“餐前付款”或外卖送餐结账时，系统弹窗将展示此收款码，顾客扫码支付完成后即可完成下单。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start pt-2">
            {/* QR Preview Box with Drag-and-Drop */}
            <div className="md:col-span-1 flex flex-col items-center">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={`w-52 h-52 rounded-2xl border-2 border-dashed transition-all bg-neutral-50 flex items-center justify-center relative overflow-hidden shadow-inner cursor-pointer group focus:ring-2 focus:ring-amber-500 focus:outline-hidden ${
                  isDragOver
                    ? 'border-amber-500 bg-amber-50/50 scale-102'
                    : 'border-neutral-300 hover:border-amber-400'
                }`}
                onClick={() => fileInputRef.current?.click()}
                title="点击选择图片，或将图片拖拽至此处"
              >
                {displayImage && !imageLoadError ? (
                  <div className="relative w-full h-full">
                    <Image
                      src={displayImage}
                      alt="饭店收款码"
                      fill
                      unoptimized
                      className="object-contain p-2"
                      referrerPolicy="no-referrer"
                      onError={() => setImageLoadError(true)}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold space-y-1 backdrop-blur-2xs">
                      <Upload className="w-5 h-5" />
                      <span>点击更换图片</span>
                      <span className="text-[10px] text-neutral-200">支持拖拽/黏贴</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 text-neutral-400 space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 group-hover:text-amber-600 group-hover:bg-amber-50 transition-colors">
                      <QrCode className="w-6 h-6" />
                    </div>
                    {imageLoadError ? (
                      <div className="text-rose-500 text-xs">
                        <span>图片加载异常</span>
                        <div className="text-[10px] text-neutral-400 mt-0.5">点击重新上传</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-bold text-neutral-600 group-hover:text-amber-600 transition-colors">
                          点击或拖拽上传收款码
                        </div>
                        <p className="text-[10px] text-neutral-400">支持微信/支付宝/聚合码</p>
                      </>
                    )}
                  </div>
                )}

                {uploading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-amber-600 text-xs font-bold space-y-2">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>图片上传中...</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 mt-2">
                前台收银效果预览 (点击或拖拽图片可更换)
              </span>
            </div>

            {/* Upload & URL Input */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  本地图片上传
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 disabled:opacity-60 shadow-2xs cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-amber-600" />
                    <span>{uploading ? '正在上传图片...' : '选择收款码图片文件并上传'}</span>
                  </button>
                  <span className="text-[11px] text-neutral-400">
                    支持 PNG/JPG/WEBP，也可以直接拖拽或截图按 Ctrl+V 黏贴
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  收款码图片路径或网络链接：
                </label>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={qrCodeUrl}
                    onChange={(e) => {
                      setQrCodeUrl(e.target.value);
                      setImageLoadError(false);
                    }}
                    placeholder="可自动由上方上传生成，或填入 /uploads/... 或 https://..."
                    className="w-full px-3.5 py-2.5 text-xs bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                  <p className="text-[11px] text-neutral-400">
                    注：上传成功后此处自动显示为相对路径，请点击下方「保存全部配置」完成持久化保存。
                  </p>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClearQrCode}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline flex items-center space-x-1"
                  >
                    <span>清除当前收款码</span>
                  </button>
                  {displayImage && (
                    <a
                      href={displayImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:underline"
                    >
                      在新标签页查看大图 ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Points System Setting */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Percent className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-neutral-900">积分比例与返现规则</h3>
            </div>
            <span className="text-xs bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              1 积分 = 1 元现金
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              每笔消费赠送积分比例 (%)
            </label>
            <div className="flex items-center space-x-3 max-w-xs">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={pointsRatio}
                  onChange={(e) => setPointsRatio(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 pr-8"
                />
                <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-bold">%</span>
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>当前规则测算示例：</span>
            </div>
            <p className="text-neutral-600 leading-relaxed">
              • 顾客实付结账 <strong>100 元</strong> 时，将自动获得 <strong>{(100 * (pointsRatio / 100)).toFixed(2)}</strong> 积分。<br />
              • 下次结账时勾选“使用积分抵扣”，<strong>1 积分可直接抵扣 1 元现金</strong>。<br />
              • 积分与用户实名手机号唯一绑定，更换手机扫码也可凭借实名认证找回积分。
            </p>
          </div>
        </div>

        {/* Table QR Code Access Domain (WeChat compatibility & Custom Domain) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-neutral-900">扫码点餐桌贴域名配置 (解决微信打不开问题)</h3>
            </div>
            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
              微信扫码优化
            </span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            用于生成各餐桌专属点餐二维码（桌贴）的根网址。留空时默认使用当前网页所在的运行地址。
          </p>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              自定义外部访问根地址 (支持已备案独立域名、公网IP或中转地址)
            </label>
            <input
              type="text"
              placeholder="例如：https://order.yourrestaurant.com 或 http://192.168.1.100:3000"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-neutral-400 mt-1">
              填写后，后台【餐桌管理】生成的所有桌贴二维码及点餐链接将自动切换为该域名。
            </p>
          </div>

          {/* WeChat Interception Explanation Box */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs text-neutral-600 space-y-2.5">
            <div className="flex items-center space-x-1.5 font-bold text-neutral-800">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>为什么微信扫一扫打不开当前的 run.app 链接？</span>
            </div>
            <div className="space-y-1.5 text-[11px] leading-relaxed text-neutral-600">
              <p>
                <strong>1. 微信内置安全风控拦截</strong>：微信对海外公有云子域名（如 <code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded">*.run.app</code>、<code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded">*.vercel.app</code> 等）实行严格拦截策略，判定为非白名单外链，微信内置浏览器通常直接阻止访问或报“已停止访问该网页”。
              </p>
              <p>
                <strong>2. 境外服务器网络连接限制</strong>：<code className="text-neutral-800 bg-neutral-100 px-1 py-0.5 rounded">run.app</code> 属于 Google Cloud 境外节点，国内移动网络无法直接直连；电脑浏览器能打开通常是因为电脑处于代理或特定网络环境下。
              </p>
              <p>
                <strong>3. 顺畅在微信中使用的建议方案</strong>：
                <br />
                • <strong>方案 A（最推荐·正规商用）</strong>：使用在国内云厂商（腾讯云/阿里云等）购买并已<strong>ICP备案</strong>的自有域名（如 <code className="text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">order.yourcanteen.com</code>），指向您的服务器，并在此处配置该域名。
                <br />
                • <strong>方案 B（快捷局域网/过渡测试）</strong>：使用内网穿透（如 cpolar/Sunny-Ngrok）生成的国内合规中转域名，填入此处生成专属桌贴码。
              </p>
            </div>
          </div>
        </div>

        {/* Online Pay Channel (XunhuPay) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-neutral-900">在线支付通道（虎皮椒 · 动态收款自动确认）</h3>
                <p className="text-[11px] text-neutral-400">
                  每单自动生成带金额的动态二维码/跳转链接，支付成功回调自动确认到账，顾客无需手动声明【已支付】
                </p>
              </div>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center space-x-1">
              <span className={`w-1.5 h-1.5 rounded-full ${payMode === 'xunhupay' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`}></span>
              <span>{payMode === 'xunhupay' ? '动态支付' : '静态收款码'}</span>
            </span>
          </div>

          {/* 模式切换 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPayMode('static')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                payMode === 'static'
                  ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500/30'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <div className="text-xs font-bold text-neutral-900 flex items-center space-x-1.5">
                <QrCode className="w-4 h-4 text-amber-600" />
                <span>静态收款码模式（默认）</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                展示店内统一收款码，顾客付款后经【长按识别+返回页面+延迟】三重门禁自助确认。
                积分权益即时兑现：立减金额在 0.01 元 ~ 积分比例金额之间随机，例如比例 1% 时 18 元实付在 17.82 ~ 17.99 元间随机——每单尾数不同，方便按金额对账（该单不再另送积分）。
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPayMode('xunhupay')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                payMode === 'xunhupay'
                  ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <div className="text-xs font-bold text-neutral-900 flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>动态在线支付（虎皮椒）</span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                金额自动带上、回调自动确认到账，彻底杜绝谎报【已支付】。需下方三要素配置完整后生效。
              </p>
            </button>
          </div>

          {payMode === 'xunhupay' && (
            <div className="p-4 bg-neutral-50/70 border border-neutral-200 rounded-xl space-y-4">
              <div className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>虎皮椒商户凭据（本店独立配置，各分店互不影响）</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700">
                    APPID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={xhuAppid}
                    onChange={(e) => setXhuAppid(e.target.value)}
                    placeholder="虎皮椒商户后台「支付渠道管理」中获取"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-neutral-400">注册 admin.xunhupay.com → 支付渠道管理 → 复制 APPID（注意不要带空格）</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700">
                    APPSECRET 密钥{' '}
                    {xhuSecretConfigured ? (
                      <span className="text-emerald-600 font-normal">（已配置 ✓ 输入新值可覆盖）</span>
                    ) : (
                      <span className="text-rose-500">*</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={xhuSecretInput}
                    onChange={(e) => setXhuSecretInput(e.target.value)}
                    placeholder={xhuSecretConfigured ? '留空 = 保留已保存的密钥' : '虎皮椒商户后台获取，复制时不要带空格'}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-neutral-400">密钥仅保存在服务端数据库，不会下发到顾客浏览器</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700">支付网关</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setXhuGateway('https://api.xunhupay.com/payment/do.html')}
                      className={`px-3 py-2 text-[11px] rounded-xl border text-left transition-all cursor-pointer ${
                        xhuGateway === 'https://api.xunhupay.com/payment/do.html'
                          ? 'border-amber-500 bg-amber-50/60 font-bold ring-1 ring-amber-500/30'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      正式平台：api.xunhupay.com（默认）
                    </button>
                    <button
                      type="button"
                      onClick={() => setXhuGateway('https://api.dpweixin.com/payment/do.html')}
                      className={`px-3 py-2 text-[11px] rounded-xl border text-left transition-all cursor-pointer ${
                        xhuGateway === 'https://api.dpweixin.com/payment/do.html'
                          ? 'border-amber-500 bg-amber-50/60 font-bold ring-1 ring-amber-500/30'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      备用平台：api.dpweixin.com（正式平台维护时切换）
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700">
                    支付回调公网基址 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={payNotifyBase}
                    onChange={(e) => setPayNotifyBase(e.target.value)}
                    placeholder="例如：https://your-app.onrender.com（不带 /api/pay/notify）"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    虎皮椒支付成功后回调 <code className="bg-neutral-100 px-1 rounded">该地址 + /api/pay/notify</code>。必须是公网可访问域名：
                    Render 部署填公网域名；本机 Docker 版需配合 cpolar 内网穿透域名（隧道域名变更后记得同步更新）。
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-[11px] text-amber-900 leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>启用须知</span>
                </p>
                <p>① 三要素（APPID + 密钥 + 回调基址）配置完整并保存后，顾客端才会切换到动态支付，否则自动按静态收款码收款，不影响营业。</p>
                <p>② 费率以虎皮椒签约页为准（个人通道约 1%~2.5%）；资金最终进入您绑定的个人微信/支付宝账户。</p>
                <p>③ 虎皮椒平台维护期间若下单失败，系统自动回退静态收款码模式，顾客仍可正常付款（由店员核对到账）。</p>
                <p>④ 建议首次启用后，用 0.01 元真实支付走一遍全流程验证回调到账。</p>
              </div>
            </div>
          )}
        </div>

        {/* 微信新订单强提醒（PushPlus 推送加 · 0元免费微信直推） */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/80">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-neutral-900">新订单微信强提醒（后台 / 锁屏听声接单 · 0元免费）</h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    免开服务号 · 零成本
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  顾客下单即刻向接单员微信推送模版消息。接单员在看视频、聊微信或手机锁屏放口袋，微信都会清脆叮咚响铃并弹出带地址订单横幅！
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pushplusEnabled}
                onChange={(e) => setPushplusEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {pushplusEnabled && (
            <div className="pt-2 border-t border-neutral-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Token 输入框 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700 flex items-center justify-between">
                    <span>
                      PushPlus 个人 Token <span className="text-rose-500">*</span>
                    </span>
                    <a
                      href="https://www.pushplus.plus"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 underline font-normal"
                    >
                      点击打开 PushPlus 官网扫码获取 Token ↗
                    </a>
                  </label>
                  <input
                    type="text"
                    value={pushplusToken}
                    onChange={(e) => setPushplusToken(e.target.value)}
                    placeholder="例如：a1b2c3d4e5f6g7h8i9j0..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-neutral-400">
                    接单员微信扫码即可一秒拿到，每天数千次免费推送额度，完全满足日常接单需求。
                  </p>
                </div>

                {/* 群组编码（可选） */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-700 flex items-center justify-between">
                    <span>群组编码 Topic（可选，多人同时接单）</span>
                    <span className="text-[10px] text-neutral-400 font-normal">留空即单人接收</span>
                  </label>
                  <input
                    type="text"
                    value={pushplusTopic}
                    onChange={(e) => setPushplusTopic(e.target.value)}
                    placeholder="例如：canteen_order_team"
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <p className="text-[10px] text-neutral-400">
                    如需前台、后厨等多位接单员手机微信同时响铃，可在 PushPlus 创建群组并填入群组编码。
                  </p>
                </div>
              </div>

              {/* 测试按钮与测试结果反馈 */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                <div className="flex items-center space-x-2 text-xs text-neutral-600">
                  <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>配置完成后，可立即点击右侧按钮测试手机微信是否会发出清脆提示音与弹窗：</span>
                </div>

                <button
                  type="button"
                  disabled={testPushLoading}
                  onClick={handleTestPushPlus}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer shrink-0 flex items-center space-x-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{testPushLoading ? '正在发送微信测试消息...' : '测试发送一条微信消息 (听声音)'}</span>
                </button>
              </div>

              {testPushResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    testPushResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {testPushResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{testPushResult.text}</span>
                </div>
              )}

              {/* 30 秒配置指南 */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 text-[11px] text-emerald-950 space-y-2 leading-relaxed">
                <p className="font-bold text-xs text-emerald-900 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>📖 30 秒免费获取 PushPlus Token 超简单步骤：</span>
                </p>
                <div className="space-y-1 text-neutral-700 pl-1">
                  <p>
                    <strong>第 1 步：</strong>用电脑或手机浏览器打开官网：
                    <a
                      href="https://www.pushplus.plus"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 font-bold underline ml-1"
                    >
                      www.pushplus.plus
                    </a>；
                  </p>
                  <p>
                    <strong>第 2 步：</strong>在右上角点击【微信扫码登录】，用接单员的个人微信扫一扫即可登录（无需注册密码，0费用）；
                  </p>
                  <p>
                    <strong>第 3 步：</strong>登录后在首页或【一对一推送】页面，找到并复制您的<strong>【Token】</strong>，粘贴到上方输入框；
                  </p>
                  <p>
                    <strong>第 4 步：</strong>点击【测试发送一条微信消息】，您的微信立刻就会收到测试通知！确认手机微信响起提示音后，点击本页底部【保存全部配置】即可！
                  </p>
                </div>
                <p className="text-emerald-800 text-[10px] pt-1 border-t border-emerald-200/60">
                  💡 <strong>贴心优势</strong>：哪怕接单员手机锁屏放在围裙口袋里、或者正在全屏刷短视频/玩游戏，有新订单时微信都会立即发出标准提示音并在顶部弹出带顾客姓名、电话和地址的订单横幅，点击直接秒进后台接单！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Email Notification Service (QQ Mail SMTP) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-neutral-900">邮件实时服务通知（QQ 邮箱 SMTP）</h3>
                <p className="text-[11px] text-neutral-400">客户完成扫码支付或新单提醒时，自动发送订单客户详单至指定邮箱</p>
              </div>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>服务集成</span>
            </span>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            当顾客在手机端扫码结账并点击<strong>【我已完成扫码支付】</strong>时，系统会自动向预设邮箱发送一份完整的订单客户详单（包含桌号/外卖地址、菜品清单、口味要求、实付金额与付款时间戳）。
          </p>

          {/* SMTP 服务器与端口设置 */}
          <div className="p-4 bg-neutral-50/70 border border-neutral-200 rounded-xl space-y-4">
            <div className="text-xs font-bold text-neutral-800 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>SMTP 发信服务与安全配置</span>
              </span>
              <span className="text-[11px] font-normal text-neutral-400">
                支持直接在后台修改或通过环境变量配置
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 发信服务器 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  SMTP 发信服务器主机
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.qq.com"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-neutral-400">QQ 邮箱默认发信服务器为 smtp.qq.com</p>
              </div>

              {/* 端口与加密方式切换 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  发信端口与加密通道
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpPort(465);
                      setSmtpSecure(true);
                    }}
                    className={`px-3 py-2 text-xs rounded-xl border text-left transition-all cursor-pointer ${
                      smtpPort === 465 && smtpSecure
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold ring-1 ring-emerald-500/30'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <div>465 (SSL 强加密)</div>
                    <div className="text-[10px] text-neutral-400 font-normal mt-0.5">常规与境内推荐</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSmtpPort(587);
                      setSmtpSecure(false);
                    }}
                    className={`px-3 py-2 text-xs rounded-xl border text-left transition-all cursor-pointer ${
                      smtpPort === 587 && !smtpSecure
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-950 font-bold ring-1 ring-emerald-500/30'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600'
                    }`}
                  >
                    <div>587 (STARTTLS)</div>
                    <div className="text-[10px] text-neutral-400 font-normal mt-0.5">Render/海外云推荐</div>
                  </button>
                </div>
              </div>

              {/* 发件 QQ 邮箱账号 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  发件人 QQ 邮箱账号 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value.trim())}
                  placeholder="527194933@qq.com"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-neutral-400">用于作为发件方登录并派发订单邮件</p>
              </div>

              {/* QQ 邮箱 16 位 SMTP 独立授权码 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-700">
                    QQ 邮箱 16位 SMTP 独立授权码 <span className="text-rose-500">*</span>
                  </label>
                  {smtpPass ? (
                    /^[a-z]{16}$/i.test(smtpPass) ? (
                      <span className="text-[10px] text-emerald-600 font-medium">✔ 16位有效格式</span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-medium">⚠ 非16位纯英文字母</span>
                    )
                  ) : (
                    <span className="text-[10px] text-rose-500 font-medium">必填</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value.trim())}
                    placeholder="例如: rvlehugdnsmccajh"
                    className="w-full pl-3.5 pr-10 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer"
                  >
                    {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400">
                  注意：切勿使用 QQ 登录密码！需在 QQ 邮箱网页端【设置-账户】中生成的 16 位独立授权码
                </p>
              </div>

              {/* 通知接收目标邮箱 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  通知接收目标邮箱 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={notifyEmailTo}
                  onChange={(e) => setNotifyEmailTo(e.target.value.trim())}
                  placeholder="527194933@qq.com"
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-neutral-400">接收新订单支付详单的收件人邮箱</p>
              </div>

              {/* 跨国公网连接超时控制 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  网络握手连接超时 (秒)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={5}
                    max={60}
                    value={smtpTimeout}
                    onChange={(e) => setSmtpTimeout(Number(e.target.value) || 15)}
                    className="w-28 px-3.5 py-2.5 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-neutral-500">秒</span>
                  <span className="text-[10px] text-neutral-400 ml-2">
                    (Render / AWS 等境外机房跨国延迟较高，推荐保持 15-20 秒)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 连通性自检与体检按钮操作条 */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4">
            <div className="text-xs text-emerald-950 space-y-0.5">
              <div className="font-bold flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-700" />
                <span>网络与 SMTP 联通性双重诊断：</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                支持一键全项体检探测 DNS、465/587 端口与授权码握手，或直接发送真实模拟订单测试邮件。
              </p>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                disabled={diagnosingEmail}
                onClick={handleDiagnoseEmail}
                className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-300 shadow-2xs transition-all active:scale-98 flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
              >
                <Activity className={`w-3.5 h-3.5 text-emerald-600 ${diagnosingEmail ? 'animate-spin' : ''}`} />
                <span>{diagnosingEmail ? '正在诊断网络...' : '全项网络体检'}</span>
              </button>

              <button
                type="button"
                disabled={testEmailLoading}
                onClick={handleTestEmail}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-98 flex items-center space-x-1.5 disabled:opacity-60 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{testEmailLoading ? '正在发送测试邮件...' : '发送测试详单邮件'}</span>
              </button>
            </div>
          </div>

          {/* 测试发信即时反馈信息条 */}
          {testEmailResult && (
            <div
              className={`p-4 rounded-xl text-xs space-y-1.5 ${
                testEmailResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="font-bold flex items-center space-x-1.5">
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testEmailResult.text}</span>
              </div>
              {testEmailResult.diagnostics?.solution && (
                <div className="p-2.5 bg-white/80 rounded-lg text-[11px] text-rose-900 leading-relaxed border border-rose-200/60 mt-1">
                  <strong>建议排查方案：</strong>
                  <span>{testEmailResult.diagnostics.solution}</span>
                  {testEmailResult.diagnostics.category === 'TIMEOUT' && (
                    <div className="mt-2 flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSmtpPort(587);
                          setSmtpSecure(false);
                          setSmtpTimeout(20);
                        }}
                        className="px-2.5 py-1 bg-emerald-700 text-white font-bold text-[11px] rounded-lg hover:bg-emerald-800 cursor-pointer"
                      >
                        ⚡ 一键切换为 587 端口 (STARTTLS)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 全项体检诊断报告展开卡片 */}
          {showDiagnosticSection && diagnosticReport && (
            <div className="bg-neutral-900 text-white rounded-xl p-4.5 space-y-4 border border-neutral-700 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">SMTP 与公网网络体检诊断报告</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      diagnosticReport.overallStatus === 'passed'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : diagnosticReport.overallStatus === 'warning'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {diagnosticReport.overallStatus === 'passed'
                      ? '✔ 全部体检项通过'
                      : diagnosticReport.overallStatus === 'warning'
                      ? '⚠ 存在网络警告'
                      : '❌ 检测到连接异常'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDiagnosticSection(false)}
                    className="text-neutral-400 hover:text-white text-xs cursor-pointer px-1.5 py-0.5"
                  >
                    收起
                  </button>
                </div>
              </div>

              {/* 核心结论 */}
              <div className="text-xs text-neutral-300 bg-neutral-800/80 p-3 rounded-lg border border-neutral-700 leading-relaxed">
                <strong>综合诊断结论：</strong> {diagnosticReport.summary}
              </div>

              {/* 检查步进清单 */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400">检测项执行明细：</div>
                {(diagnosticReport.steps || []).map((step: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/60 flex items-start space-x-2.5 text-xs"
                  >
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {step.status === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                      {step.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="font-bold text-white flex items-center justify-between">
                        <span>{step.title}</span>
                        {step.durationMs !== undefined && (
                          <span className="text-[10px] text-neutral-400 font-mono">{step.durationMs}ms</span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-300">{step.details}</div>
                      {step.solution && (
                        <div className="text-[11px] text-amber-300 bg-amber-950/30 p-1.5 rounded mt-1 border border-amber-900/40">
                          {step.solution}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 针对当前体检的排查指导 */}
              {diagnosticReport.recommendations?.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-lg space-y-1.5 text-xs text-neutral-300">
                  <div className="font-bold text-emerald-400 flex items-center space-x-1">
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>针对当前公网环境的精准优化建议：</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] text-neutral-300">
                    {diagnosticReport.recommendations.map((rec: string, rIdx: number) => (
                      <li key={rIdx}>{rec}</li>
                    ))}
                  </ul>
                  {diagnosticReport.steps?.some((s: any) => s.name === 'port_465_tcp' && s.status === 'error') &&
                    diagnosticReport.steps?.some((s: any) => s.name === 'port_587_tcp' && s.status === 'success') && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSmtpPort(587);
                            setSmtpSecure(false);
                            setSmtpTimeout(20);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
                        >
                          ⚡ 立即将发信端口切换为 587 (STARTTLS)
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* 生产环境 (Render / 海外云平台) 深度排查指南折叠卡片 */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setShowOverseasGuide(!showOverseasGuide)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-neutral-100/70 transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2 font-bold text-neutral-800">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>为什么上线 Render / 海外云平台后发邮件会提示 Connection timeout？</span>
              </div>
              <div className="text-neutral-400 flex items-center space-x-1 text-xs">
                <span>{showOverseasGuide ? '收起排查指南' : '查看排查与配置指南'}</span>
                {showOverseasGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showOverseasGuide && (
              <div className="p-4 pt-1 border-t border-neutral-200/80 space-y-3 text-[11px] text-neutral-600 leading-relaxed">
                <div>
                  <strong className="text-neutral-800">1. 原因分析：为什么海外云平台连接 QQ 邮箱会超时？</strong>
                  <p className="mt-0.5">
                    Render 的服务器位于 AWS 俄勒冈（美国西海岸）或法兰克福（欧洲），连接中国境内的 QQ 邮箱服务器（<code className="text-neutral-800 bg-neutral-200/60 px-1 py-0.5 rounded">smtp.qq.com</code>）需跨越大洋骨干网络。AWS 与 Render 云防火墙通常对 25 端口彻底封禁，并对 465 端口进行严格流量嗅探。当网络发生抖动或丢包时，TCP/TLS 握手常需耗费 6~12 秒。如果连接超时设置过低，Node.js 就会立即抛出 <code className="text-rose-600 bg-rose-50 px-1 py-0.5 rounded font-mono font-bold">Connection timeout</code>。
                  </p>
                </div>

                <div>
                  <strong className="text-neutral-800">2. 推荐解决方案 A：在上方切换为 587 端口 (STARTTLS)</strong>
                  <p className="mt-0.5">
                    在上方表单中点击切换为<strong>【587 (STARTTLS)】</strong>并点击底部的【保存全部配置】。587 端口走标准 Submission 协议，能顺畅穿透大部分境外机房出站安全组，实测在海外机房表现远优于 465 端口。
                  </p>
                </div>

                <div>
                  <strong className="text-neutral-800">3. 推荐解决方案 B：在 Render 后台直接配置环境变量</strong>
                  <p className="mt-0.5">
                    登录 <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline">Render Dashboard</a>，进入您的 Web Service，点击左侧菜单的 <strong>Environment</strong>，确保添加如下配置：
                  </p>
                  <div className="p-2.5 bg-neutral-900 text-neutral-200 rounded-lg font-mono text-[11px] space-y-1 mt-1">
                    <div>SMTP_HOST = smtp.qq.com</div>
                    <div>SMTP_PORT = 465 (或 587)</div>
                    <div>SMTP_USER = 527194933@qq.com</div>
                    <div>SMTP_PASS = rvlehugdnsmccajh (您的16位授权码)</div>
                    <div>NOTIFY_EMAIL_TO = 527194933@qq.com</div>
                  </div>
                </div>

                <div>
                  <strong className="text-neutral-800">4. QQ 邮箱独立授权码获取与异地登录防风控指南：</strong>
                  <ul className="list-disc pl-4 space-y-1 mt-1">
                    <li>
                      <strong>切勿使用 QQ 密码</strong>：QQ 邮箱必须使用生成的 16 位独立授权码（全英文小写，无空格）。
                    </li>
                    <li>
                      <strong>获取路径</strong>：电脑浏览器登录 <a href="https://mail.qq.com" target="_blank" rel="noreferrer" className="text-emerald-700 underline font-bold">mail.qq.com</a> → 顶部【设置】→【账户】→ 向下滚动找到【POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务】→ 确认【POP3/SMTP服务】为已开启状态 → 点击【生成授权码】。
                    </li>
                    <li>
                      <strong>异地登录安全放行</strong>：由于 Render 服务器在海外，首次连接时 QQ 邮箱可能会向您的 QQ 微信安全中心发送一条“异地登录拦截提醒”，请在手机上点击“是我本人操作/信任该设备”即可解除拦截。
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* 云打印机对接与自动出单模块 */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Printer className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-neutral-900">云打印机对接与自动出单</h3>
                <p className="text-[11px] text-neutral-400">支持接入云打印机 (飞鹅/易联云) 或企业级自定义 Webhook 打印服务</p>
              </div>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <span className="text-xs font-bold text-neutral-700">自动打印</span>
              <input
                type="checkbox"
                checked={autoPrintEnabled}
                onChange={(e) => setAutoPrintEnabled(e.target.checked)}
                className="w-4 h-4 rounded-sm text-amber-600 focus:ring-amber-500 border-neutral-300"
              />
            </label>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            启用后，当顾客提交订单或订单状态变为<strong>【待处理】</strong>时，系统将自动向所绑定的云打印机或 Webhook 服务推送标准小票格式，完成自动后厨与前台出单。
          </p>

          {/* 打印机服务类型选择 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700">
              打印对接协议 / 服务类型
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'webhook', label: '自定义 Webhook', desc: '局域网/自建小票服务' },
                { id: 'feie', label: '飞鹅云打印机', desc: 'FeieYun 云打印开放平台' },
                { id: 'yilianyun', label: '易联云打印机', desc: 'YiLianYun 开放平台' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setPrinterType(item.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    printerType === item.id
                      ? 'border-amber-500 bg-amber-50/40 text-amber-950 ring-1 ring-amber-500/30'
                      : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <div className="text-xs font-bold">{item.label}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 核心凭据：API Key 与 设备 ID (SN) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">
                云打印机设备 ID (SN 码 / 终端号) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={printerSn}
                onChange={(e) => setPrinterSn(e.target.value)}
                placeholder="例如: 917500123 或 打印机底座SN码"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-neutral-400">印在打印机机身底部的唯一样机编号 (Device ID)</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-neutral-700">
                云打印机 API Key / 设备密钥 (KEY) <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={printerKey}
                onChange={(e) => setPrinterKey(e.target.value)}
                placeholder="例如: 填写平台分配的 API Key 或设备密钥"
                className="w-full px-3.5 py-2.5 text-xs font-mono bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white"
              />
              <p className="text-[10px] text-neutral-400">云打印开放平台授权访问密钥 (UKEY / AppKey / 打印机KEY)</p>
            </div>
          </div>

          {/* Webhook 专属地址与Token输入框 */}
          {printerType === 'webhook' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-neutral-50/80 rounded-xl border border-neutral-200">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-bold text-neutral-700">
                  Webhook 打印接口 URL (POST 请求) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={printerWebhookUrl}
                  onChange={(e) => setPrinterWebhookUrl(e.target.value)}
                  placeholder="https://your-print-server.example.com/api/print"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700">
                  Bearer Token / 自定义密钥 (选填)
                </label>
                <input
                  type="password"
                  value={printerSecretToken}
                  onChange={(e) => setPrinterSecretToken(e.target.value)}
                  placeholder="Authorization: Bearer <token>"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-700">
                  打印联数
                </label>
                <select
                  value={printerCopies}
                  onChange={(e) => setPrinterCopies(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value={1}>1 联 (一单一打)</option>
                  <option value={2}>2 联 (前台+后厨双联)</option>
                  <option value={3}>3 联 (客户联+留存联+后厨联)</option>
                </select>
              </div>
            </div>
          )}

          {/* 小票个性化抬头与底部寄语 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-700">小票自定义抬头 (选填)</label>
              <input
                type="text"
                value={printerTicketHeader}
                onChange={(e) => setPrinterTicketHeader(e.target.value)}
                placeholder="默认使用店面名称"
                className="w-full px-3.5 py-2 text-xs bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-neutral-700">小票底部寄语 (选填)</label>
              <input
                type="text"
                value={printerTicketFooter}
                onChange={(e) => setPrinterTicketFooter(e.target.value)}
                placeholder="谢谢惠顾，欢迎再次光临！"
                className="w-full px-3.5 py-2 text-xs bg-neutral-50/50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* 测试打印操作条 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 bg-amber-50/50 border border-amber-200/70 rounded-xl p-3.5">
            <div className="text-xs text-amber-900">
              <span className="font-bold">云打印机联调自检：</span>
              <span>可随时发送一封模拟测试小票指令到指定设备 ID / 接口验证出单效果。</span>
            </div>
            <button
              type="button"
              disabled={testPrintLoading}
              onClick={handleTestPrint}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 shrink-0 disabled:opacity-60 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{testPrintLoading ? '正在发送测试小票...' : '测试打印'}</span>
            </button>
          </div>

          {testPrintResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                testPrintResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {testPrintResult.text}
            </div>
          )}
        </div>

        {/* AI 大脑配置快捷入口卡片 */}
        <div className="bg-gradient-to-r from-neutral-900 to-indigo-950 text-white rounded-2xl p-5 border border-indigo-900/60 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-white">AI 智能大脑与大模型配置</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Agnes AI
                </span>
              </div>
              <p className="text-neutral-300 text-xs mt-0.5">
                已就绪。提供文本与图片大模型、上传大图智能压缩与优化、菜品文案智能撰写。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const tabBtn = document.getElementById('tab-llm');
              if (tabBtn) tabBtn.click();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
          >
            <span>进入 AI 大脑管理</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-98 flex items-center space-x-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '保存配置中...' : '保存全部配置'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
