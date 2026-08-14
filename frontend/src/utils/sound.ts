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

// ---------------------------------------------------------------------------
// Sonidos del Easter Egg "Matrix" (elección de pastilla + splash de carga)
// Todo sintetizado con Web Audio API (osciladores/ruido), sin samples reales
// de la película: son un homenaje retro-consola a su atmósfera digital.
// ---------------------------------------------------------------------------

/** Blip corto y agresivo al pasar el mouse sobre la Pastilla Roja. */
export function playMatrixHoverRoja(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 130.81, now, 0.09, "sawtooth", 0.045);
  tone(ctx, 196, now + 0.05, 0.12, "sawtooth", 0.05);
  noiseSweep(ctx, now, 0.14, 0.02, 700, 2200);
}

/** Blip corto y cristalino al pasar el mouse sobre la Pastilla Azul. */
export function playMatrixHoverAzul(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 523.25, now, 0.08, "sine", 0.05);
  tone(ctx, 659.25, now + 0.04, 0.1, "sine", 0.045);
  tone(ctx, 987.77, now + 0.08, 0.14, "triangle", 0.03);
}

/** Barrido digital ascendente tipo "carga de sistema" al abrir la ventana de splash/carga de Matrix. */
export function playMatrixLoadingOpen(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [1, 2, 3, 4, 5].forEach((n, i) => {
    tone(ctx, 110 * n, now + i * 0.035, 0.1, "square", 0.03);
  });
  noiseSweep(ctx, now, 0.4, 0.025, 400, 3200);
}

let matrixMusicIntervalId: ReturnType<typeof setInterval> | null = null;
let matrixMusicStep = 0;

// Motivo menor grave, tipo consola de 8 bits, evocando la tensión del
// soundtrack de Matrix sin reproducir ninguna melodía real de la película.
const MATRIX_BASS_PATTERN = [55, 55, 58.27, 55, 51.91, 51.91, 55, 58.27];
const MATRIX_ARP_PATTERN = [220, 261.63, 293.66, 329.63, 293.66, 261.63, 220, 196];

/** Inicia el loop de "soundtrack" retro-consola durante la carga del easter egg Matrix. */
export function startMatrixLoadingMusic(): void {
  const ctx = getAudioContext();
  if (!ctx || matrixMusicIntervalId) return;
  const stepDuration = 0.16;
  matrixMusicStep = 0;

  const scheduleStep = () => {
    const c = getAudioContext();
    if (!c) return;
    const now = c.currentTime;
    const i = matrixMusicStep % MATRIX_BASS_PATTERN.length;

    tone(c, MATRIX_BASS_PATTERN[i], now, stepDuration * 0.9, "sawtooth", 0.045);

    if (matrixMusicStep % 2 === 0) {
      tone(c, MATRIX_ARP_PATTERN[i], now, stepDuration * 1.6, "square", 0.02);
    }

    if (matrixMusicStep % 4 === 0) {
      tone(c, 1760, now, 0.03, "square", 0.015);
    }

    matrixMusicStep += 1;
  };

  scheduleStep();
  matrixMusicIntervalId = setInterval(scheduleStep, stepDuration * 1000);
}

/** Detiene el loop de "soundtrack" retro-consola de Matrix. */
export function stopMatrixLoadingMusic(): void {
  if (matrixMusicIntervalId) {
    clearInterval(matrixMusicIntervalId);
    matrixMusicIntervalId = null;
  }
}

const MATRIX_RINGTONE_STEP_MS = 150;

// Frase corta y pegadiza tipo "ringtone" retro-consola en La menor: un
// arpegio ágil seguido de una pausa antes de repetirse, pensado para sonar
// de fondo (en rango audible, no un sub-bajo) mientras se permanece en la
// sección de Modo Matrix.
const MATRIX_RINGTONE_NOTES: { freq: number | null; steps: number }[] = [
  { freq: 220.0, steps: 1 }, // A3
  { freq: 329.63, steps: 1 }, // E4
  { freq: 440.0, steps: 1 }, // A4
  { freq: 329.63, steps: 1 }, // E4
  { freq: 261.63, steps: 1 }, // C4
  { freq: 329.63, steps: 1 }, // E4
  { freq: 220.0, steps: 2 }, // A3 sostenida
  { freq: null, steps: 3 }, // silencio antes de repetir
];

const MATRIX_RINGTONE_TOTAL_STEPS = MATRIX_RINGTONE_NOTES.reduce((sum, n) => sum + n.steps, 0);

function matrixRingtoneEventAt(step: number): { freq: number; durationSteps: number } | null {
  let acumulado = 0;
  for (const nota of MATRIX_RINGTONE_NOTES) {
    if (step === acumulado && nota.freq) {
      return { freq: nota.freq, durationSteps: nota.steps };
    }
    acumulado += nota.steps;
  }
  return null;
}

let matrixAmbientIntervalId: ReturnType<typeof setInterval> | null = null;
let matrixAmbientStep = 0;
let matrixAmbientStartedAt = 0;
let matrixAmbientMuted = false;

// El loop no suena parejo todo el tiempo: se escucha claro 10s, se apaga
// suavemente, queda en silencio un rato y vuelve a subir — así no satura
// al repetirse tan seguido. Ciclo completo: 10s full + 4s fade-out + 5s
// silencio + 4s fade-in = 23s, y vuelve a empezar.
const MATRIX_AMBIENT_FULL_MS = 10000;
const MATRIX_AMBIENT_FADE_MS = 4000;
const MATRIX_AMBIENT_SILENCE_MS = 5000;
const MATRIX_AMBIENT_CYCLE_MS =
  MATRIX_AMBIENT_FULL_MS + MATRIX_AMBIENT_FADE_MS + MATRIX_AMBIENT_SILENCE_MS + MATRIX_AMBIENT_FADE_MS;

function matrixAmbientEnvolvente(elapsedMs: number): number {
  const t = elapsedMs % MATRIX_AMBIENT_CYCLE_MS;
  if (t < MATRIX_AMBIENT_FULL_MS) return 1;
  if (t < MATRIX_AMBIENT_FULL_MS + MATRIX_AMBIENT_FADE_MS) {
    return 1 - (t - MATRIX_AMBIENT_FULL_MS) / MATRIX_AMBIENT_FADE_MS;
  }
  if (t < MATRIX_AMBIENT_FULL_MS + MATRIX_AMBIENT_FADE_MS + MATRIX_AMBIENT_SILENCE_MS) return 0;
  const tFadeIn = t - (MATRIX_AMBIENT_FULL_MS + MATRIX_AMBIENT_FADE_MS + MATRIX_AMBIENT_SILENCE_MS);
  return tFadeIn / MATRIX_AMBIENT_FADE_MS;
}

// "Ducking": baja el ambiente de forma gradual (no de golpe) mientras se ve
// el video de la mascota, y lo vuelve a subir igual de gradual al cerrarlo.
let matrixAmbientDuckActive = false;
let matrixAmbientDuckSince = 0;
const MATRIX_AMBIENT_DUCK_MS = 700;

function matrixAmbientDuckFactor(): number {
  const t = Math.min(1, (Date.now() - matrixAmbientDuckSince) / MATRIX_AMBIENT_DUCK_MS);
  return matrixAmbientDuckActive ? 1 - t : t;
}

/** Baja (o vuelve a subir) el volumen del ambiente de forma gradual, p. ej. mientras se ve un video encima. */
export function setMatrixAmbientDucking(active: boolean): void {
  if (matrixAmbientDuckActive === active) return;
  // Arranca la rampa desde donde haya quedado la anterior, no desde 0/1, para
  // que no se note un salto si se alterna rápido.
  const factorActual = matrixAmbientDuckFactor();
  const t0 = active ? 1 - factorActual : factorActual;
  matrixAmbientDuckSince = Date.now() - t0 * MATRIX_AMBIENT_DUCK_MS;
  matrixAmbientDuckActive = active;
}

/** Inicia el "ringtone" retro-consola de fondo de la sección Modo Matrix (una vez cargada). */
export function startMatrixAmbient(): void {
  const ctx = getAudioContext();
  if (!ctx || matrixAmbientIntervalId) return;
  matrixAmbientStep = 0;
  matrixAmbientStartedAt = Date.now();
  matrixAmbientMuted = false;
  matrixAmbientDuckActive = false;
  matrixAmbientDuckSince = 0;

  const scheduleStep = () => {
    const c = getAudioContext();
    if (!c) return;
    const evento = matrixRingtoneEventAt(matrixAmbientStep);

    if (evento && !matrixAmbientMuted) {
      const escala = matrixAmbientEnvolvente(Date.now() - matrixAmbientStartedAt) * matrixAmbientDuckFactor();
      if (escala > 0.01) {
        const now = c.currentTime;
        const duracion = (evento.durationSteps * MATRIX_RINGTONE_STEP_MS) / 1000;
        tone(c, evento.freq, now, duracion * 0.92, "square", 0.08 * escala);
        tone(c, evento.freq / 2, now, duracion * 0.92, "triangle", 0.035 * escala);
      }
    }

    matrixAmbientStep = (matrixAmbientStep + 1) % MATRIX_RINGTONE_TOTAL_STEPS;
  };

  scheduleStep();
  matrixAmbientIntervalId = setInterval(scheduleStep, MATRIX_RINGTONE_STEP_MS);
}

/** Detiene el zumbido ambiental de fondo de la sección Modo Matrix. */
export function stopMatrixAmbient(): void {
  if (matrixAmbientIntervalId) {
    clearInterval(matrixAmbientIntervalId);
    matrixAmbientIntervalId = null;
  }
}

/** Silencia/reactiva manualmente el "ringtone" de fondo sin detener el loop (mantiene el ritmo). */
export function setMatrixAmbientMuted(muted: boolean): void {
  matrixAmbientMuted = muted;
}

// ---------------------------------------------------------------------------
// Sonido del loop de espera ("elige la pastilla") del preview de la mascota
// ---------------------------------------------------------------------------

let matrixChoiceIdleIntervalId: ReturnType<typeof setInterval> | null = null;
let matrixChoiceIdleStep = 0;
let matrixChoiceIdleMuted = false;

const MATRIX_CHOICE_IDLE_STEP_MS = 1900;

/**
 * Pulso suave y pausado, alternando entre un tono cálido (pastilla roja) y
 * uno frío (pastilla azul), como un "sonar" tipo consola retro — para que el
 * loop silencioso de la mascota ofreciendo las pastillas no se sienta vacío.
 */
export function startMatrixChoiceIdle(): void {
  const ctx = getAudioContext();
  if (!ctx || matrixChoiceIdleIntervalId) return;
  matrixChoiceIdleStep = 0;

  const scheduleStep = () => {
    const c = getAudioContext();
    if (!c || matrixChoiceIdleMuted) {
      matrixChoiceIdleStep += 1;
      return;
    }
    const now = c.currentTime;
    const esRoja = matrixChoiceIdleStep % 2 === 0;
    bellTone(c, esRoja ? 246.94 : 369.99, now, 0.55, 0.045);
    noiseSweep(c, now, 0.28, 0.014, esRoja ? 850 : 1300, esRoja ? 1500 : 2200);
    matrixChoiceIdleStep += 1;
  };

  scheduleStep();
  matrixChoiceIdleIntervalId = setInterval(scheduleStep, MATRIX_CHOICE_IDLE_STEP_MS);
}

/** Detiene el pulso del loop de espera de la mascota. */
export function stopMatrixChoiceIdle(): void {
  if (matrixChoiceIdleIntervalId) {
    clearInterval(matrixChoiceIdleIntervalId);
    matrixChoiceIdleIntervalId = null;
  }
}

/** Silencia/reactiva el pulso del loop de espera sin cortar el ritmo. */
export function setMatrixChoiceIdleMuted(muted: boolean): void {
  matrixChoiceIdleMuted = muted;
}
