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

export function isAudioReady(): boolean {
  if (!audioContext) return false;
  return audioContext.state === 'running' && isAudioUnlocked;
}

/**
 * 激活/解锁音频上下文（支持在任意点击、触摸、登录等手势中调用）
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
 * 播放清脆响亮的餐饮接单提示音（五音连和弦：C5 -> E5 -> G5 -> C6 -> E6）
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

    // 清脆高亮和弦音阶 (频率 Hz, 延迟偏移 s, 持续 s, 增益音量)
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

      osc.type = 'triangle';
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
    console.warn('Failed to play synthesized chime:', err);
  }
}

/**
 * 中文实时语音播报
 */
export function speakNewOrder(text: string = '您有新的订餐订单，请及时处理！'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel(); // 清理残留未播队列

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    // 智能选择最优质的普通话中文语音
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
      // ignore voice selection error
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
    console.warn('Speech synthesis failed:', err);
  }
}

/**
 * 移动端震动提醒
 */
export function triggerVibration(): void {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }
}

/**
 * 完整新订单告警：和弦蜂鸣 + 中文语音播报 + 触觉震动
 */
export async function alertNewOrder(orderCount: number = 1, extraText?: string): Promise<void> {
  unlockAudio();
  await playOrderChime();
  triggerVibration();

  const msg = extraText
    ? `您有新的订餐订单，${extraText}，请及时处理`
    : orderCount > 1
      ? `您有${orderCount}笔新的订餐订单，请及时处理`
      : '您有新的订餐订单，请及时处理';

  // 和弦蜂鸣完毕后接续中文语音播报，听觉清晰舒适
  setTimeout(() => {
    speakNewOrder(msg);
  }, 450);
}
