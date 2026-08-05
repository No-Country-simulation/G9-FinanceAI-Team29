import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface WelcomeSplashProps {
  nombreCompleto?: string | null;
  email?: string | null;
  /** true cuando los datos ya cargaron y el splash puede empezar a salir. */
  datosListos?: boolean;
  /** Se llama cuando termina la animación de salida, recién ahí conviene desmontar el componente. */
  onSalidaCompleta?: () => void;
}

const MASCOT_VIDEO_SRC = "/images/mascot/welcome-sound.webm";
const MASCOT_LOADING_IMAGE_SRC = "/images/mascot/finsight-bird-loading.png";
const MASCOT_MUSIC_SRC = "/images/mascot/Terrace_Palms.mp3";
const MASCOT_MUSIC_VOLUME = 0.10;
const SALIDA_DURACION_MS = 500;

// Baja el volumen del media gradualmente hasta 0 y recién ahí lo pausa, para
// que el sonido no corte seco justo cuando la pantalla empieza a desvanecerse.
function apagarConFade(el: HTMLMediaElement | null, duracionMs: number) {
  if (!el || el.paused) return;

  const volumenInicial = el.volume;
  const inicio = performance.now();

  function paso(ahora: number) {
    const progreso = Math.min((ahora - inicio) / duracionMs, 1);
    el!.volume = volumenInicial * (1 - progreso);

    if (progreso < 1) {
      requestAnimationFrame(paso);
    } else {
      el!.pause();
    }
  }

  requestAnimationFrame(paso);
}

const FRASES_BIENVENIDA = [
  "Ver más allá de tus finanzas",
  "Tu copiloto financiero con IA",
  "Decisiones más inteligentes, cada día",
  "Tus finanzas, más claras que nunca",
  "Convirtiendo tus datos en decisiones",
  "El análisis financiero que te mereces",
  "Ahorrar y crecer, con inteligencia artificial",
  "Tu asistente para una vida financiera sana",
  "Insights financieros a un clic de distancia",
  "Cuidando tu bolsillo con IA",
];

function elegirFraseAleatoria(): string {
  const indice = Math.floor(Math.random() * FRASES_BIENVENIDA.length);
  return FRASES_BIENVENIDA[indice];
}

function nombreDesdeEmail(valor?: string | null): string {
  if (!valor) return "";

  const base = valor.trim().split("@")[0];
  const normalizado = base.replace(/[._-]+/g, " ").trim();
  if (!normalizado) return "";

  return normalizado
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
}

function capitalizarNombreCompleto(valor: string): string {
  return valor
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(" ");
}

export default function WelcomeSplash({
  nombreCompleto,
  email,
  datosListos = false,
  onSalidaCompleta,
}: WelcomeSplashProps) {
  const saludo = useMemo(() => {
    const nombreLimpio = nombreCompleto?.trim();
    if (nombreLimpio) return capitalizarNombreCompleto(nombreLimpio);

    return nombreDesdeEmail(email);
  }, [nombreCompleto, email]);

  const frase = useMemo(() => elegirFraseAleatoria(), []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoTerminado, setVideoTerminado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const onSalidaCompletaRef = useRef(onSalidaCompleta);
  useEffect(() => {
    onSalidaCompletaRef.current = onSalidaCompleta;
  }, [onSalidaCompleta]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Intentamos reproducir con el audio (diálogo + sonidos del pájaro).
    // Algunos navegadores bloquean el autoplay con sonido: si lo rechazan,
    // reintentamos silenciado para no perder al menos la animación.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });

    const audio = audioRef.current;
    if (audio) {
      audio.volume = MASCOT_MUSIC_VOLUME;
      audio.play().catch(() => {});
    }

    return () => {
      audio?.pause();
    };
  }, []);

  // Cuando el padre avisa que ya hay datos, arrancamos la salida: video y
  // música bajan de volumen en simultáneo con el fade visual, y recién al
  // terminar le devolvemos el control al padre para que desmonte el splash.
  useEffect(() => {
    if (!datosListos) return;

    setSaliendo(true);
    apagarConFade(videoRef.current, SALIDA_DURACION_MS);
    apagarConFade(audioRef.current, SALIDA_DURACION_MS);

    const timer = setTimeout(() => {
      onSalidaCompletaRef.current?.();
    }, SALIDA_DURACION_MS);

    return () => clearTimeout(timer);
  }, [datosListos]);

  const contenido = (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-white via-brand-50 to-brand-100 transition-opacity duration-500 ease-in-out dark:from-gray-950 dark:via-gray-900 dark:to-brand-950 ${
        saliendo ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-[10%] top-[16%] animate-welcome-float text-3xl opacity-40 drop-shadow-none [animation-duration:5s] dark:opacity-80 dark:drop-shadow-[0_0_10px_rgba(147,197,253,0.5)]">
          💹
        </span>
        <span className="absolute right-[12%] top-[22%] animate-welcome-float text-3xl opacity-30 [animation-delay:.6s] [animation-duration:4.2s] dark:opacity-70 dark:drop-shadow-[0_0_10px_rgba(147,197,253,0.45)]">
          💰
        </span>
        <span className="absolute left-[16%] bottom-[20%] animate-welcome-float text-2xl opacity-30 [animation-delay:1.2s] [animation-duration:4.8s] dark:opacity-70 dark:drop-shadow-[0_0_8px_rgba(147,197,253,0.45)]">
          📈
        </span>
        <span className="absolute right-[15%] bottom-[16%] animate-welcome-float text-2xl opacity-40 [animation-delay:.3s] [animation-duration:5.4s] dark:opacity-80 dark:drop-shadow-[0_0_8px_rgba(147,197,253,0.5)]">
          🪙
        </span>
        <span className="absolute left-[6%] top-[52%] animate-welcome-float text-2xl opacity-25 [animation-delay:1.7s] [animation-duration:5.8s] dark:opacity-65 dark:drop-shadow-[0_0_8px_rgba(147,197,253,0.4)]">
          🏦
        </span>
        <span className="absolute right-[7%] top-[58%] animate-welcome-float text-2xl opacity-25 [animation-delay:.9s] [animation-duration:5s] dark:opacity-65 dark:drop-shadow-[0_0_8px_rgba(147,197,253,0.4)]">
          🔒
        </span>
      </div>

      <div className="relative flex h-80 w-80 items-center justify-center sm:h-96 sm:w-96 lg:h-[28rem] lg:w-[28rem] xl:h-[32rem] xl:w-[32rem]">
        {/* resplandor detrás del mascote, para que no quede flotando en un fondo vacío */}
        <div className="absolute inset-6 -z-10 animate-welcome-glow-pulse rounded-full bg-brand-400/40 blur-3xl dark:bg-brand-400/30" />

        {/* anillos de pulso expandiéndose hacia afuera, como una señal financiera */}
        <div className="absolute inset-10 rounded-full border-2 border-brand-400/60 animate-welcome-ping-ring dark:border-brand-400/50" />
        <div className="absolute inset-10 rounded-full border-2 border-brand-400/60 animate-welcome-ping-ring [animation-delay:0.9s] dark:border-brand-400/50" />
        <div className="absolute inset-10 rounded-full border-2 border-brand-400/60 animate-welcome-ping-ring [animation-delay:1.8s] dark:border-brand-400/50" />

        {/* órbita externa lenta */}
        <div className="absolute inset-0 animate-welcome-orbit-cw [animation-duration:22s]">
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 animate-welcome-orbit-ccw text-2xl [animation-duration:22s]">
            💵
          </span>
        </div>
        <div className="absolute inset-0 animate-welcome-orbit-cw [animation-delay:-11s] [animation-duration:22s]">
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 animate-welcome-orbit-ccw text-2xl [animation-delay:-11s] [animation-duration:22s]">
            📊
          </span>
        </div>

        {/* órbita interna, más rápida y en sentido contrario */}
        <div className="absolute inset-8 animate-welcome-orbit-ccw [animation-duration:14s]">
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 animate-welcome-orbit-cw text-xl [animation-duration:14s]">
            💳
          </span>
        </div>
        <div className="absolute inset-8 animate-welcome-orbit-ccw [animation-delay:-7s] [animation-duration:14s]">
          <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 animate-welcome-orbit-cw text-xl [animation-delay:-7s] [animation-duration:14s]">
            🧾
          </span>
        </div>

        {/* destellos titilantes */}
        <span className="absolute left-8 top-14 text-lg animate-welcome-twinkle [animation-duration:2.2s]">
          ✨
        </span>
        <span className="absolute right-10 top-20 text-sm animate-welcome-twinkle [animation-delay:.5s] [animation-duration:1.8s]">
          ✨
        </span>
        <span className="absolute bottom-14 left-12 text-sm animate-welcome-twinkle [animation-delay:1s] [animation-duration:2.6s]">
          ✨
        </span>
        <span className="absolute bottom-16 right-10 text-lg animate-welcome-twinkle [animation-delay:1.4s] [animation-duration:2s]">
          ✨
        </span>

        <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64 lg:h-72 lg:w-72 xl:h-80 xl:w-80">
          <div className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(from_0deg,#9cb9ff,#465fff,#2a31d8,#9cb9ff)] opacity-70 [animation-duration:6s]" />
          <div className="absolute inset-[6px] rounded-full bg-black" />
          <div className="absolute inset-[6px] animate-pulse rounded-full ring-4 ring-brand-400/40 dark:ring-brand-500/30" />
          <div className="absolute inset-[14px] overflow-hidden rounded-full border-4 border-white shadow-lg dark:border-gray-900">
            {videoTerminado ? (
              <img
                src={MASCOT_LOADING_IMAGE_SRC}
                alt="Finsi esperando a que termine de cargar tu información"
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                src={MASCOT_VIDEO_SRC}
                autoPlay
                playsInline
                onEnded={() => setVideoTerminado(true)}
              />
            )}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={MASCOT_MUSIC_SRC} loop className="hidden" />

      <div className="relative mt-8 px-6 text-center">
        <h1 className="animate-welcome-fade-up text-2xl font-semibold text-gray-800 dark:text-white/90 sm:text-3xl">
          {saludo ? <>¡Bienvenido, {saludo} a</> : "¡Bienvenido a"}{" "}
          <span className="whitespace-nowrap">
            <span
              className="[-webkit-text-stroke:1px_#000] text-[#092e63] dark:text-white"
              style={{ paintOrder: "stroke fill" }}
            >
              FinSight
            </span>
            <span
              className="[-webkit-text-stroke:1px_#000] text-[#6dc74b]"
              style={{ paintOrder: "stroke fill" }}
            >
              AI
            </span>
            !
          </span>
        </h1>
        <p className="animate-welcome-fade-up mt-2 text-base text-brand-500 [animation-delay:.2s] dark:text-brand-400 sm:text-lg">
          {frase}
        </p>
      </div>

      <div className="relative mt-8 flex animate-welcome-fade-up items-center gap-2 [animation-delay:.4s]">
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:-.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" />
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 2147483647 }}>
      {contenido}
    </div>,
    document.body,
  );
}
