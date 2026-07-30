let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  peakGain = 0.06
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playSendSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 620, now, 0.08, "sine", 0.05);
  tone(ctx, 880, now + 0.05, 0.08, "sine", 0.05);
}

export function playReceiveSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 523.25, now, 0.12, "sine", 0.06);
  tone(ctx, 659.25, now + 0.08, 0.14, "sine", 0.06);
  tone(ctx, 783.99, now + 0.16, 0.18, "sine", 0.05);
}

export function playErrorSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 220, now, 0.18, "sawtooth", 0.04);
  tone(ctx, 180, now + 0.12, 0.2, "sawtooth", 0.04);
}

let typingIntervalId: ReturnType<typeof setInterval> | null = null;

export function startTypingSound(): void {
  const ctx = getAudioContext();
  if (!ctx || typingIntervalId) return;

  const tick = () => {
    const c = getAudioContext();
    if (!c) return;
    const now = c.currentTime;
    const freq = 300 + Math.random() * 250;
    tone(c, freq, now, 0.035, "square", 0.015);
  };

  tick();
  typingIntervalId = setInterval(tick, 140);
}

export function stopTypingSound(): void {
  if (typingIntervalId) {
    clearInterval(typingIntervalId);
    typingIntervalId = null;
  }
}
