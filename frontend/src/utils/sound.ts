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

function noiseSweep(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  peakGain = 0.04,
  freqFrom = 1800,
  freqTo = 5200
) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(freqFrom, startTime);
  filter.frequency.linearRampToValueAtTime(freqTo, startTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.02);
}

/** Campanita cálida y ascendente al abrir el modal de bienvenida del recorrido. */
export function playWelcomeChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 659.25, now, 0.32, "sine", 0.09);
  tone(ctx, 987.77, now + 0.09, 0.36, "sine", 0.08);
  tone(ctx, 1318.51, now + 0.18, 0.4, "sine", 0.06);
}

/** Barrido suave al iniciar el recorrido guiado. */
export function playTourStart(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  noiseSweep(ctx, now, 0.22, 0.035);
  tone(ctx, 392, now, 0.18, "triangle", 0.06);
  tone(ctx, 587.33, now + 0.08, 0.22, "triangle", 0.07);
}

/** Clic corto tipo "pop" para los botones Siguiente / Anterior. */
export function playStepClick(direction: "forward" | "back" = "forward"): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freq = direction === "forward" ? 720 : 540;
  tone(ctx, freq, now, 0.1, "sine", 0.08);
  tone(ctx, freq * 1.5, now + 0.02, 0.08, "sine", 0.03);
}

/** Sonido de "resorte" cuando el ítem del menú se resalta al abrir el siguiente paso. */
export function playMenuHighlight(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 880, now, 0.09, "triangle", 0.05);
  noiseSweep(ctx, now, 0.14, 0.02, 2400, 3600);
}

/** Aparición del recuadro de foco (spotlight) sobre el nuevo elemento. */
export function playReveal(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 493.88, now, 0.16, "sine", 0.06);
  tone(ctx, 740, now + 0.05, 0.18, "sine", 0.05);
}

/** Arpegio ascendente de éxito al finalizar el recorrido. */
export function playTourComplete(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
    tone(ctx, freq, now + index * 0.09, 0.28, "sine", 0.08);
  });
}

/** Tono descendente y breve al cerrar o saltar el recorrido. */
export function playDismiss(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 587.33, now, 0.14, "sine", 0.06);
  tone(ctx, 392, now + 0.06, 0.18, "sine", 0.05);
}

/** Nota tipo "campana": fundamental + un par de armónicos suaves, para un timbre más brillante que un tono puro. */
function bellTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  peakGain = 0.08
) {
  tone(ctx, freq, startTime, duration, "sine", peakGain);
  tone(ctx, freq * 2.005, startTime, duration * 0.7, "sine", peakGain * 0.28);
  tone(ctx, freq * 3.011, startTime, duration * 0.45, "triangle", peakGain * 0.12);
}

/**
 * Arpegio ascendente tipo "logro desbloqueado" (estilo Xbox 360): una cascada
 * de campanitas que sube de tono y termina con un brillo agudo sostenido.
 */
export function playAchievementUnlock(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notas = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 - E5 - G5 - C6 - E6

  notas.forEach((freq, i) => {
    const start = now + i * 0.075;
    const duracion = i === notas.length - 1 ? 0.6 : 0.22;
    const ganancia = i === notas.length - 1 ? 0.11 : 0.09;
    bellTone(ctx, freq, start, duracion, ganancia);
  });

  const brilloStart = now + (notas.length - 1) * 0.075 + 0.03;
  bellTone(ctx, notas[notas.length - 1] * 2, brilloStart, 0.5, 0.035);
}

/** Tono corto y descendente al desaparecer el toast de "logro desbloqueado" — distinto de la fanfarria de entrada. */
export function playAchievementDismiss(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 659.25, now, 0.1, "sine", 0.05);
  tone(ctx, 440, now + 0.05, 0.16, "sine", 0.04);
}

// ---------------------------------------------------------------------------
// Sonidos de la Trivia financiera (ruleta de categorías)
// ---------------------------------------------------------------------------

/** Golpe corto y percusivo, como el "clic" de una rueda de premios girando. */
function clickPercusivo(ctx: AudioContext, startTime: number, freq: number, peakGain = 0.05) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.035);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + 0.04);
}

/** Fanfarria breve y animada al presionar "Jugar trivia de hoy". */
export function playTriviaStart(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 523.25, now, 0.12, "triangle", 0.07);
  tone(ctx, 659.25, now + 0.07, 0.12, "triangle", 0.07);
  tone(ctx, 987.77, now + 0.14, 0.22, "triangle", 0.08);
}

/** Un solo "clic" de la ruleta girando; se llama en cada tick del sorteo. */
export function playWheelTick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  clickPercusivo(ctx, ctx.currentTime, 900 + Math.random() * 200, 0.045);
}

/** Frenado de la ruleta al aterrizar en la categoría elegida. */
export function playWheelStop(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  clickPercusivo(ctx, now, 500, 0.06);
  tone(ctx, 349.23, now + 0.02, 0.22, "triangle", 0.07);
  tone(ctx, 261.63, now + 0.09, 0.28, "sine", 0.06);
}

/** Ding positivo al elegir la respuesta correcta. */
export function playTriviaCorrect(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 587.33, now, 0.1, "sine", 0.07);
  tone(ctx, 880, now + 0.06, 0.2, "sine", 0.08);
}

/** Zumbido corto y grave al elegir una respuesta incorrecta. */
export function playTriviaWrong(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 233.08, now, 0.16, "sawtooth", 0.05);
  tone(ctx, 196, now + 0.1, 0.22, "sawtooth", 0.05);
}

/** Fanfarria triunfal al terminar la trivia con puntaje perfecto. */
export function playTriviaFinishPerfecto(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notas = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notas.forEach((freq, i) => {
    const start = now + i * 0.08;
    const duracion = i === notas.length - 1 ? 0.55 : 0.22;
    const ganancia = i === notas.length - 1 ? 0.1 : 0.08;
    bellTone(ctx, freq, start, duracion, ganancia);
  });
}

/** Acorde cálido y satisfecho al terminar con buen puntaje. */
export function playTriviaFinishBien(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 523.25, now, 0.18, "sine", 0.07);
  tone(ctx, 659.25, now + 0.05, 0.2, "sine", 0.07);
  tone(ctx, 783.99, now + 0.1, 0.3, "sine", 0.06);
}

/** Tono suave y alentador al terminar con puntaje bajo, sin sonar negativo. */
export function playTriviaFinishPractica(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 440, now, 0.18, "sine", 0.06);
  tone(ctx, 493.88, now + 0.12, 0.26, "sine", 0.06);
}
