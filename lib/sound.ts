// lib/sound.ts
let audioContext: AudioContext | null = null;
let isAudioUnlocked = false;

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

// Call on any user gesture (touch, click, login submit) to unlock audio on mobile
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => {
        isAudioUnlocked = true;
      })
      .catch(() => {});
  } else {
    isAudioUnlocked = true;
  }

  // Play a silent 1-sample buffer to satisfy iOS WebKit autoplay policy
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore
  }
}

// Play loud, crisp restaurant order chime (harmonic tones)
export function playOrderChime(): void {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  try {
    const now = ctx.currentTime;

    // Four bell chime progression: C5 -> E5 -> G5 -> C6 -> E6
    const notes = [
      { freq: 523.25, time: 0, dur: 0.18, gain: 0.5 },
      { freq: 659.25, time: 0.12, dur: 0.18, gain: 0.55 },
      { freq: 783.99, time: 0.24, dur: 0.18, gain: 0.6 },
      { freq: 1046.5, time: 0.36, dur: 0.45, gain: 0.7 },
      { freq: 1318.51, time: 0.55, dur: 0.4, gain: 0.55 },
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

// Play voice broadcast in Chinese
export function speakNewOrder(text: string = '您有新的订餐订单，请及时处理！'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel(); // cancel any stale speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
  }
}

// Mobile vibration
export function triggerVibration(): void {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }
}

// Full alert: chime + voice + vibration
export function alertNewOrder(orderCount: number = 1, extraText?: string): void {
  unlockAudio();
  playOrderChime();
  triggerVibration();

  const msg = extraText
    ? `您有新的订餐订单，${extraText}，请及时处理`
    : orderCount > 1
      ? `您有${orderCount}笔新的订餐订单，请及时处理`
      : '您有新的订餐订单，请及时处理';

  // Slight delay so the chime plays first, followed by voice
  setTimeout(() => {
    speakNewOrder(msg);
  }, 400);
}
