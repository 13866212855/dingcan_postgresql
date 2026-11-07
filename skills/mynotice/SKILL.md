---
name: mynotice
description: >
  纯前端零依赖实时声音与中文语音播报 + QQ邮箱实时详单 + 🌟 WxPusher 微信模板卡片强提醒协同通知技能（mynotice）。实现前台用户提交（点餐、下单、扫码付款、咨询、工单），后台/管理端实时收到清脆和弦提示音、中文语音合成播报（如“您有新的订餐订单，3号桌...”），指定邮箱同步接收图文客户业务详单，并基于 WxPusher 永久 0 元免费微信强提醒通道（免服务号、无需 3.9 元实名认证费、无需上传身份证）直推接单员个人微信并响铃弹窗！构筑“声、画、信、微”四位一体全天候零漏单防护体系，即使手机息屏锁屏、全屏看短视频、打游戏，新订单也能第一时间叮咚响铃并一键秒进后台接单。
---

# mynotice 实时声音语音播报、邮件详单与微信强提醒协同通知技能规范

在现代商用业务系统（如餐饮点餐、外卖配送、电商商城、商户管理后台、客服工作台、工单看板）中，**“前台客户下单/付款，后台管理端即时播放清脆提示音与中文语音朗读，老板/接单员手机微信立刻收到带响铃弹窗的订单卡片，同时指定邮箱秒级收到完整业务详单”** 能够构筑多通道无死角的业务触达，是极其核心的商用体验点。

本技能沉淀自实战检验的 **“声、画、信、微”四维协同通知方案**：
1. **听觉通道（扬声器/耳麦）**：完全不需要外部 MP3/WAV 静态音频文件，利用 Web Audio API 纯算法合成和弦提示音 + SpeechSynthesis 原生中文语音合成；
2. **移动/触觉通道**：调用浏览器 Navigator.vibrate 产生硬件震动；
3. **视觉与信道通道（邮件详单）**：基于 QQ 邮箱 SMTP（SSL 465 端口）向指定邮箱自动推送图文并茂的完整客户订单业务详单；
4. **🌟 移动微信强提醒通道（WxPusher 0 元免实名通道）**：通过 WxPusher 开放平台向接单员微信推送服务通知模板卡片，**彻底解决接单员手机离开前台、锁屏在口袋、或正在全屏看视频/打游戏导致浏览器声音被挂起而漏单的致命痛点**！手机微信标准清脆提示音响铃 + 锁屏顶部弹窗 + 一键秒进后台接单。

---

## 核心技术选型与优势对比

| 方案对比 | 传统单一外链 MP3 提示音 | 仅靠邮件推送 | 🌟 mynotice 声·信·微 协同体系 (声音+语音+邮件+WxPusher微信) |
| :--- | :--- | :--- | :--- |
| **外部文件依赖** | 需维护 audio 文件，易 404，耗费 CDN | 无 | **零外部音频文件**，声音算法合成，微信走官方云通道 |
| **网络加载延迟** | 首次需加载音频流，延迟 0.5s~3s | 1s~2s 邮件投递 | **毫秒级即时发声**，微信消息秒级直达手机 |
| **动态语音内容** | 只能播死板录音，无法念出桌号金额 | 静态文本邮件 | **动态文本朗读**，智能念出“3号桌加菜”、“实付18元” |
| **离开页面/刷视频** | 浏览器切后台被系统静音冻结，**必漏单** | 取决于是否常驻邮件客户端 | **微信强制响铃弹窗**，手机看短视频/游戏时照样清脆响铃！ |
| **锁屏/熄屏放口袋** | 手机黑屏后声音被 iOS/安卓挂起 | 部分手机邮件无强提醒声 | **微信系统级通知**，黑屏装口袋也能听到标准提示音 |
| **成本与门槛** | 需服务器带宽资源 | 需开通 SMTP（免费） | **永久 0 元免费**，无需 300元服务号认证，**免交 3.9元实名费** |
| **业务细节呈现** | 仅有“叮咚”声，看不到菜品 | 完整商品清单与定制口味 | **卡片带姓名、电话(一键拨打)、金额、菜品清单与一键接单按钮** |

---

## 目录索引

- [1. 核心声音引擎代码 (`lib/sound.ts`)](#1-核心声音引擎代码)
- [2. 浏览器自动播放限制 (Autoplay Policy) 突破机制](#2-浏览器自动播放限制突破机制)
- [3. 后台/管理端新单差量轮询与播报触发模式](#3-后台管理端新单差量检测模式)
- [4. WebSocket / SSE 实时推送集成模式](#4-websocket--sse-实时推送集成)
- [5. 管理后台 UI 控制组件 (声音开关与即时测试)](#5-管理后台-ui-控制组件)
- [6. 多业务场景文案与音调模板库](#6-多业务场景模板库)
- [7. 常见坑点与故障排查 (Troubleshooting)](#7-常见坑点与排查)
- [8. 邮件实时详单通知扩展 (QQ 邮箱 SMTP 扫码支付自动发信)](#8-邮件实时详单通知扩展)
- [8.5 邮件体系进阶实战（主题结构化·触发语义化·465→587自动降级·三级配置·回调协同）](#85-邮件体系进阶实战)
- [9. 微信新订单强提醒体系（WxPusher 0 元免实名通道 + PushPlus 备选）](#9-微信新订单强提醒体系)

---

## 1. 核心声音引擎代码

在项目中创建 `lib/sound.ts`（或 `utils/sound.ts`），直接复制以下完整代码：

```typescript
// lib/sound.ts

let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;

// 防止 Chromium V8 垃圾回收提前清理正在朗读的 Utterance 导致语音中断或静音
const activeUtterances = new Set<SpeechSynthesisUtterance>();

// 预加载并缓存浏览器语音库
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

/**
 * 获取全局单例 AudioContext，安全兼容移动端与 WebKit 前缀
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
}

/**
 * 检查当前音频上下文是否处于可用活跃状态
 */
export function isAudioReady(): boolean {
  if (!audioContext) return false;
  return audioContext.state === 'running' && isAudioUnlocked;
}

/**
 * 解锁浏览器音频播放权限 (必须在任何用户交互事件中调用：如点击、登录、触控)
 * 核心：向音轨输出 1 采样点极短静音，满足 iOS Safari 与 Chrome 严苛的 Autoplay 策略
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        isAudioUnlocked = true;
      })
      .catch(() => {});
  } else {
    isAudioUnlocked = true;
  }

  // 播放 1 个采样点的静音 Buffer 突破 iOS WebKit / 移动端浏览器的自动播放策略
  try {
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  } catch {
    // ignore
  }

  // 唤醒 SpeechSynthesis 引擎（避免挂起）
  if ('speechSynthesis' in window && window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  }
}

/**
 * 纯算法动态合成清脆的商户到单/通知和弦提示音 (类似美团/微信到单音效)
 * 关键坑点修复：必须在调度音节前 await ctx.resume()，确保音频时钟处于活跃运行态
 * 音阶组合: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz) -> E6 (1318Hz)
 */
export async function playOrderChime(): Promise<void> {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  // 确保音频上下文在播放前已处于 running 状态，避免在 suspended 状态下写入时间戳导致音节丢失
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      isAudioUnlocked = true;
    } catch {
      // ignore
    }
  }

  try {
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, time: 0, dur: 0.18, gain: 0.65 },
      { freq: 659.25, time: 0.12, dur: 0.18, gain: 0.7 },
      { freq: 783.99, time: 0.24, dur: 0.18, gain: 0.75 },
      { freq: 1046.5, time: 0.36, dur: 0.45, gain: 0.85 },
      { freq: 1318.51, time: 0.55, dur: 0.45, gain: 0.75 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle'; // 三角波，音色温润清脆
      osc.frequency.setValueAtTime(n.freq, now + n.time);

      gainNode.gain.setValueAtTime(0.001, now + n.time);
      gainNode.gain.linearRampToValueAtTime(n.gain, now + n.time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);
    });
  } catch (err) {
    console.warn('[mynotice] 提示音合成异常:', err);
  }
}

/**
 * 原生中文语音合成 (TTS 朗读)
 * 关键坑点修复：
 * 1. 挂入全局 activeUtterances Set，防止 Chromium V8 垃圾回收提前清理导致中断
 * 2. 多重普通话声音兼容兜底匹配
 */
export function speakChineseText(text: string = '您有新的订单，请及时处理！'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    // 关键：先取消任何正在排队或卡住的陈旧发音，防止长队列堆积与延迟发声
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;  // 最佳商用语速
    utterance.pitch = 1.05; // 略微提亮音调，穿透力更佳
    utterance.volume = 1.0;

    // 智能选择最优质的普通话中文语音（兼容多操作系统与浏览器）
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const zhVoice =
          voices.find((v) => v.lang === 'zh-CN' || v.lang === 'zh_CN') ||
          voices.find((v) => v.lang.startsWith('zh') || v.lang.includes('cmn')) ||
          voices.find((v) => v.name.includes('Chinese') || v.name.includes('普通话'));
        if (zhVoice) {
          utterance.voice = zhVoice;
        }
      }
    } catch {
      // ignore
    }

    // 防止 V8 垃圾回收中断正在播报的语音
    activeUtterances.add(utterance);
    utterance.onend = () => {
      activeUtterances.delete(utterance);
    };
    utterance.onerror = () => {
      activeUtterances.delete(utterance);
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[mynotice] 中文语音朗读异常:', err);
  }
}

/**
 * 移动端/微信震动提醒 (支持的 Android 与移动浏览器)
 */
export function triggerVibration(): void {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // 忽略平台不支持
    }
  }
}

/**
 * 完整到单提醒组合拳：
 * 步骤 1: 立即激活音频并播放悦耳五音连和弦
 * 步骤 2: 触发硬件震动
 * 步骤 3: 延时 450ms 自然衔接中文语音播报
 *
 * @param count 新单数量
 * @param detail 动态细节 (例如: "3号桌", "外卖客户张先生")
 * @param customPrefix 自定义前缀 (默认: "您有新的订餐订单")
 */
export async function alertNotification(count: number = 1, detail?: string, customPrefix: string = '您有新的订单'): Promise<void> {
  unlockAudio();
  await playOrderChime();
  triggerVibration();

  let msg = '';
  if (detail) {
    msg = `${customPrefix}，${detail}，请及时处理`;
  } else if (count > 1) {
    msg = `您有${count}笔新的订单，请及时处理`;
  } else {
    msg = `${customPrefix}，请及时处理`;
  }

  // 延迟 450 毫秒，等和弦提示音收尾后再开启动态语音，听感极其自然高级
  setTimeout(() => {
    speakChineseText(msg);
  }, 450);
}
```

---

## 2. 浏览器自动播放限制突破机制

### 为什么后台挂机时经常“不响”？
现代浏览器出于防骚扰考虑，规定：**页面在没有发生任何用户点击或手势前，禁止直接播放声音（`The AudioContext was not allowed to start`）**。

### 优雅的解决方案组合拳：
1. **登录即解锁**：管理员在输入账号密码点击“登录”提交时，在 `onSubmit` 中立即调用 `unlockAudio()`。
2. **Tab 切换/全局点击捕获**：在后台顶层添加透明或显式监听：
   ```tsx
   useEffect(() => {
     const handleInteraction = () => {
       unlockAudio();
     };
     window.addEventListener('click', handleInteraction, { once: true });
     window.addEventListener('touchstart', handleInteraction, { once: true });
     return () => {
       window.removeEventListener('click', handleInteraction);
       window.removeEventListener('touchstart', handleInteraction);
     };
   }, []);
   ```
3. **顶栏常驻“声音状态”按钮**：提供醒目的【🔊 声音提醒：已开启】切换按钮，用户初次进入点击该按钮试听时，即可完成永久静默授权。

---

## 3. 后台管理端新单差量检测模式

### 3.1 为什么必须用“差量检测”？
后台定时向后端接口轮询获取订单列表时，如果直接用 `length` 变化或无脑播报，会导致**初次加载页面时把全部历史订单念一遍**，或者**每轮刷新都误报**。

### 3.2 标准差量比较实现 (React Hook)
```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { alertNotification, unlockAudio } from '@/lib/sound';

export function useOrderNotifier(tenantId: string) {
  const [orders, setOrders] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // 核心：使用 useRef 保存已知的所有订单 ID 集合
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef<boolean>(true);

  const pollOrders = useCallback(async () => {
    try {
      // 若页面处于后台且不需要轮询，可选择性跳过
      const res = await fetch(`/api/orders?tenant=${encodeURIComponent(tenantId)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) return;

      const currentOrders = json.data;

      // 初次加载只建立基准已知集合，绝对不触发报警声音
      if (isFirstLoadRef.current) {
        knownOrderIdsRef.current = new Set(currentOrders.map((o: any) => o.id));
        isFirstLoadRef.current = false;
        setOrders(currentOrders);
        return;
      }

      // 差量过滤：挑出之前从未见过的全新订单
      const brandNewOrders = currentOrders.filter((o: any) => !knownOrderIdsRef.current.has(o.id));

      if (brandNewOrders.length > 0) {
        const newest = brandNewOrders[0];
        
        // 组装智能提示细节
        const detail = newest.table_no
          ? `${newest.table_no}有新单`
          : newest.contact_name
            ? `客户${newest.contact_name}有新单`
            : undefined;

        if (soundEnabled) {
          alertNotification(brandNewOrders.length, detail, '您有新的业务订单');
        }
      }

      // 更新已知集合与当前列表
      knownOrderIdsRef.current = new Set(currentOrders.map((o: any) => o.id));
      setOrders(currentOrders);
    } catch (err) {
      console.warn('轮询拉取失败', err);
    }
  }, [tenantId, soundEnabled]);

  // 每隔 5 秒自动拉取一次
  useEffect(() => {
    pollOrders();
    const timer = setInterval(pollOrders, 5000);
    return () => clearInterval(timer);
  }, [pollOrders]);

  return { orders, soundEnabled, setSoundEnabled };
}
```

---

## 4. WebSocket / SSE 实时推送集成

如果系统采用了全双工 WebSocket 或服务端单向 SSE（Server-Sent Events），播报逻辑更加清晰直接：

```typescript
// 在客户端建立连接的事件回调中
socket.on('new_order', (orderData) => {
  if (isSoundEnabled) {
    const detail = orderData.tableNo ? `${orderData.tableNo}` : `金额${orderData.totalPrice}元`;
    alertNotification(1, detail, '收到新订单');
  }
  // 刷新前端卡片看板...
});
```

---

## 5. 管理后台 UI 控制组件

在后台导航栏或控制面板提供友好的用户控制与授权按钮，既满足可用性，又巧妙完成授权：

```tsx
// components/admin/SoundNoticeToggle.tsx
'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Play } from 'lucide-react';
import { unlockAudio, alertNotification } from '@/lib/sound';

export function SoundNoticeToggle() {
  const [enabled, setEnabled] = useState(true);

  const handleToggle = () => {
    unlockAudio();
    const next = !enabled;
    setEnabled(next);
    if (next) {
      alertNotification(1, '声音提醒已开启');
    }
  };

  const handleTestNotice = () => {
    unlockAudio();
    alertNotification(1, '测试语音播报正常');
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleToggle}
        className={`px-3 py-1.5 text-xs font-medium rounded-xl flex items-center space-x-1.5 transition-all shadow-sm ${
          enabled
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200'
            : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-500'
        }`}
        title={enabled ? '点击静音后台' : '点击开启声音提醒'}
      >
        {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <span>{enabled ? '声音播报开启' : '已静音'}</span>
      </button>

      {enabled && (
        <button
          onClick={handleTestNotice}
          className="px-2.5 py-1.5 text-xs text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl flex items-center space-x-1 transition-colors"
          title="试听一次提示音和语音效果"
        >
          <Play className="w-3 h-3" />
          <span>测试</span>
        </button>
      )}
    </div>
  );
}
```

---

## 6. 多业务场景模板库

可直接根据不同业务调用 `alertNotification` 或 `speakChineseText`：

| 业务场景 | 触发时机 | 推荐朗读文案模板 |
| :--- | :--- | :--- |
| **餐厅扫码点餐** | 顾客在前台手机选菜付款成功 | `alertNotification(1, "5号桌加菜2份", "您有新的点餐订单")` |
| **电商/外卖配送** | 顾客提交外卖订单 | `alertNotification(1, "外卖客户王女士有新单", "您有新的外卖订单")` |
| **收银台收款** | 扫码收款到账 | `alertNotification(1, "微信支付到账 38 元", "收款成功")` |
| **排队叫号系统** | 叫下一个号码 | `speakChineseText("请 A08 号顾客到 1 号窗口取餐")` |
| **在线客服/工单** | 用户发送咨询或反馈 | `alertNotification(1, "来自微信公众号的咨询", "您有一条新的待处理消息")` |

---

## 7. 常见核心坑点与排查（实战经验总结）

在各种现代前端、移动端、多租户以及容器化部署环境中，声音播报与邮件通知极易踩中深层坑点。以下为本技能沉淀的 7 大致命坑点与完美规避方案：

### 坑点一：`AudioContext` 在 `suspended` 挂起状态下写音轨导致提示音丢失或静音
- **症状**：点击测试有声音，但后台收到新单时却无声音或只有轻微杂音。
- **原因**：现代浏览器即便解锁过，在长时间无手势交互后，`audioContext.state` 仍会自动回退为 `'suspended'`。若直接通过 `setValueAtTime(freq, ctx.currentTime + offset)` 向挂起的上下文追加振荡器，时间戳与时钟发生错位，导致音节不被渲染。
- **终极解法**：在 `playOrderChime()` 内部，必须先 `if (ctx.state === 'suspended') await ctx.resume();` 确认上下文已恢复运行态，再调度振荡器节点。

### 坑点二：Chromium / Blink 浏览器的垃圾回收（V8 GC）提前回收 `SpeechSynthesisUtterance`
- **症状**：中文语音有时念到一半（如“您有新的...”）突然戛然而止，或者偶尔彻底不发声，但控制台无报错。
- **原因**：Chromium 的 V8 引擎会将局部变量 `const utterance = new SpeechSynthesisUtterance(text)` 视为可回收对象，若语音在播放过程中触发了 GC，底层 C++ 音频渲染通道被强制销毁。
- **终极解法**：建立全局单例 `Set<SpeechSynthesisUtterance>`，在 `utterance` 创建后执行 `activeUtterances.add(utterance)` 保持强引用，并在 `onend` 与 `onerror` 回调中将其从 Set 中移除。

### 坑点三：浏览器自动播放限制 (Autoplay Policy) 突破
- **症状**：初次打开后台或无点击时报错 `The AudioContext was not allowed to start`。
- **解法**：
  1. 监听全局首次 `click` / `touchstart` / `keydown` 并触发 `unlockAudio()`；
  2. 解锁时向音轨播放 1 个采样点的极短静音 Buffer（兼容 iOS WebKit 特殊限制）；
  3. 顶栏提供明确的【声音提示：已开启】切换/测试按钮，引导用户交互授权。

### 坑点四：`SpeechSynthesis` 假死与多操作系统中文语音包缺失
- **症状**：部分 Windows / Android 设备播报静音或发英文字音。
- **解法**：
  1. 播放前先 `window.speechSynthesis.cancel()` 清空排队阻塞任务，若 `window.speechSynthesis.paused` 为真则调用 `resume()` 唤醒引擎；
  2. 智能筛选语音库：优先匹配 `zh-CN`、`zh_CN`、`cmn`、`Chinese` 或包含 `普通话` 的 voice 资源。

### 坑点五：初次加载与基线集合 (Baseline)
- **症状**：刷新管理后台时，突然把历史库里所有的待处理旧订单连续播报多遍。
- **解法**：在后台轮询 Hook 中设置 `isBaselineLoadedRef`，首次拉取仅将现有订单 ID 全量存入 `knownOrderIdsRef`（静默建基线），后续拉取才通过 `brandNew = current.filter(o => !known.has(o.id))` 进行差量捕获。

### 坑点六：多接单员并发接单的数据隔离与防重复影响
- **症状**：配置多个接单员时，一个接单员接了单，其他接单员还在反复提示该单。
- **解法**：接单员认领订单后，订单状态由“待处理”转为“制作中”，并记录认领人手机号。其他接单员仅查询公共“待处理”以及“本人名下”订单，已被他人接单的记录自动不再对其他接单员展现与播报。

### 坑点七（极重要）：容器化与 Serverless (Docker, Cloud Run, Next.js App Router) 的 CPU 冻结导致邮件发信腰斩
- **症状**：测试邮件能发成功，但在实际客户提交订单或触发声音播报时，QQ 邮箱却没有收到详单。
- **原因**：开发者往往习惯写 `(async () => { await sendMail(...) })()` 以为是不阻塞主线程的异步派发。然而在 Next.js App Router 或 Cloud Run/Serverless 容器环境中，一旦返回了 `NextResponse.json(...)`，HTTP 连接被关闭，容器的 CPU 调度立即被宿主暂停（Freeze）！连接 `smtp.qq.com:465` 并完成 SSL 握手通常耗时 0.5s~1s，进程在握手中途被休眠冻结，邮件根本未送出！
- **终极解法**：
  1. **主路径安全时限 Await**：在 API 路由中采用 `await Promise.race([sendMail(...), timeout(3500)])`，最多等待 3.5 秒即可保证 SSL 握手与邮件发送完成，既不超时也不被宿主挂起；
  2. **双通道声信协同 (Dual-Dispatch)**：后台工作台在听到提示音、检测到新订单时，同步触发 `/api/orders/[id]/notify-email` 发送邮件，构成“下单触发 + 声音协同”双保险；
  3. **60 秒内存防重 (Deduplication Cache)**：`lib/email.ts` 内部基于 `tenantId + orderId + paymentStatus` 缓存 60 秒内发送时间戳，双通道或多次轮询自动去重，杜绝重复轰炸。

---

## 8. “声信协同”邮件实时详单同步通知体系

在商用实战场景中，仅靠浏览器端的声音播报存在局限：如果店员离开了电脑屏幕、电脑合盖锁屏、或处于嘈杂厨房，可能会错过声音。  
因此，**mynotice 技能支持“声信协同”多通道机制**：
> **当后台触发声音与中文语音播报的同时，服务端自动向指定邮箱（如 `527194933@qq.com`）投递一份格式工整、图文并茂的客户订单业务详单。**

这样店长手机上绑定的 QQ 邮箱 / 微信邮件提醒会立刻弹窗，即使店员离店或手机息屏，也能做到**双保险、全天候零漏单**。

---

### 8.1 QQ 邮箱 SMTP 安全授权与环境变量标准

根据 QQ 邮箱官方 POP3/IMAP/SMTP 安全规范，外部第三方客户端发信必须使用独立生成的 **16位授权码**（非 QQ 登录密码）：

| 环境变量参数 | 示例推荐值 | QQ 邮箱官方协议对应说明 |
| :--- | :--- | :--- |
| **`SMTP_HOST`** | `smtp.qq.com` | 发送邮件服务器主机地址 |
| **`SMTP_PORT`** | `465` | SSL 加密端口（官方推荐 465） |
| **`SMTP_SECURE`** | `true` | 是否启用 SSL 安全传输层加密 |
| **`SMTP_USER`** | `527194933@qq.com` | 完整发信账号（用户名/邮箱地址） |
| **`SMTP_PASS`** | `rvlehugdnsmccajh` | 邮箱安全中心生成的专属 16 位客户端授权码 |
| **`NOTIFY_EMAIL_TO`** | `527194933@qq.com` | 接收订单业务详单的目标商户邮箱 |

在项目 `.env.local` 或生产平台环境变量中写入：
```env
# QQ 邮箱 SMTP 安全发信服务
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=527194933@qq.com
SMTP_PASS=rvlehugdnsmccajh
NOTIFY_EMAIL_TO=527194933@qq.com
```

---

### 8.2 核心发信模块与详单模板 (`lib/email.ts`)

包含 60 秒内存防重复发信缓存（`sentOrderEmailTimestamps`）：

```typescript
// lib/email.ts
import nodemailer, { type Transporter } from 'nodemailer';
import { Order } from '@/types';

let transporterInstance: Transporter | null = null;

export function getTransporter(): Transporter {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.qq.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER || '527194933@qq.com',
        pass: process.env.SMTP_PASS || 'rvlehugdnsmccajh',
      },
    });
  }
  return transporterInstance;
}

// 内存防重复发信缓存（60秒内同一单号同一状态不重复发送，杜绝并发轰炸）
const sentOrderEmailTimestamps = new Map<string, number>();

export async function sendOrderPaymentEmail(
  order: Order,
  options?: {
    restaurantName?: string;
    noteTrigger?: string;
    force?: boolean;
  }
) {
  const cacheKey = `${order.tenant_id || 'default'}_${order.id}_${order.payment_status}`;
  const now = Date.now();
  const lastSent = sentOrderEmailTimestamps.get(cacheKey);

  if (!options?.force && lastSent && now - lastSent < 60000) {
    return { success: true, messageId: 'cached_dedup' };
  }

  const userEmail = process.env.SMTP_USER || '527194933@qq.com';
  const targetEmail = process.env.NOTIFY_EMAIL_TO || '527194933@qq.com';
  const shopName = options?.restaurantName || '饭店点餐系统';
  const triggerDesc = options?.noteTrigger || '后台语音播报协同触发';

  const isDineIn = order.order_type === '堂食';
  const locationTitle = isDineIn ? `堂食 · ${order.table_no || '未定桌号'}` : `外卖 · ${order.delivery_contact || '顾客'}`;
  const isPaid = order.payment_status === '已支付';
  const finalPrice = Number(order.final_amount ?? order.total_amount).toFixed(2);

  const subjectPrefix = isPaid ? '【新订单已支付】' : '【新点餐提醒】';
  const subject = `${subjectPrefix}${locationTitle} - 订单号: ${order.id} (${isPaid ? '实付' : '待收'}: ¥${finalPrice})`;

  // 生成 HTML 详单排版并发送
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from: `"${shopName}通知" <${userEmail}>`,
    to: targetEmail,
    subject,
    html: `<!-- 详细详单排版 HTML -->`,
  });

  sentOrderEmailTimestamps.set(cacheKey, now);
  return { success: true, messageId: info.messageId };
}
```

---

### 8.3 “声信协同”双通道触发架构 (Dual-Dispatch Architecture)

为解决 Serverless/容器环境冻结问题，并确保“只要响铃必有邮件”，系统构建了坚固的**双通道协同闭环**：

```
                      顾客下单 / 扫码支付
                             │
                             ▼
             [ Next.js API: POST /api/orders ]
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
        1. 写入数据库成功             2. 【通道一：主线程安全时限 Await】
        返回 200 给客户端             Promise.race([sendOrderPaymentEmail, 3500ms])
                                      保证在容器休眠前完成 SMTP 握手并投递
                                           │
                                           ▼
                                   目标邮箱: 527194933@qq.com

                             同时（前端协同）
                             │
                             ▼
        [ 管理后台/接单工作台轮询到新订单 (brandNew > 0) ]
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
        1. 响起清脆和弦铃声          2. 【通道二：工作台声信协同端点】
        + 中文语音播报桌号与内容      调用 POST /api/orders/[id]/notify-email
                                           │
                                           ▼
                                 若通道一已发，60s 去重拦截；
                                 若通道一未发，此处兜底确保发信必达！
```

#### 通道一：后端订单接口代码 (`app/api/orders/route.ts`)
```typescript
// 写入订单后，通过 Promise.race 确保发信在 3.5 秒内执行，杜绝容器冻结
try {
  const emailPromise = (async () => {
    const fullOrder = await getOrderById(order.id, tenantId);
    const settings = await getSettings(tenantId);
    if (fullOrder) {
      await sendOrderPaymentEmail(fullOrder, {
        restaurantName: settings?.restaurant_name,
        noteTrigger: paymentStatus === '已支付'
          ? '客户下单时已完成扫码支付 · 后台语音同步播报'
          : '客户提交新订单（餐后结账）· 后台语音同步播报',
      });
    }
  })();
  await Promise.race([
    emailPromise,
    new Promise((resolve) => setTimeout(resolve, 3500)),
  ]);
} catch (mailErr) {
  console.error('[Order Notice Email Error]', mailErr);
}
```

#### 通道二：工作台声音播报与邮件端点联动 (`app/admin/page.tsx`)
```typescript
// 当工作台检测到新订单并触发声音告警时，同步调用邮件端点
if (brandNew.length > 0) {
  if (soundEnabledRef.current) {
    alertNewOrder(brandNew.length, detail);
  }

  // 声信协同：只要响铃，必同步确保投递详单邮件
  brandNew.forEach((newOrder) => {
    fetch(`/api/orders/${newOrder.id}/notify-email?tenant=${encodeURIComponent(currentTenantId)}`, {
      method: 'POST',
    }).catch((e) => console.warn('[Admin Sound-Email Sync Notice]', e));
  });
}
```

#### 协同邮件端点 (`app/api/orders/[id]/notify-email/route.ts`)
```typescript
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = getTenantIdFromRequest(req);
  const order = await getOrderById(id, tenantId);
  if (!order) return NextResponse.json({ success: false, error: '未找到订单' }, { status: 404 });

  const settings = await getSettings(tenantId);
  const result = await sendOrderPaymentEmail(order, {
    restaurantName: settings?.restaurant_name,
    noteTrigger: '后台订单工作台提示音触发 · 同步邮件送达',
  });

  return NextResponse.json({ success: result.success });
}
```

---

### 8.4 管理端邮件连通性自检 API 与测试组件

为了让管理员能随时排查邮箱是否畅通，提供独立自检接口与前端一键测试能力：

1. **测试接口 (`app/api/email/test/route.ts`)**：
   ```typescript
   export async function POST(req: NextRequest) {
     const body = await req.json().catch(() => ({}));
     const target = body.toEmail || process.env.NOTIFY_EMAIL_TO || '527194933@qq.com';
     const result = await testSendEmail(target);
     return NextResponse.json(result);
   }
   ```
2. **管理后台一键触发按钮**：
   在后台设置面板提供【发送一封测试详单邮件】按钮，管理员点击后即可在 2 秒内收到一封真实带菜品排版的模拟测试邮件，确认发信账号、授权码与目标收信无误。

---

### 8.5 邮件体系进阶实战（2026-11 dingcan_postgresql 全链路验证沉淀）

以下六条是本技能在真实订餐系统上多轮实测后新增的进阶经验，接入任何新项目都应全量采用：

#### ① 邮件主题结构化——手机通知栏免点开即知全部

主题行必须容纳商家最关心的四要素（状态/位置/单号/金额），手机 QQ 邮箱弹窗不用点开就能决策：

```
【新订单已支付】堂食 · 3号桌 - 订单号: ORD-GCXQ-20261106-1234 (实付: ¥17.99)
【新点餐提醒】外卖 · 张先生 - 订单号: ORD-xxx (待收: ¥18.00)
```

- 前缀徽标词区分 `已支付`/`待收`（商家看到"待收"就知道顾客吃完要收钱）；
- 就餐位置（桌号或外卖联系人）进主题，嘈杂环境听不清语音时看邮件弹窗即可。

#### ② 触发来源语义化（noteTrigger 分场景文案）

同一订单在生命周期不同节点都会触发邮件，`noteTrigger` 必须写明**触发来源与状态可信度**，商家据此判断这单的钱是否已实收：

| 触发场景 | noteTrigger 文案 | 可信度 |
|---|---|---|
| 静态码顾客自助确认 | 客户下单时已完成扫码支付 · 后台语音同步播报 | 声明级（需店家对账） |
| 在线支付下单待回调 | 客户已下单，正在完成在线支付（支付成功后自动确认到账） | 待定级 |
| 支付回调自动确认 | 客户已通过在线支付完成付款（通道自动确认到账） | **实收级（最高）** |
| 餐后结账 | 客户提交新订单（餐后结账）· 后台语音同步播报 | 待收级 |
| 工作台响铃协同 | 后台订单工作台提示音触发 · 同步邮件送达 | 兜底级 |
| 后台测试 | 管理员在后台点击【测试发送通知邮件】 | 测试 |

实现上就是给 `sendOrderPaymentEmail` 的调用点各传各的 `noteTrigger`，邮件正文"触发来源"字段原样展示。

#### ③ 境外云部署 465→587 自动降级（Render/AWS/GCP 必备）

境外云主机的出站防火墙**经常封锁 465 端口**（SMTP over SSL），表现为 connection timeout——本机测试能发、部署到 Render 后实际订单邮件全部消失。解法：捕获 timeout/ETIMEDOUT/ECONNREFUSED 类错误后**自动切 587 (STARTTLS) 重试**：

```typescript
// 主发信失败且判定为端口连通类错误 → 自动降级 587 (STARTTLS) 重试
try {
  info = await primaryTransporter.sendMail({ from, to, subject, html });
} catch (primaryError: any) {
  const errMsg = String(primaryError?.message || '');
  if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT') || errMsg.includes('ECONNREFUSED')) {
    // 境外云防火墙常封锁 465 出站 → 切 587 STARTTLS 通道
    const fallbackTransporter = createTransporter({ port: 587, secure: false });
    info = await fallbackTransporter.sendMail({ from, to, subject, html });
  } else {
    throw primaryError;
  }
}
```

配套超时三件套（避免挂死）：`connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000`。

#### ④ SMTP 配置三级来源 + 后台可视化运维

优先级：**settings 表（管理员后台修改即时生效，无需重新部署）> 环境变量 > 代码默认**。后台设置面板提供完整 SMTP 表单（主机/端口/SSL/账号/授权码/收件邮箱/超时）+【发送测试邮件】按钮 + diagnose 分步诊断接口（逐环节定位 DNS/握手/认证/发信哪一环失败）。多租户系统每租户独立配置，钱和通知各归各店。

#### ⑤ 通知嵌入支付回调的安全模式（配合 my_tow_pay）

在第三方支付回调（如虎皮椒 notify）里发确认邮件：必须 `Promise.race([email, 3500ms])` 限时，且**邮件任何失败绝不阻塞回调应答**——回调必须无条件返回 `success`，否则支付通道按未确认处理重试 6 次。原则：**通知是旁路，永远不拖累主链路应答**。

#### ⑥ 海外服务器时间戳强制北京时区

Render/AWS 容器默认 UTC，邮件里的"下单时间"会差 8 小时，商家会以为单子时间错乱。所有邮件内时间统一格式化：

```typescript
function formatBeijingTime(d: Date): string {
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, /* 年月日时分秒 */ });
}
```

#### 补充：中文语音播报文案场景化

播报文案带上门店语境更实用（已在实战验证）：外卖单播「外卖客户张先生有新单」，订单卡标签写「【外卖：张先生】」；堂食播「3号桌新订单」。多接单员租户下，语音只对"公共待处理 + 本人名下"订单响铃，已认领单从其他接单员视野静默消失（与坑点六配套）。

---

## 9. 微信新订单强提醒体系（WxPusher 0 元免实名通道 + PushPlus 备选）

在移动端接单实战中，**“纯靠浏览器发声”存在一个致命的系统级死穴**：
> 当接单员用手机微信或移动浏览器打开管理后台后，如果手机息屏锁屏放进口袋、或者切出浏览器去全屏刷抖音、看短视频、聊微信、打游戏，iOS WebKit 与 Android 系统内核会在 10~30 秒内强制休眠冻结后台网页的 JavaScript 定时器与 Web Audio 声卡通道。此时哪怕有新订单产生，浏览器在后台也根本无法发声！

为了彻底打破手机休眠限制，mynotice 技能正式纳入 **微信新订单强提醒体系**：  
顾客下单付款的瞬间，服务端通过微信模板通知直推接单员手机微信，由微信官方客户端在系统底层弹窗横幅并清脆响铃！无论接单员在刷短视频还是手机黑屏放围裙口袋，都能准时听到声音提醒，点击通知秒进后台接单！

---

### 9.1 微信推送通道选型对比与避坑指南

| 平台方案 | 费用成本 | 实名与资质要求 | 手机锁屏/看短视频响铃能力 | 多店员组播支持 | 适用结论 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **🌟 WxPusher（首选推荐）** | **永久 0 元免费** | **免交实名费、免传身份证、免企业资质** | **强提醒**：微信官方服务通知叮咚响铃+顶部弹窗 | 支持 `topicId` 多人同时响铃 | **强烈推荐！1分钟上线，0元无坑** |
| **PushPlus（备用通道）** | 个人需交 3.9 元认证费 | **官方强制要求 3.9 元实名核验**，未交费报错拦截 | **强提醒**：公众号服务通知弹窗响铃 | 支持 `topic` 组播 | **备用**。因强制收费易导致未认证阻断 |
| **自建微信服务号** | 每年 300 元认证费 | 必须营业执照 + 企业认证 + 复杂模板审核 | **强提醒**：企业自有公众号下发 | 需自建 OpenID 映射体系 | 成本高、维护繁琐，中小商家不建议 |

> ⚠️ **深度避坑**：PushPlus 官方在近期调整了策略，所有未完成 3.9 元第三方身份核验的账号，调用 API 会直接返回 `code: 600, msg: "账户未进行实名认证"` 导致发信失败。因此，系统**必须默认首选 WxPusher**，提供 100% 零成本、免身份认证的稳定推送，并保留 PushPlus 作为备用。

---

### 9.2 核心代码实现：`lib/pushplus.ts` (双通道分发与卡片排版)

在项目中建立 `lib/pushplus.ts`，支持 WxPusher 与 PushPlus 自动多通道分发：

```typescript
// lib/pushplus.ts
import { Order } from '@/types';
import { getSettings } from '@/lib/db';

interface PushPlusSendOptions {
  restaurantName?: string;
  tenantId: string;
  triggerNote?: string;
}

/**
 * 微信新订单强提醒（支持 WxPusher 永久免认证费通道 & PushPlus 通道）
 * 当顾客下单或支付成功后，主动向接单员个人微信发送服务通知
 * 无论接单员在看视频、打游戏还是手机锁屏，微信都会弹出带声音的系统通知
 */
export async function sendOrderPushPlusNotification(
  order: Order,
  options: PushPlusSendOptions
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const settings = await getSettings(options.tenantId);

    if (settings.pushplus_enabled === 0) {
      return { success: false, message: '微信新订单强提醒未开启，已跳过' };
    }

    const channel = settings.wechat_push_channel || 'wxpusher';
    const storeName = options.restaurantName?.trim() || settings.restaurant_name || '餐饮订餐系统';

    // 格式化顾客信息
    const customerName = order.customer_name?.trim() || order.delivery_contact?.trim() || '点餐顾客';
    const customerPhone = order.customer_phone?.trim() || order.delivery_phone?.trim() || '未填手机号';
    const deliveryAddress = order.customer_address?.trim() || order.delivery_address?.trim() || '';
    const orderType = order.order_type || (deliveryAddress ? '外卖配送' : '店内堂食');
    const tableInfo = order.table_no && order.table_no !== '自取/未指定桌位' && order.table_no !== '未定' ? ` (${order.table_no})` : '';

    // 构造菜品清单 HTML
    const items = order.items || [];
    const itemsHtml = items.length > 0
      ? items
          .map((i) => {
            const tasteStr = i.taste ? ` <span style="color:#d97706;font-size:12px;">[${i.taste}]</span>` : '';
            return `<li style="margin-bottom: 4px;"><strong>${i.dish_name}</strong> × ${i.quantity}份 (小计: ¥${(i.subtotal || i.price * i.quantity).toFixed(2)})${tasteStr}</li>`;
          })
          .join('')
      : '<li>点餐明细已生成</li>';

    // 构造后台直达链接
    const customDomain = settings.custom_domain?.trim();
    const baseHost = customDomain ? customDomain.replace(/\/+$/, '') : 'https://your-domain.com';
    const adminUrl = `${baseHost}/admin?tenant=${encodeURIComponent(options.tenantId)}`;

    // 标题：醒目加粗，带店名、类型和实收金额
    const title = `🔔【${storeName}】新${orderType}！实付:¥${Number(order.final_amount ?? order.total_amount).toFixed(2)}`;

    // 正文：卡片式 HTML 排版
    const content = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; padding: 14px; border: 1px solid #fed7aa; border-radius: 14px; background: #fffaf5;">
  <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #fb923c; padding-bottom: 8px; margin-bottom: 12px;">
    <h3 style="color: #c2410c; margin: 0; font-size: 16px;">🔔【${storeName}】新订单到来！</h3>
    <span style="background: #ea580c; color: #fff; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 20px;">${order.payment_status || '已支付'}</span>
  </div>

  <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="color: #6b7280; width: 75px; padding: 3px 0;">订单编号：</td>
      <td style="font-family: monospace; font-weight: bold; color: #111827;">${order.id}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">就餐方式：</td>
      <td style="color: #2563eb; font-weight: bold;">${orderType}${tableInfo}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">实付金额：</td>
      <td style="color: #dc2626; font-size: 16px; font-weight: 900;">¥${Number(order.final_amount ?? order.total_amount).toFixed(2)}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">下单顾客：</td>
      <td style="font-weight: bold; color: #111827;">${customerName}</td>
    </tr>
    <tr>
      <td style="color: #6b7280; padding: 3px 0;">联系电话：</td>
      <td><a href="tel:${customerPhone}" style="color: #0284c7; font-weight: bold; text-decoration: none;">${customerPhone} (点击拨打)</a></td>
    </tr>
    ${
      deliveryAddress
        ? `<tr>
      <td style="color: #6b7280; padding: 3px 0; vertical-align: top;">送餐地址：</td>
      <td style="color: #059669; font-weight: bold; font-size: 13px; line-height: 1.4;">${deliveryAddress}</td>
    </tr>`
        : ''
    }
  </table>

  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
    <div style="font-size: 12px; font-weight: bold; color: #374151; margin-bottom: 6px;">🍱 菜品清单：</div>
    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4b5563;">
      ${itemsHtml}
    </ul>
  </div>

  <div style="text-align: center; margin-top: 14px;">
    <a href="${adminUrl}" style="display: block; background: #059669; color: #ffffff; padding: 10px 16px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; text-align: center;">
      👉 点击进入后台直接接单处理
    </a>
  </div>
</div>
`.trim();

    // 优先通道 1：WxPusher 永久免实名费通道
    if (channel === 'wxpusher' || (!settings.pushplus_token && settings.wxpusher_app_token)) {
      if (!settings.wxpusher_app_token?.trim()) {
        return { success: false, message: 'WxPusher 未配置 AppToken，已跳过' };
      }

      const uids: string[] = [];
      if (settings.wxpusher_uid?.trim()) {
        uids.push(settings.wxpusher_uid.trim());
      }

      const topicIds: number[] = [];
      if (settings.wxpusher_topic_id?.trim()) {
        const parsedTopic = parseInt(settings.wxpusher_topic_id.trim());
        if (!isNaN(parsedTopic)) topicIds.push(parsedTopic);
      }

      if (uids.length === 0 && topicIds.length === 0) {
        return { success: false, message: 'WxPusher 未配置 UID 或 TopicId，无法推送' };
      }

      // WxPusher 开放接口
      const res = await fetch('https://wxpusher.zjiecode.com/api/send/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appToken: settings.wxpusher_app_token.trim(),
          content,
          summary: title,
          contentType: 2, // 2: HTML
          uids: uids.length > 0 ? uids : undefined,
          topicIds: topicIds.length > 0 ? topicIds : undefined,
          url: adminUrl,
        }),
      });

      const data = await res.json();
      if (data.code === 1000) {
        return { success: true, message: 'WxPusher 微信消息已成功推送' };
      } else {
        return { success: false, error: data.msg || `WxPusher 响应码: ${data.code}` };
      }
    }

    // 备用通道 2：PushPlus
    if (settings.pushplus_token?.trim()) {
      const pushPayload: any = {
        token: settings.pushplus_token.trim(),
        title,
        content,
        template: 'html',
      };
      if (settings.pushplus_topic?.trim()) {
        pushPayload.topic = settings.pushplus_topic.trim();
      }

      const res = await fetch('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pushPayload),
      });

      const data = await res.json();
      if (data.code === 200) {
        return { success: true, message: data.msg || 'PushPlus 微信强提醒推送成功' };
      } else {
        return { success: false, error: data.msg || `PushPlus 错误码: ${data.code}` };
      }
    }

    return { success: false, message: '未找到可用的微信推送配置' };
  } catch (err: any) {
    return { success: false, error: err?.message || '网络连接超时' };
  }
}

/**
 * 试听/测试 WxPusher 微信连通性
 */
export async function sendTestWxPusherNotification(
  appToken: string,
  uid?: string,
  topicId?: string,
  restaurantName?: string,
  tenantId = 'default'
) {
  // 详见测试端点实现，发送一条带时间的测试卡片并验证手机微信是否有清脆提示音
}
```

---

### 9.3 数据库字段与持久化契约

在 `settings` 表（或商户配置模型）中，沉淀以下标准化字段：

| 字段名称 | 类型 | 默认值 | 作用说明 |
| :--- | :--- | :--- | :--- |
| **`pushplus_enabled`** | `INTEGER` | `0` | 是否开启微信新订单强提醒（0 关闭，1 开启） |
| **`wechat_push_channel`** | `TEXT` | `'wxpusher'` | 当前选中的通道（`'wxpusher'` 或 `'pushplus'`） |
| **`wxpusher_app_token`** | `TEXT` | `''` | WxPusher 应用 AppToken（以 `AT_` 开头） |
| **`wxpusher_uid`** | `TEXT` | `''` | 接单员个人微信 UID（以 `UID_` 开头） |
| **`wxpusher_topic_id`** | `TEXT` | `''` | WxPusher 主题 TopicId（用于前台后厨多人响铃） |
| **`pushplus_token`** | `TEXT` | `''` | PushPlus 个人 Token（备用通道） |
| **`pushplus_topic`** | `TEXT` | `''` | PushPlus 群组编码（备用通道） |

---

### 9.4 1 分钟免实名极速配置实操（给商家的保姆级指引）

当给用户或客户上线系统时，直接提供这 4 步傻瓜式操作指南：

1. **扫码登录**：电脑或手机浏览器打开 **`https://wxpusher.zjiecode.com`**，点击右上角【管理后台】，用接单员微信扫一扫一键登录（无需账号密码，0 费用）；
2. **创建应用**：在左侧菜单点击【应用管理】➔【创建应用】，输入名称如“小店接单”，创建完成后复制 **【appToken】**（以 `AT_` 开头），填入点餐后台；
3. **扫码关注公众号**：在刚创建的应用详情中点击【关注应用二维码】，接单员微信扫码关注公众号；接着在左侧【用户管理】➔【用户列表】复制接单员的 **【UID】**（以 `UID_` 开头），填入点餐后台；
4. **一键测试听声音**：在后台点击 **【测试发送一条微信消息 (听声音)】**，接单员手机微信立刻弹出新单横幅并清脆响铃！最后点击【保存全部配置】大功告成！

---

### 9.5 实战避坑与架构约束

1. **ContentType 必须为 2**：WxPusher 发送 HTML 排版卡片时，`contentType` 参数必须显式传数字 `2`（1 为纯文本，2 为 HTML，3 为 Markdown）。
2. **uids 与 topicIds 格式校验**：`uids` 必须是字符串数组（`["UID_xxx"]`）；`topicIds` 必须转成整数数组（`[12345]`），如果传了纯字符串 ID 会导致接口返回参数解析错误。
3. **主线程安全旁路派发（Never Block Checkout）**：顾客提交订单或扫码支付成功后，推送微信通知必须与保存订单解耦，采用 `Promise.race([sendOrderPushPlusNotification, timeout(3500)])` 旁路派发。即便微信服务器或第三方网络波动，绝不卡死顾客的结账或下单应答！
4. **60 秒防重机制**：微信推送同样遵循 mynotice 60 秒订单号去重策略，避免网络重试或多处触发导致接单员手机微信连续被轰炸。


