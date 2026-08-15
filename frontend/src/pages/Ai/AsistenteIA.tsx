import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PromptComposer from "../../components/ai/PromptComposer";
import { PlusIcon, ChatIcon, BoltIcon, TrashBinIcon, CloseIcon } from "../../icons";
import { mostrarError } from "../../utils/alerts";
import { preguntarAgenteStream } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useGamification } from "../../context/GamificationContext";
import { detectarLogroEnRespuesta } from "../../utils/achievements";
import { speakText, stopSpeaking, isSpeechSupported } from "../../utils/speech";
import { playSendSound, playReceiveSound, playErrorSound, startTypingSound, stopTypingSound } from "../../utils/sound";
import { renderMensajeAsistente } from "../../utils/renderMensajeAsistente";
import { setAgentTabStatus } from "../../utils/tabTitle";
import { detenerOtrosEasterEggs, registrarEasterEgg } from "../../utils/easterEggPlayback";
import {
  esErrorSinDatos,
  MENSAJE_SIN_DATOS,
  MENSAJE_OTRA_CONSULTA,
  construirMensajeDespedida,
} from "../../utils/sinDatosFlow";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../../components/ui/modal";
import TeamModalContent from "../../components/team/TeamModalContent";
import TeamAuroraBackdrop from "../../components/team/TeamAuroraBackdrop";

type PasoInteractivo = "sin-datos" | "otra-consulta" | "support-help" | "team-info" | null;

const REGEX_RESPUESTA_CREADOR = /twentyninedevs es el equipo de desarrolladores que cre[oó] finsightai/i;
const MENSAJE_CON_QUE_SEGUIMOS = "¿Con qué seguimos?";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  isHistory?: boolean;
}

interface ChatGuardado {
  id: string;
  titulo: string;
  messages: Message[];
  actualizadoEn: number;
}

const CHATS_STORAGE_KEY = (usuarioId: string) => `finsight:asistente:chats:${usuarioId}`;
const MAX_CHATS_GUARDADOS = 20;
const MASCOTA_SRC = "/images/mascot/finsight-bird-v2.png";

const MODELOS_ASISTENTE = ["FinSightAI Advisor", "Soporte técnico"];

const CONTEXTO_FINANCIERO_INTERNO =
  /<!--\s\*finsi-financial-context\s+metric=(?:income|expense|unknown)\s+granularity=(?:year|month|rank|other)\s+year=(?:\d{4}|none)\s+month=(?:\d{1,2}|none)\s+position=(?:\d+|none)\s\*-->/gi;

const GOAL_DRAFT_INTERNO =
  /\\?<!--\s*finsi-goal-draft\s+name=.*?\s*\|\s*amount=.*?\s*\|\s*date=.*?\s*-->/gi;

function limpiarMetadataInterna(texto: string): string {
  return texto
    .replace(CONTEXTO_FINANCIERO_INTERNO, "")
    .replace(GOAL_DRAFT_INTERNO, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Easter egg: si el usuario repite la misma pregunta dos veces seguidas, se le
// muestra el rickroll sin pasar por el backend. Mismo texto que el easter egg
// "rickroll" de AI-Service/app/services/agent/easter_eggs.py.
const RESPUESTA_RICKROLL_REPETIDA =
  "😏 You just got Rickrolled. Classic.\n\n!audio[rickroll](/images/task/rickroll.mp3)";

function normalizarPreguntaParaComparar(texto: string): string {
  return texto.trim().toLowerCase();
}

const MENSAJE_EXPLICAME_MAS = "Explícame más";

const MENSAJE_DESCANSO =
  "🔥 Llevas un rato por aquí. Descansa junto a la hoguera.\n\n!audio[descanso](/images/task/descanso.mp3)";

function puedeMostrarExplicameMas(texto: string): boolean {
  const limpio = texto.trim();

  if (!limpio || limpio.length < 80) {
    return false;
  }

  // Algunas respuestas informativas pueden venir precedidas por el saludo de Finsi.
  // Quitamos solo ese prefijo para decidir si el contenido real merece "Explícame más".
  // Así un saludo puro sigue sin mostrar el botón, pero "Hola... + explicación de Bitcoin" sí.
  const contenidoSinSaludo = limpio
    .replace(
      /^👋?\s*Hola,\s*soy\s+\*\*?Finsi\*\*?,?\s*el asistente de FinSightAI\.\s*Puedo ayudarte a entender tus finanzas y a resolver dudas sobre la aplicación\.\s*/i,
      "",
    )
    .trim();

  const contenidoEvaluado = contenidoSinSaludo || limpio;

  // No mostrar "Explícame más" en saludos, cierres ni respuestas
  // conversacionales simples: el botón está pensado para contenido
  // informativo/financiero que realmente pueda ampliarse.
  const respuestaConversacional = (
    /^👋?\s*hola[,!.\s]/i.test(contenidoEvaluado) ||
    /^hola[,!.\s]/i.test(contenidoEvaluado) ||
    /^¡?hola[,!.\s]/i.test(contenidoEvaluado) ||
    /soy\s+\*\*?finsi\*\*?,?\s+el asistente de finsightai/i.test(contenidoEvaluado) ||
    /^¿En qué puedo ayudarte hoy\?$/i.test(contenidoEvaluado) ||
    /^¿En qué más puedo ayudarte\?$/i.test(contenidoEvaluado) ||
    /Para preguntas de soporte, en el selector de abajo/i.test(contenidoEvaluado) ||
    /Para preguntas financieras, en el selector de abajo/i.test(contenidoEvaluado) ||
    /^¡?perfecto!/i.test(contenidoEvaluado) ||
    /^¡?genial!/i.test(contenidoEvaluado) ||
    /^de acuerdo[.!]/i.test(contenidoEvaluado) ||
    /^gracias\b/i.test(contenidoEvaluado)
  );

  if (respuestaConversacional) {
    return false;
  }

  const respuestasInteractivas = (
    /¿Puedo ayudarte con algo más\?/i.test(limpio) ||
    /¿Quieres que (?:cree|analice|te ayude|prepare)/i.test(limpio) ||
    /¿Deseas que (?:cree|analice|te ayude|prepare)/i.test(limpio) ||
    /¿Confirmas que/i.test(limpio) ||
    /¿Qué quieres conseguir con esta meta\?/i.test(limpio) ||
    /¿Cuánto dinero necesitas para alcanzarla\?/i.test(limpio) ||
    /¿Para qué fecha te gustaría alcanzar esta meta\?/i.test(limpio) ||
    /Responde \*\*Sí\*\*/i.test(limpio) ||
    /\[\[finsi-terminal-demo\]\]/i.test(limpio)
  );

  return !respuestasInteractivas;
}

type EasterEggVisual = "kenobi" | "yoda" | "matrix" | "got" | "wololo1" | "wololo2" | "descanso" | "rickroll" | "isengard" | "albion" | "hello_world" | "mongolia" | "infinite_money" | "ctrl_z_gastos" | "finsi_walking" | "finsi_crypto" | null;

function detectarEasterEggVisual(texto: string): EasterEggVisual {
  if (texto.includes("!audio[general-kenobi]") || /\bGeneral Kenobi\./i.test(texto)) {
    return "kenobi";
  }

  if (texto.includes("!audio[yoda]") || /Do or do not\. There is no try\./i.test(texto)) {
    return "yoda";
  }

  if (texto.includes("!audio[matrix-pill]") || /pastilla roja\.\.\. y te muestro/i.test(texto)) {
    return "matrix";
  }

  if (texto.includes("!audio[got-winter]") || /El invierno se acerca\./i.test(texto)) {
    return "got";
  }
  
  if (texto.includes("!audio[wololo-1]")) {
    return "wololo1";
  }

  if (texto.includes("!audio[wololo-2]")) {
    return "wololo2";
  }

  if (texto.includes("!audio[descanso]") || /Descansa junto a la hoguera/i.test(texto)) {
    return "descanso";
  }

  if (texto.includes("!audio[rickroll]") || /You just got Rickrolled/i.test(texto)) {
    return "rickroll";
  }

  if (texto.includes("!audio[isengard]") || /hobbits to Isengard/i.test(texto)) {
    return "isengard";
  }

  if (texto.includes("!audio[albion]")) {
    return "albion";
  }

  if (texto.includes("!audio[hello-world]")) {
    return "hello_world";
  }

  if (
  texto.includes("!audio[mongolia]") ||
  /DE MONGOLIA SOY!/i.test(texto)
) {
  return "mongolia";
}

  if (texto.includes("!audio[infinite-money]")) {
  return "infinite_money";
}

if (texto.includes("!audio[ctrl-z-gastos]")) {
  return "ctrl_z_gastos";
}

  if (texto.includes("!audio[finsi-walking]")) {
    return "finsi_walking";
  }

  if (texto.includes("!audio[finsi-walking]")) {
  return "finsi_walking";
}

if (texto.includes("!audio[finsi-crypto]")) {
  return "finsi_crypto";
}

  return null;
}

const EASTER_EGG_VISUAL_ASSETS: Record<
  Exclude<EasterEggVisual, null>,
  { src: string; poster: string; durationMs: number; border: string }
> = {
  kenobi: {
    src: "/images/task/finsi-kenobi.webp",
    poster: "/images/task/finsi-kenobi-poster.webp",
    durationMs: 4000,
    border: "border-sky-300/60",
  },
  yoda: {
    src: "/images/task/finsi-yoda.webp",
    poster: "/images/task/finsi-yoda-poster.webp",
    durationMs: 6000,
    border: "border-emerald-300/60",
  },
  matrix: {
    src: "/images/task/finsi-matrix.webp",
    poster: "/images/task/finsi-matrix-poster.webp",
    durationMs: 10000,
    border: "border-violet-400/60",
  },
  got: {
    src: "/images/task/finsi-got.webp",
    poster: "/images/task/finsi-got-poster.webp",
    durationMs: 10000,
    border: "border-slate-400/60",
  },
  wololo1: {
    src: "/images/task/wololo.webp",
    poster: "/images/task/wololo-poster.webp",
    durationMs: 4600,
    border: "border-red-400/60",
  },
  wololo2: {
    src: "/images/task/wololo-2.webp",
    poster: "/images/task/wololo-2-poster.webp",
    durationMs: 9900,
    border: "border-red-400/60",
  },
  descanso: {
    src: "/images/task/descanso.webp",
    poster: "/images/task/descanso-poster.webp",
    durationMs: 18090,
    border: "border-amber-400/60",
  },
  rickroll: {
    src: "/images/task/rickroll.webp",
    poster: "/images/task/rickroll-poster.webp",
    durationMs: 8000,
    border: "border-pink-400/60",
  },
  isengard: {
    src: "/images/task/isengard.webp",
    poster: "/images/task/isengard-poster.webp",
    durationMs: 8000,
    border: "border-emerald-400/60",
  },
  albion: {
    src: "/images/task/albion.webp",
    poster: "/images/task/albion-poster.webp",
    durationMs: 19900,
    border: "border-orange-400/60",
  },
  hello_world: {
    src: "/images/task/hello_world.webp",
    poster: "/images/task/hello_world-poster.webp",
    durationMs: 9900,
    border: "border-lime-400/60",
  },
  mongolia: {
    src: "/images/task/mongol.webp",
    poster: "/images/task/mongol-poster.webp",
    durationMs: 17000,
    border: "border-sky-300/60",
},
  infinite_money: {
  src: "/images/task/infinite-money.webp",
  poster: "/images/task/infinite-money-poster.webp",
  durationMs: 10000,
  border: "border-emerald-300/60",
},

ctrl_z_gastos: {
  src: "/images/task/ctrl-z-gastos.webp",
  poster: "/images/task/ctrl-z-gastos-poster.webp",
  durationMs: 10000,
  border: "border-red-300/60",
},

  finsi_walking: {
    src: "/images/task/finsi-walking.webp",
    poster: "/images/task/finsi-walking-poster.webp",
    durationMs: 8000,
    border: "border-sky-300/60",
  },


  finsi_crypto: {
    src: "/images/task/finsi-crypto.webp",
    poster: "/images/task/finsi-crypto-poster.webp",
    durationMs: 10000,
    border: "border-yellow-300/60",
  },

};  


const GOT_TITLE_LINES = ["WINTER IS", "COMING"];

const GOT_NUBES = [
  { top: "14%", width: "42vw", duration: "34s", delay: "0s", opacity: 0.55 },
  { top: "30%", width: "50vw", duration: "50s", delay: "-16s", opacity: 0.4, reversa: true },
  { top: "58%", width: "36vw", duration: "40s", delay: "-8s", opacity: 0.35 },
  { top: "72%", width: "54vw", duration: "58s", delay: "-28s", opacity: 0.28, reversa: true },
];

const GOT_COPOS = Array.from({ length: 28 }, (_, i) => i);

function WinterCloudsBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,197,255,0.16),transparent_65%)]" />

      {GOT_NUBES.map((nube, i) => (
        <span
          key={i}
          className={`finsi-cloud absolute rounded-[50%] bg-slate-200/70 blur-2xl ${
            nube.reversa ? "finsi-cloud-reverse" : ""
          }`}
          style={{
            top: nube.top,
            width: nube.width,
            height: `calc(${nube.width} * 0.28)`,
            opacity: nube.opacity,
            animationDuration: nube.duration,
            animationDelay: nube.delay,
          }}
        />
      ))}

      {GOT_COPOS.map((i) => (
        <span
          key={i}
          className="finsi-snowflake absolute top-[-5%] rounded-full bg-white"
          style={{
            left: `${(i * 37) % 100}%`,
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            animationDuration: `${6 + (i % 5)}s`,
            animationDelay: `${-(i % 7)}s`,
            opacity: 0.5 + (i % 4) * 0.12,
          }}
        />
      ))}
    </div>
  );
}

function GotTitleReveal({ cerrando }: { cerrando: boolean }) {
  let contadorLetras = 0;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-0 bg-black/85 px-2 backdrop-blur-sm transition-opacity duration-500 ${
        cerrando ? "opacity-0" : "opacity-100"
      }`}
    >
      <WinterCloudsBackdrop />

      {GOT_TITLE_LINES.map((linea, indiceLinea) => (
        <h3
          key={indiceLinea}
          className="relative z-10 flex flex-nowrap justify-center font-serif font-black uppercase leading-[0.85] tracking-[0.05em]"
          style={{ fontSize: "clamp(3.5rem, 16vw, 9rem)" }}
        >
          {linea.split("").map((letra) => {
            const i = contadorLetras++;

            return letra === " " ? (
              <span key={i} className="w-[0.28em]" />
            ) : (
              <span
                key={i}
                className="finsi-got-letter inline-block bg-gradient-to-b from-slate-50 via-slate-300 to-slate-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(226,232,240,0.5)]"
                style={{ animationDelay: `${300 + i * 55}ms` }}
              >
                {letra}
              </span>
            );
          })}
        </h3>
      ))}
    </div>
  );
}

function EasterEggVisual({
  tipo,
  isHistory,
  messageId,
}: {
  tipo: Exclude<EasterEggVisual, null>;
  isHistory?: boolean;
  messageId: number;
}) {
  const { src, poster, durationMs, border } = EASTER_EGG_VISUAL_ASSETS[tipo];
  // `terminado` solo importa mientras el mensaje está "vivo": un mensaje de
  // historial siempre debe mostrar el poster, sin importar qué estado haya
  // quedado guardado (por ejemplo si React reutiliza esta instancia al
  // cambiar de chat). Por eso el render de abajo no usa `terminado` solo,
  // sino `isHistory || terminado`.
  const [terminado, setTerminado] = useState(false);
  const saberAudioRef = useRef<HTMLAudioElement | null>(null);
  const mostrarPoster = isHistory || terminado;

  useEffect(() => {
    if (isHistory) return;
    // Al terminar la animación (loop=1, se congela sola en el navegador)
    // cambiamos al poster estático: el webp animado pesa varios MB, el
    // último frame como imagen fija pesa unos pocos KB.
    const idPoster = setTimeout(() => setTerminado(true), durationMs);

    return () => clearTimeout(idPoster);
  }, [durationMs, isHistory]);

  useEffect(() => {
    if (tipo !== "kenobi" || isHistory) return;

    // El diálogo "General Kenobi" sigue viniendo del !audio del backend.
    // Este audio adicional reproduce únicamente el sonido del sable.
    const saberAudio = new Audio("/images/task/finsi-kenobi.mp3");
    saberAudioRef.current = saberAudio;
    saberAudio.volume = 1;
    saberAudio.play().catch(() => {});

    return () => {
      saberAudio.pause();
      saberAudio.currentTime = 0;
      saberAudioRef.current = null;
    };
  }, [tipo, isHistory]);

  useEffect(() => {
    // Si arranca el easter egg de otro mensaje, este se congela en su
    // último frame y corta cualquier audio propio (p. ej. el sable de
    // Kenobi) al instante en vez de seguir animándose en paralelo.
    if (isHistory) return;

    detenerOtrosEasterEggs(messageId);

    return registrarEasterEgg(messageId, () => {
      setTerminado(true);
      const saberAudio = saberAudioRef.current;
      if (saberAudio) {
        saberAudio.pause();
        saberAudio.currentTime = 0;
      }
    });
  }, [messageId, isHistory]);

  return (
    <div className={`relative mb-3 overflow-hidden rounded-xl border bg-[#101828] ${border}`}>
      <img
        src={mostrarPoster ? poster : src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="block max-h-80 w-full bg-[#101828] object-contain"
      />
    </div>
  );
}

function AvatarFinsi({ pensando = false }: { pensando?: boolean }) {
  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 items-end justify-center overflow-hidden rounded-full border bg-brand-50 dark:bg-brand-500/15 ${
        pensando
          ? "border-brand-300 shadow-[0_0_0_4px_rgba(70,95,255,0.08)]"
          : "border-brand-100 dark:border-brand-500/20"
      }`}
      aria-label={pensando ? "Finsi está pensando" : "Finsi, asistente financiero"}
    >
      <img
        src={MASCOTA_SRC}
        alt=""
        className={`h-[54px] w-auto max-w-none translate-y-4 object-contain ${pensando ? "animate-pulse" : ""}`}
      />
    </div>
  );
}

function cargarChatsGuardados(usuarioId: string): ChatGuardado[] {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY(usuarioId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarChatsGuardados(usuarioId: string, chats: ChatGuardado[]) {
  localStorage.setItem(CHATS_STORAGE_KEY(usuarioId), JSON.stringify(chats));
}

function PersonaHablandoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www\.w3.org/2000/svg">
      <circle cx="9" cy="8" r="3" fill="currentColor" />
      <path
        d="M4 19c0-2.76 2.24-5 5-5s5 2.24 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M15.8 7.5c.7.7 1.1 1.56 1.1 2.5s-.4 1.8-1.1 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 5.3c1.27 1.27 2 3 2 4.7s-.73 3.43-2 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function OjoMasIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www\.w3.org/2000/svg">
      <path
        d="M2.5 11.5S6 5.5 11.5 5.5 20.5 11.5 20.5 11.5 17 17.5 11.5 17.5 2.5 11.5 2.5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="11.5" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M19.5 3.5v4M17.5 5.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const sugerencias = [
  "Resume mis gastos del último mes",
  "Dame consejos para ahorrar más",
  "Ayúdame a armar un presupuesto mensual",
  "Explica qué significa mi perfil financiero",
];

const CATEGORIAS_MENSAJE_PENSANDO: { patron: RegExp; mensaje: string }[] = [
  {
    patron: /\b(pib|inflaci[oó]n|econom[ií]a|macroeconom[ií]a|d[oó]lar|tipo de cambio|tasa de inter[eé]s|banco central|pbi)\b/i,
    mensaje: "Finsi está investigando ese concepto económico",
  },
  {
    patron: /\b(gasto|gastos|presupuesto|ahorro|ahorrar|ingreso|ingresos|deuda|deudas|factura|transacci[oó]n|transacciones|saldo|cuenta)\b/i,
    mensaje: "Finsi está analizando tus finanzas",
  },
  {
    patron: /\b(qu[eé] es|significa|defin[ei]|explica|c[oó]mo funciona)\b/i,
    mensaje: "Finsi está buscando la mejor explicación",
  },
];

function obtenerMensajePensando(prompt: string): string {
  const coincidencia = CATEGORIAS_MENSAJE_PENSANDO.find(({ patron }) => patron.test(prompt));
  return coincidencia?.mensaje ?? "Finsi está pensando tu respuesta";
}

// ─── Matrix Pill Choice ───────────────────────────────────────────────────────
// Muestra debajo del video del easter egg la pregunta "¿Cuál eliges?"
// con un botón rojo (ver análisis financiero) y uno azul (resumen financiero).
function MatrixPillChoice({ onElegir }: { onElegir: (e: "roja" | "azul") => void }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 animate-[fadeInUp_0.5s_ease_both]">
      <p className="text-center text-theme-sm font-semibold tracking-wide text-violet-200 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]">
        ¿Cuál eliges?
      </p>
      <div className="flex items-center gap-4">
        {/* Pastilla Roja — ver análisis de finanzas */}
        <button
          onClick={() => onElegir("roja")}
          className="group relative overflow-hidden rounded-full px-6 py-2.5 text-theme-sm font-semibold text-white shadow-[0_0_18px_rgba(239,68,68,0.55)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_rgba(239,68,68,0.8)] active:scale-95"
          style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 60%, #7f1d1d 100%)" }}
          aria-label="Pastilla roja: ver análisis financiero"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-full bg-white/20" />
          Pastilla Roja
        </button>

        {/* Pastilla Azul — ir al resumen financiero */}
        <button
          onClick={() => onElegir("azul")}
          className="group relative overflow-hidden rounded-full px-6 py-2.5 text-theme-sm font-semibold text-white shadow-[0_0_18px_rgba(59,130,246,0.55)] transition-all duration-200 hover:scale-105 hover:shadow-[0_0_28px_rgba(59,130,246,0.8)] active:scale-95"
          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e3a8a 100%)" }}
          aria-label="Pastilla azul: ir al resumen financiero"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-[45%] rounded-t-full bg-white/20" />
          Pastilla Azul
        </button>
      </div>
    </div>
  );
}

// ─── Matrix Pill Splash ───────────────────────────────────────────────────────
// Animación fullscreen al elegir pastilla, al estilo del GotTitleReveal.
function MatrixPillSplash({ tipo, cerrando }: { tipo: "roja" | "azul"; cerrando: boolean }) {
  const esRoja = tipo === "roja";

  const bgFrom   = esRoja ? "rgba(127,29,29,0.97)"  : "rgba(30,58,138,0.97)";
  const bgTo     = esRoja ? "rgba(0,0,0,0.97)"       : "rgba(0,0,0,0.97)";
  const glowColor = esRoja ? "rgba(239,68,68,0.55)"  : "rgba(59,130,246,0.55)";
  const textColor = esRoja ? "#fca5a5"               : "#93c5fd";
  const pillLabel = esRoja ? "PASTILLA ROJA"         : "PASTILLA AZUL";
  const subLabel  = esRoja ? "Analizando tus finanzas…" : "Volviendo al inicio…";

  // Partículas decorativas tipo lluvia (esRoja: código rojo / esAzul: código azul)
  const particulas = Array.from({ length: 18 }, (_, i) => i);

  const contenido = (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${cerrando ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: `radial-gradient(ellipse at center, ${bgFrom} 0%, ${bgTo} 100%)` }}
    >
      {/* Partículas de lluvia tipo Matrix */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particulas.map((i) => (
          <span
            key={i}
            className="absolute top-[-8%] text-xs font-mono font-bold select-none animate-[matrixRain_linear_infinite]"
            style={{
              left: `${(i * 5.8) % 100}%`,
              color: esRoja ? `rgba(239,68,68,${0.3 + (i % 4) * 0.15})` : `rgba(59,130,246,${0.3 + (i % 4) * 0.15})`,
              animationDuration: `${1.8 + (i % 5) * 0.6}s`,
              animationDelay: `${-(i % 7) * 0.4}s`,
              fontSize: `${10 + (i % 3) * 2}px`,
            }}
          >
            {["0", "1", "∑", "$", "¥", "€", "₿", "∞"][i % 8]}
          </span>
        ))}
      </div>

      {/* Resplandor central */}
      <div
        className="absolute h-64 w-64 rounded-full blur-[80px] opacity-40"
        style={{ background: glowColor }}
      />

      {/* Pill icon */}
      <div className="relative z-10 mb-6 flex h-16 w-8 flex-col overflow-hidden rounded-full border-2 border-white/30 shadow-[0_0_30px_var(--pill-glow)]"
        style={{ "--pill-glow": glowColor } as React.CSSProperties}>
        <div className="flex-1" style={{ background: esRoja ? "#dc2626" : "#2563eb" }} />
        <div className="flex-1 bg-white/10" />
      </div>

      {/* Texto */}
      <p
        className="relative z-10 text-center font-mono text-4xl font-black tracking-[0.18em] drop-shadow-[0_0_16px_var(--pill-color)] sm:text-5xl animate-[fadeInUp_0.4s_ease_both]"
        style={{ color: textColor, "--pill-color": textColor } as React.CSSProperties}
      >
        {pillLabel}
      </p>
      <p
        className="relative z-10 mt-3 text-center text-sm font-mono tracking-widest opacity-70 animate-[fadeInUp_0.4s_0.15s_ease_both]"
        style={{ color: textColor }}
      >
        {subLabel}
      </p>
    </div>
  );

  return createPortal(contenido, document.body);
}

export default function AsistenteIA() {
  const { usuarioId, email, session, signOut } = useAuth();
  const { registrarEvento, desbloquearLogro } = useGamification();
  const location = useLocation();
  const navigate = useNavigate();
  const estadoNavegacion = location.state as { messages?: Message[]; autoPrompt?: string } | null;
  const mensajesTraidos = estadoNavegacion?.messages;
  const autoPromptTraido = estadoNavegacion?.autoPrompt;
  const [messages, setMessages] = useState<Message[]>(
    (mensajesTraidos ?? []).map(m => ({ ...m, isHistory: true }))
  );
  const [enviando, setEnviando] = useState(false);
  const [mensajePensando, setMensajePensando] = useState(
    "Finsi está analizando tus finanzas"
  );
  const [pasoPendiente, setPasoPendiente] = useState<PasoInteractivo>(null);
  const [modeloActivo, setModeloActivo] = useState(MODELOS_ASISTENTE[0]);
  const ignorarProximaRepeticionRef = useRef(false);
  const descansoMostradoRef = useRef(false);
  const [mensajeEditandoId, setMensajeEditandoId] = useState<number | null>(null);
  const [textoEditando, setTextoEditando] = useState("");
  const ultimoMensajeAsistenteId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const ultimaPreguntaUsuarioTexto = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
  const [vozActiva, setVozActiva] = useState(
    () => localStorage.getItem("asistenteVozActiva") === "true"
  );
  const [sonidoActivo, setSonidoActivo] = useState(
    () => localStorage.getItem("asistenteSonidoActivo") !== "false"
  );
  const [chatsGuardados, setChatsGuardados] = useState<ChatGuardado[]>(() =>
    cargarChatsGuardados(usuarioId)
  );
  const [chatActualId, setChatActualId] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const autoPromptEnviadoRef = useRef(false);
  const mensajesScrollRef = useRef<HTMLDivElement>(null);
  const { isOpen: equipoModalAbierto, openModal: abrirEquipoModal, closeModal: cerrarEquipoModal } = useModal();
  const [gotSplash, setGotSplash] = useState<"visible" | "cerrando" | null>(null);
  const gotSplashMostradoRef = useRef<number | null>(null);
  const [matrixSplash, setMatrixSplash] = useState<{ tipo: "roja" | "azul"; fase: "visible" | "cerrando" } | null>(null);

  useEffect(() => {
    const ultimoMensaje = messages[messages.length - 1];

    if (
      !ultimoMensaje ||
      ultimoMensaje.role !== "assistant" ||
      ultimoMensaje.isHistory ||
      gotSplashMostradoRef.current === ultimoMensaje.id ||
      detectarEasterEggVisual(ultimoMensaje.text) !== "got"
    ) {
      return;
    }

    gotSplashMostradoRef.current = ultimoMensaje.id;
    setGotSplash("visible");

    const cerrar = setTimeout(() => setGotSplash("cerrando"), 2400);
    const ocultar = setTimeout(() => setGotSplash(null), 2900);

    return () => {
      clearTimeout(cerrar);
      clearTimeout(ocultar);
    };
  }, [messages]);

  // Easter egg "exit": suena el bark-fart y cierra la sesión. Solo con el
  // mensaje fresco (no en el historial) y una única vez por mensaje.
  const logoutHechoRef = useRef<number | null>(null);
  useEffect(() => {
    const ultimoMensaje = messages[messages.length - 1];

    if (
      !ultimoMensaje ||
      ultimoMensaje.role !== "assistant" ||
      ultimoMensaje.isHistory ||
      logoutHechoRef.current === ultimoMensaje.id ||
      !ultimoMensaje.text.includes("[[finsi-logout]]")
    ) {
      return;
    }

    logoutHechoRef.current = ultimoMensaje.id;

    const audio = new Audio("/images/task/bark-fart.mp3");
    const salir = () => {
      void signOut();
    };
    audio.addEventListener("ended", salir, { once: true });
    audio.addEventListener("error", salir, { once: true });
    void audio.play().catch(salir);
  }, [messages, signOut]);

  const nombreBienvenida = useMemo(() => {
    const metadata = session?.user.user_metadata;
    const nombre = typeof metadata?.nombre === "string" ? metadata.nombre.trim() : "";
    const nombreAlternativo =
      typeof metadata?.name === "string" ? metadata.name.trim().split(/\s+/)[0] : "";

    return nombre || nombreAlternativo || email?.split("@")[0] || "Usuario";
  }, [email, session?.user.user_metadata]);

  useEffect(() => {
    setChatsGuardados(cargarChatsGuardados(usuarioId));
    if (!mensajesTraidos && !autoPromptTraido) {
      setMessages([]);
      setChatActualId(null);
    } else {
      navigate(location.pathname, { replace: true, state: null });
      if (autoPromptTraido && !autoPromptEnviadoRef.current) {
        autoPromptEnviadoRef.current = true;
        handleSubmit(autoPromptTraido);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  useEffect(() => {
    localStorage.setItem("asistenteVozActiva", String(vozActiva));
    if (!vozActiva) stopSpeaking();
  }, [vozActiva]);

  useEffect(() => {
    localStorage.setItem("asistenteSonidoActivo", String(sonidoActivo));
    if (!sonidoActivo) stopTypingSound();
  }, [sonidoActivo]);

  useEffect(() => () => {
    stopSpeaking();
    stopTypingSound();
  }, []);

  useEffect(() => {
    const scrollAlFinal = (behavior: ScrollBehavior = "smooth") => {
      const contenedor = mensajesScrollRef.current;
      if (!contenedor) return;

      contenedor.scrollTo({
        top: contenedor.scrollHeight,
        behavior,
      });
    };

    // Scroll inicial al aparecer el mensaje.
    requestAnimationFrame(() => scrollAlFinal("smooth"));

    // Algunos mensajes (especialmente los easter eggs con video) aumentan
    // su altura después del primer render. Repetimos el ajuste unas veces
    // para mantener visible la respuesta completa sin intervención manual.
    const timers = [
      window.setTimeout(() => scrollAlFinal("smooth"), 120),
      window.setTimeout(() => scrollAlFinal("smooth"), 450),
      window.setTimeout(() => scrollAlFinal("smooth"), 1000),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [messages, enviando, pasoPendiente]);

  useEffect(() => {
    if (messages.length === 0) return;

    const id = chatActualId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (id !== chatActualId) setChatActualId(id);

    const primerMensajeUsuario = messages.find((m) => m.role === "user")?.text ?? "Conversación";
    const titulo =
      primerMensajeUsuario.length > 48
        ? `${primerMensajeUsuario.slice(0, 48)}…`
        : primerMensajeUsuario;

    setChatsGuardados((prev) => {
      const siguiente = [
        { id, titulo, messages, actualizadoEn: Date.now() },
        ...prev.filter((chat) => chat.id !== id),
      ].slice(0, MAX_CHATS_GUARDADOS);
      guardarChatsGuardados(usuarioId, siguiente);
      return siguiente;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const toggleVoz = () => setVozActiva((prev) => !prev);
  const toggleSonido = () => setSonidoActivo((prev) => !prev);

  const handleSubmit = async (
    prompt: string,
    modelo?: string,
    previousAnswerOverride?: string | null,
  ) => {
    if (enviando) return;
    setPasoPendiente(null);

    const modoSeleccionado = modelo ?? modeloActivo;
    const ultimaPreguntaUsuario = [...messages].reverse().find((m) => m.role === "user")?.text;
    const ignorarRepeticion = ignorarProximaRepeticionRef.current;
    ignorarProximaRepeticionRef.current = false;

    const numeroMensajeUsuario =
      messages.filter((message) => message.role === "user").length + 1;
    const debeMostrarDescanso =
      numeroMensajeUsuario === 10 && !descansoMostradoRef.current;

    const esPreguntaRepetida =
      !ignorarRepeticion &&
      ultimaPreguntaUsuario !== undefined &&
      normalizarPreguntaParaComparar(ultimaPreguntaUsuario) === normalizarPreguntaParaComparar(prompt);

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: prompt },
    ]);

    if (esPreguntaRepetida) {
      setAgentTabStatus("💬 El agente está escribiendo...");
      if (sonidoActivo) playSendSound();
      setMessages((prev) => {
        const siguientes: Message[] = [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: RESPUESTA_RICKROLL_REPETIDA },
        ];

        if (debeMostrarDescanso) {
          descansoMostradoRef.current = true;
          siguientes.push({
            id: prev.length + 2,
            role: "assistant",
            text: MENSAJE_DESCANSO,
          });
        }

        return siguientes;
      });
      setAgentTabStatus("✅ El agente ha respondido", 2000);
      if (sonidoActivo) playReceiveSound();
      if (vozActiva) speakText("You just got Rickrolled. Classic.");
      desbloquearLogro("rickroll");
      return;
    }

    setEnviando(true);
    setMensajePensando(obtenerMensajePensando(prompt));
    setAgentTabStatus("💬 El agente está escribiendo...");
    if (sonidoActivo) {
      playSendSound();
      startTypingSound();
    }
    const previousAnswer =
      previousAnswerOverride !== undefined
        ? previousAnswerOverride ?? undefined
        : [...messages].reverse().find((m) => m.role === "assistant")?.text;
    try {
      const { answer } = await preguntarAgenteStream(
        prompt,
        usuarioId,
        previousAnswer,
        (paso) => setMensajePensando(paso),
        modoSeleccionado,
      );
      setMessages((prev) => {
        const siguientes: Message[] = [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: answer },
        ];

        if (debeMostrarDescanso) {
          descansoMostradoRef.current = true;
          siguientes.push({
            id: prev.length + 2,
            role: "assistant",
            text: MENSAJE_DESCANSO,
          });
        }

        return siguientes;
      });
      if (/¿Puedo ayudarte con algo más\?/i.test(answer)) {
        setPasoPendiente("support-help");
      } else if (REGEX_RESPUESTA_CREADOR.test(answer)) {
        setPasoPendiente("team-info");
      }
      registrarEvento("mensaje_asistente");
      const logroDetectado = detectarLogroEnRespuesta(answer);
      if (logroDetectado) desbloquearLogro(logroDetectado);
      setAgentTabStatus("✅ El agente ha respondido", 2000);
      if (sonidoActivo) playReceiveSound();
      if (vozActiva) {
        if (answer.includes("[[finsi-terminal-demo]]")) {
          speakText("Hola, soy Finsi. ¿Reviso tus finanzas?");
        } else {
          speakText(limpiarMetadataInterna(answer));
        }
      }
    } catch (error) {
      setAgentTabStatus("✅ El agente ha respondido", 2000);
      if (sonidoActivo) playErrorSound();

      if (error instanceof Error && esErrorSinDatos(error.message)) {
        setMessages((prev) => [
          ...prev,
          { id: prev.length + 1, role: "assistant", text: MENSAJE_SIN_DATOS },
        ]);
        setPasoPendiente("sin-datos");
      } else {
        mostrarError(
          "No se pudo consultar el asistente",
          "Revisa que el AI-Service (:8000) esté levantado y que tenga configurada la GROQ_API_KEY."
        );
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            role: "assistant",
            text: "Ahora mismo no puedo responder. Verifica que el servicio de IA esté disponible.",
          },
        ]);
      }
    } finally {
      stopTypingSound();
      setEnviando(false);
    }
  };

  const handleModelChange = (modelo: string) => {
    // El cambio de agente se anuncia localmente: no llama al backend ni consume tokens.
    // Además, la primera pregunta en el nuevo agente no cuenta como repetición aunque
    // sea igual a la última pregunta hecha en el agente anterior.
    stopSpeaking();
    setPasoPendiente(null);
    setModeloActivo(modelo);
    ignorarProximaRepeticionRef.current = true;

    const texto =
      modelo === "Soporte técnico"
        ? "🛠️ Estás en **Soporte técnico**. ¿Con qué problema de FinSightAI puedo ayudarte?"
        : "✨ Estás en **FinSightAI Advisor**. ¿Qué aspecto de tus finanzas quieres revisar?";

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: texto },
    ]);
  };

  const iniciarEdicionMensaje = (message: Message) => {
    if (enviando || message.role !== "user") return;
    setMensajeEditandoId(message.id);
    setTextoEditando(message.text);
  };

  const cancelarEdicionMensaje = () => {
    setMensajeEditandoId(null);
    setTextoEditando("");
  };

  const reenviarMensajeEditado = (messageId: number) => {
    const nuevoTexto = textoEditando.trim();
    if (!nuevoTexto || enviando) return;

    const indice = messages.findIndex((m) => m.id === messageId);
    if (indice < 0) return;

    // Al editar una pregunta, descartamos visualmente todo lo que vino después
    // y reconstruimos la conversación desde ese punto, como en ChatGPT.
    const mensajesPrevios = messages.slice(0, indice);
    // Una edición crea una rama nueva desde esta pregunta. No reutilizamos
    // la respuesta anterior como previous_answer porque el backend podría
    // interpretarla como un follow-up y generar una respuesta expandida.
    setMessages(mensajesPrevios);
    setPasoPendiente(null);
    setMensajeEditandoId(null);
    setTextoEditando("");

    // Reenviar una edición nunca debe contar como "pregunta repetida".
    ignorarProximaRepeticionRef.current = true;
    void handleSubmit(nuevoTexto, modeloActivo, null);
  };

  const responderSoporte = (respuesta: "sí" | "no") => {
    setPasoPendiente(null);
    void handleSubmit(respuesta);
  };

  const irAImportarDatos = () => {
    setPasoPendiente(null);
    navigate("/importar-csv");
  };

  const responderConocerEquipo = () => {
    setPasoPendiente(null);
    abrirEquipoModal();
  };

  const responderNoConocerEquipo = () => {
    setPasoPendiente(null);
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: MENSAJE_CON_QUE_SEGUIMOS },
    ]);
  };

  const responderOtraConsulta = () => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: MENSAJE_OTRA_CONSULTA },
    ]);
    setPasoPendiente("otra-consulta");
  };

  const finalizarSesion = async () => {
    setPasoPendiente(null);
    const despedida = await construirMensajeDespedida(usuarioId, email);
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: despedida },
    ]);
    setTimeout(() => navigate("/"), 1000);
  };

  const nuevoChat = () => {
    stopSpeaking();
    descansoMostradoRef.current = false;
    setPasoPendiente(null);
    setMensajeEditandoId(null);
    setTextoEditando("");
    if (messages.length === 0) return;
    setMessages([]);
    setChatActualId(null);
    setHistorialAbierto(false);
  };

  const cargarChat = (chat: ChatGuardado) => {
    stopSpeaking();
    descansoMostradoRef.current = chat.messages.some(
      (message) =>
        message.role === "assistant" &&
        detectarEasterEggVisual(message.text) === "descanso"
    );
    setMensajeEditandoId(null);
    setTextoEditando("");
    setMessages(chat.messages.map(m => ({ ...m, isHistory: true })));
    setChatActualId(chat.id);
    setHistorialAbierto(false);
  };

  const eliminarChat = (id: string, evento: React.MouseEvent) => {
    evento.stopPropagation();
    if (chatActualId === id) {
      stopSpeaking();
    }
    setChatsGuardados((prev) => {
      const siguiente = prev.filter((chat) => chat.id !== id);
      guardarChatsGuardados(usuarioId, siguiente);
      return siguiente;
    });
    if (chatActualId === id) {
      setMessages([]);
      setChatActualId(null);
    }
  };

  const chatsOrdenados = useMemo(
    () => [...chatsGuardados].sort((a, b) => b.actualizadoEn - a.actualizadoEn),
    [chatsGuardados]
  );

  const renderListaChats = (onClose?: () => void) => (
    <>
      <button
        onClick={() => {
          nuevoChat();
          onClose?.();
        }}
        className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
      >
        <PlusIcon className="size-5" />
        Nuevo Chat
      </button>
      <p className="mb-2 px-2 text-theme-xs font-medium uppercase tracking-wide text-gray-400">
        Recientes
      </p>
      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
        {chatsOrdenados.length === 0 ? (
          <p className="px-3 py-2 text-theme-sm text-gray-400">
            Tus conversaciones guardadas aparecerán aquí.
          </p>
        ) : (
          chatsOrdenados.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                cargarChat(chat);
                onClose?.();
              }}
              className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-theme-sm transition hover:bg-gray-50 dark:hover:bg-white/[0.03] ${
                chat.id === chatActualId
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <ChatIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{chat.titulo}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => eliminarChat(chat.id, e)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") eliminarChat(chat.id, e as never);
                }}
                title="Eliminar chat"
                className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-white/10"
              >
                <TrashBinIcon className="size-3.5" />
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );

  // Lanza el splash de pantalla completa para la pastilla elegida y luego navega.
  const elegirPastilla = (eleccion: "roja" | "azul") => {
    setMatrixSplash({ tipo: eleccion, fase: "visible" });
    const ruta = eleccion === "roja" ? "/modo-matrix" : "/";
    const cerrar = setTimeout(() => setMatrixSplash((prev) => prev ? { ...prev, fase: "cerrando" } : null), 1600);
    const navegar = setTimeout(() => {
      // La pastilla roja entra en la experiencia completa de Modo Matrix (no en el guard).
      navigate(ruta, eleccion === "roja" ? { state: { pastillaRojaSplash: true } } : undefined);
      setMatrixSplash(null);
    }, 2100);
    return () => { clearTimeout(cerrar); clearTimeout(navegar); };
  };

  return (
    <>
      <style>{`
        @keyframes finsiKenobiGlow {
          0% { transform: scale(.985); box-shadow: 0 0 0 rgba(59,130,246,0); }
          35% { transform: scale(1.012); box-shadow: 0 0 18px rgba(59,130,246,.52), 0 0 38px rgba(56,189,248,.24); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(59,130,246,0); }
        }
        @keyframes finsiYodaGlow {
          0% { transform: translateY(4px) scale(.985); box-shadow: 0 0 0 rgba(34,197,94,0); }
          35% { transform: translateY(0) scale(1.01); box-shadow: 0 0 20px rgba(34,197,94,.45), 0 0 40px rgba(52,211,153,.20); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes finsiYodaParticle {
          0% { transform: translateY(0) scale(.7); opacity: 0; }
          20% { opacity: .9; }
          100% { transform: translateY(-34px) scale(1.2); opacity: 0; }
        }
        @keyframes finsiMatrixGlow {
          0% { transform: scale(.985); box-shadow: 0 0 0 rgba(139,92,246,0); }
          35% { transform: scale(1.012); box-shadow: 0 0 18px rgba(139,92,246,.52), 0 0 38px rgba(217,70,239,.24); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(139,92,246,0); }
        }
        @keyframes finsiGotGlow {
          0% { transform: scale(.985); box-shadow: 0 0 0 rgba(148,163,184,0); }
          35% { transform: scale(1.012); box-shadow: 0 0 18px rgba(148,163,184,.5), 0 0 38px rgba(226,232,240,.22); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(148,163,184,0); }
        }
        @keyframes finsiGotLetterIn {
          0% { opacity: 0; transform: translateY(10px) scale(.94); filter: blur(2px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes finsiCloudDrift {
          0% { transform: translateX(-35%); }
          100% { transform: translateX(135%); }
        }
        @keyframes finsiSnowFall {
          0% { transform: translateY(-10%) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(115vh) translateX(14px); opacity: 0; }
        }
        @keyframes matrixRain {
          0% { transform: translateY(-10vh); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .finsi-easter-kenobi { animation: finsiKenobiGlow 1.35s ease-out; }
        .finsi-easter-yoda { animation: finsiYodaGlow 1.55s ease-out; }
        .finsi-easter-matrix { animation: finsiMatrixGlow 1.35s ease-out; }
        .finsi-easter-got { animation: finsiGotGlow 1.35s ease-out; }
        .finsi-got-letter { animation: finsiGotLetterIn .55s ease-out both; }
        .finsi-cloud { left: -20%; animation-name: finsiCloudDrift; animation-timing-function: linear; animation-iteration-count: infinite; }
        .finsi-cloud-reverse { animation-direction: reverse; }
        .finsi-snowflake { animation-name: finsiSnowFall; animation-timing-function: linear; animation-iteration-count: infinite; }
        .finsi-yoda-particle { animation: finsiYodaParticle 1.45s ease-out forwards; }
        .finsi-yoda-particle-2 { animation-delay: 90ms; }
        .finsi-yoda-particle-3 { animation-delay: 160ms; }
        .finsi-yoda-particle-4 { animation-delay: 230ms; }
        .finsi-yoda-particle-5 { animation-delay: 310ms; }
        @media (prefers-reduced-motion: reduce) {
          .finsi-easter-kenobi, .finsi-easter-yoda, .finsi-easter-matrix, .finsi-easter-got,
          .finsi-got-letter, .finsi-yoda-particle, .finsi-cloud, .finsi-snowflake { animation: none !important; }
        }
      `}</style>

      {gotSplash && <GotTitleReveal cerrando={gotSplash === "cerrando"} />}
      {matrixSplash && <MatrixPillSplash tipo={matrixSplash.tipo} cerrando={matrixSplash.fase === "cerrando"} />}

      <PageMeta title="Asistente IA | FinSightAI" description="Asistente de inteligencia artificial para tus finanzas" />
      <div className="flex h-[calc(100dvh-90px)] gap-6 pb-2 sm:h-[calc(100vh-150px)] sm:pb-0">
        {/* Historial — escritorio */}
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] xl:flex">
          {renderListaChats()}
        </aside>

        {/* Historial — móvil/tablet (menú lateral deslizante, estilo Gemini) */}
        <div
          className={`fixed inset-0 z-99999 flex xl:hidden ${
            historialAbierto ? "" : "pointer-events-none"
          }`}
        >
          <div
            className={`absolute inset-0 bg-gray-900/50 transition-opacity duration-300 ${
              historialAbierto ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setHistorialAbierto(false)}
          />
          <div
            className={`relative flex w-72 max-w-[80vw] flex-col bg-white p-4 shadow-xl transition-transform duration-300 ease-in-out dark:bg-gray-900 ${
              historialAbierto ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                Historial
              </p>
              <button
                onClick={() => setHistorialAbierto(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
                aria-label="Cerrar historial"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
            {renderListaChats(() => setHistorialAbierto(false))}
          </div>
        </div>

        {/* Conversación */}
        <section data-tour="page-assistant" className="scroll-mt-24 flex flex-1 flex-col overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setHistorialAbierto(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-medium text-gray-500 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] xl:hidden"
            >
              <OjoMasIcon className="size-4" />
              <span className="hidden 2xsm:inline">Historial</span>
            </button>

            <div className="flex flex-1 items-center justify-end gap-2">
              <button
                onClick={toggleSonido}
                title={sonidoActivo ? "Desactivar efectos de sonido" : "Activar efectos de sonido"}
                aria-label={sonidoActivo ? "Desactivar efectos de sonido" : "Activar efectos de sonido"}
                aria-pressed={sonidoActivo}
                className={`flex size-8 items-center justify-center rounded-lg border text-theme-xs font-medium transition sm:size-auto sm:gap-2 sm:px-3 sm:py-1.5 ${
                  sonidoActivo
                    ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-800 dark:bg-brand-500/15 dark:text-brand-400"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.06]"
                }`}
              >
                <BoltIcon className="size-4" />
                <span className="hidden sm:inline">{sonidoActivo ? "Sonido activado" : "Activar sonido"}</span>
              </button>
              {isSpeechSupported() && (
                <button
                  onClick={toggleVoz}
                  title={vozActiva ? "Desactivar voz de lectura" : "Activar voz de lectura (voz hombre)"}
                  aria-label={vozActiva ? "Desactivar voz narrada" : "Activar voz narrada"}
                  aria-pressed={vozActiva}
                  className={`flex size-8 items-center justify-center rounded-lg border text-theme-xs font-medium transition sm:size-auto sm:gap-2 sm:px-3 sm:py-1.5 ${
                    vozActiva
                      ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-800 dark:bg-brand-500/15 dark:text-brand-400"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <PersonaHablandoIcon className="size-4" />
                  <span className="hidden sm:inline">{vozActiva ? "Voz activada" : "Activar voz"}</span>
                </button>
              )}
            </div>
          </div>
          <div ref={mensajesScrollRef} className="custom-scrollbar flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-start px-2 py-4 text-center sm:justify-center sm:py-0">
                <div className="relative pt-12 sm:pt-16">
                  <div className="absolute left-1/2 top-0 z-10 w-max max-w-[15rem] -translate-x-1/2 rounded-[1.35rem] border border-brand-100 bg-white px-4 py-2.5 text-theme-sm font-semibold text-brand-700 shadow-theme-sm dark:border-brand-500/25 dark:bg-gray-800 dark:text-brand-300 sm:left-[82%] sm:top-5 sm:max-w-[17rem] sm:-translate-x-0">
                    Finsi está listo para ayudarte
                    <span className="absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 border-b border-r border-brand-100 bg-white dark:border-brand-500/25 dark:bg-gray-800 sm:left-6 sm:translate-x-0" />
                  </div>
                  <div className="relative">
                    <div className="relative flex h-48 w-48 items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-brand-50 to-success-50 ring-1 ring-brand-100 dark:from-brand-500/15 dark:to-success-500/10 dark:ring-brand-500/20 sm:h-52 sm:w-52">
                      <div className="absolute inset-x-5 bottom-2 h-5 rounded-full bg-brand-950/10 blur-lg dark:bg-black/30" />
                      <img
                        src={MASCOTA_SRC}
                        alt="Finsi, tu asistente financiero"
                        className="relative h-[95%] w-auto object-contain drop-shadow-xl"
                      />
                    </div>
                    <span
                      className="absolute bottom-1 right-0 z-20 flex size-7 items-center justify-center rounded-full border-[3px] border-white bg-success-500 shadow-md dark:border-gray-900 sm:bottom-2 sm:right-1 sm:size-8"
                      title="En línea"
                      aria-label="Finsi está en línea"
                    >
                      <span className="absolute inset-0 animate-ping rounded-full bg-success-400 opacity-60 motion-reduce:hidden" />
                      <span className="relative size-2.5 rounded-full bg-white/90 sm:size-3" />
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-lg font-semibold text-brand-600 dark:text-brand-400 sm:mt-3">
                  Bienvenido {nombreBienvenida},
                </p>
                <h2 className="mt-2 text-xl font-bold text-gray-800 dark:text-white/90 sm:mt-3 sm:text-title-sm">
                  ¿En qué te puedo ayudar hoy?
                </h2>
                <p className="mt-2 max-w-lg text-theme-sm text-gray-500 dark:text-gray-400">
                  Puedo explicarte tus gastos, ayudarte con un presupuesto y encontrar oportunidades de ahorro.
                </p>
                <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2 sm:mt-6 sm:gap-3 sm:grid-cols-2">
                  {sugerencias.map((sugerencia) => (
                    <button
                      key={sugerencia}
                      onClick={() => handleSubmit(sugerencia)}
                      className="rounded-xl border border-gray-200 bg-white p-2.5 text-left text-theme-xs text-gray-600 transition hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-800 sm:p-4 sm:text-theme-sm"
                    >
                      {sugerencia}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6 py-2">
                {messages.map((message) => {
                  const easterVisual =
                    message.role === "assistant"
                      ? detectarEasterEggVisual(message.text)
                      : null;

                  return (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && (
                      <AvatarFinsi />
                    )}
                    <div className={`flex max-w-[80%] flex-col ${message.role === "user" ? "items-end" : "items-stretch"}`}>
                      <div
                        className={`relative overflow-hidden rounded-2xl px-4 py-3 text-theme-sm ${
                          message.role === "user"
                            ? mensajeEditandoId === message.id
                              ? "whitespace-pre-line border border-gray-700 bg-gray-800 text-white dark:border-gray-700 dark:bg-gray-800"
                              : "whitespace-pre-line bg-brand-500 text-white"
                            : easterVisual === "kenobi"
                              ? "finsi-easter-kenobi bg-[#101828] text-sky-100 ring-1 ring-sky-400/50"
                              : easterVisual === "yoda"
                                ? "finsi-easter-yoda bg-emerald-50 text-gray-800 ring-1 ring-emerald-300/80 dark:bg-emerald-950/30 dark:text-emerald-50 dark:ring-emerald-500/50"
                                : easterVisual === "matrix"
                                  ? "finsi-easter-matrix bg-[#101828] text-violet-100 ring-1 ring-violet-400/50"
                                  : easterVisual === "got"
                                    ? "finsi-easter-got bg-[#101828] text-slate-100 ring-1 ring-slate-400/50"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {message.role === "assistant" && easterVisual && (
                          <EasterEggVisual tipo={easterVisual} isHistory={message.isHistory} messageId={message.id} />
                        )}

                        {(easterVisual === "kenobi" || easterVisual === "matrix" || easterVisual === "got") && (
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ${
                              easterVisual === "kenobi"
                                ? "ring-sky-300/40"
                                : easterVisual === "matrix"
                                  ? "ring-violet-300/40"
                                  : "ring-slate-300/40"
                            }`}
                          />
                        )}

                        {easterVisual === "yoda" && (
                          <span aria-hidden="true" className="pointer-events-none absolute inset-0 motion-reduce:hidden">
                            <span className="finsi-yoda-particle absolute left-[12%] top-[70%] size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
                            <span className="finsi-yoda-particle finsi-yoda-particle-2 absolute left-[28%] top-[78%] size-1 rounded-full bg-green-300 shadow-[0_0_8px_rgba(134,239,172,0.9)]" />
                            <span className="finsi-yoda-particle finsi-yoda-particle-3 absolute left-[54%] top-[72%] size-1.5 rounded-full bg-emerald-200 shadow-[0_0_9px_rgba(167,243,208,0.9)]" />
                            <span className="finsi-yoda-particle finsi-yoda-particle-4 absolute left-[74%] top-[80%] size-1 rounded-full bg-lime-300 shadow-[0_0_8px_rgba(190,242,100,0.8)]" />
                            <span className="finsi-yoda-particle finsi-yoda-particle-5 absolute left-[88%] top-[66%] size-1.5 rounded-full bg-green-200 shadow-[0_0_10px_rgba(187,247,208,0.85)]" />
                          </span>
                        )}

                        <div className="relative z-10">
                          {message.role === "assistant" ? (
                            renderMensajeAsistente(
                              limpiarMetadataInterna(
                                message.isHistory
                                  ? message.text.replace(/!audio\[[^\]]*\]\([^)]+\)/gi, "")
                                  : message.text
                              ),
                              message.id
                            )
                          ) : mensajeEditandoId === message.id ? (
                            <div className="min-w-[260px] sm:min-w-[340px]">
                              <textarea
                                autoFocus
                                value={textoEditando}
                                onChange={(e) => setTextoEditando(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelarEdicionMensaje();
                                  }
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    reenviarMensajeEditado(message.id);
                                  }
                                }}
                                rows={3}
                                className="w-full resize-none rounded-lg border border-gray-600 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand-400"
                              />
                              <div className="mt-2 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelarEdicionMensaje}
                                  className="rounded-lg border border-gray-600 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-gray-500 hover:bg-white/[0.05] hover:text-white"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => reenviarMensajeEditado(message.id)}
                                  disabled={!textoEditando.trim()}
                                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Enviar
                                </button>
                              </div>
                            </div>
                          ) : (
                            message.text
                          )}
                        </div>
                      </div>

                      {message.role === "user" &&
                        mensajeEditandoId !== message.id &&
                        !enviando && (
                          <button
                            type="button"
                            onClick={() => iniciarEdicionMensaje(message)}
                            title="Editar mensaje"
                            aria-label="Editar mensaje"
                            className="mt-1 inline-flex size-7 items-center justify-center rounded-md text-gray-400 opacity-60 transition hover:bg-gray-100 hover:text-gray-600 hover:opacity-100 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
                          >
                            <svg
                              aria-hidden="true"
                              className="size-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="m13.5 6.5 4 4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        )}

                      {message.role === "assistant" &&
                        message.id === ultimoMensajeAsistenteId &&
                        !message.isHistory &&
                        !enviando &&
                        !pasoPendiente &&
                        !easterVisual || easterVisual === "finsi_crypto" &&
                        modeloActivo === "FinSightAI Advisor" &&
                        !/You just got Rickrolled|!video\[Rickroll\]/i.test(message.text) &&
                        normalizarPreguntaParaComparar(ultimaPreguntaUsuarioTexto) !==
                          normalizarPreguntaParaComparar(MENSAJE_EXPLICAME_MAS) &&
                        puedeMostrarExplicameMas(message.text) && (
                          <div className="mt-2 flex w-full justify-start">
                          <button
                               type="button"
                               onClick={() => void handleSubmit(MENSAJE_EXPLICAME_MAS)}
                               disabled={enviando}
                               className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50" >
                                Explícame más
                           </button>
                          </div>
                        )}

                      {/* Elección de pastilla Matrix */}
                      {message.role === "assistant" &&
                        message.id === ultimoMensajeAsistenteId &&
                        easterVisual === "matrix" && (
                          <MatrixPillChoice onElegir={elegirPastilla} />
                        )}
                      {message.role === "assistant" &&
                        message.id === ultimoMensajeAsistenteId &&
                        /¿Puedo ayudarte con algo más\?/i.test(message.text) && (
                          <div className="mt-3 flex w-full items-center justify-center gap-3">
                            <button
                              onClick={() => responderSoporte("sí")}
                              className="min-w-16 rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => responderSoporte("no")}
                              className="min-w-16 rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                            >
                              No
                            </button>
                          </div>
                        )}
                      {message.role === "assistant" &&
                        message.id === ultimoMensajeAsistenteId &&
                        REGEX_RESPUESTA_CREADOR.test(message.text) && (
                          <div className="mt-3 flex w-full flex-col items-center gap-2">
                            <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                              ¿Quieres conocer más a detalle al equipo?
                            </p>
                            <div className="flex items-center justify-center gap-3">
                              <button
                                onClick={responderConocerEquipo}
                                className="min-w-16 rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
                              >
                                Sí
                              </button>
                              <button
                                onClick={responderNoConocerEquipo}
                                className="min-w-16 rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
                })}
                {enviando && (
                  <div className="flex justify-start gap-3">
                    <AvatarFinsi pensando />
                    <div className="rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                      <p className="mb-1.5 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                        {mensajePensando}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="size-2 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                        <span className="size-2 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                        <span className="size-2 animate-bounce rounded-full bg-brand-400" />
                      </div>
                    </div>
                  </div>
                )}
                {!enviando && pasoPendiente && pasoPendiente !== "support-help" && pasoPendiente !== "team-info" && (
                  <div className="flex justify-start gap-3 pl-11">
                    {pasoPendiente === "sin-datos" ? (
                      <>
                        <button
                          onClick={irAImportarDatos}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
                        >
                          Sí
                        </button>
                        <button
                          onClick={responderOtraConsulta}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={nuevoChat}
                          className="rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => void finalizarSesion()}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                        >
                          No
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div data-tour="assistant-composer" className="scroll-mb-4 mt-4">
            <PromptComposer
            models={MODELOS_ASISTENTE}
            onSubmit={handleSubmit}
            onModelChange={handleModelChange}
          />
          </div>
        </section>
      </div>

      {equipoModalAbierto && <TeamAuroraBackdrop />}
      <Modal
        isOpen={equipoModalAbierto}
        onClose={cerrarEquipoModal}
        className="m-4 max-w-[92vw] sm:max-w-[640px] lg:max-w-[880px] xl:max-w-[1040px]"
      >
        <TeamModalContent />
      </Modal>
    </>
  );
}
