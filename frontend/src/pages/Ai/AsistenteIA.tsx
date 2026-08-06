import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PromptComposer from "../../components/ai/PromptComposer";
import { PlusIcon, ChatIcon, BoltIcon, TrashBinIcon, CloseIcon } from "../../icons";
import { mostrarError } from "../../utils/alerts";
import { preguntarAgente } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useGamification } from "../../context/GamificationContext";
import { detectarLogroEnRespuesta } from "../../utils/achievements";
import { speakText, stopSpeaking, isSpeechSupported } from "../../utils/speech";
import { playSendSound, playReceiveSound, playErrorSound, startTypingSound, stopTypingSound } from "../../utils/sound";
import { renderMensajeAsistente } from "../../utils/renderMensajeAsistente";
import { setAgentTabStatus } from "../../utils/tabTitle";
import {
  esErrorSinDatos,
  MENSAJE_SIN_DATOS,
  MENSAJE_OTRA_CONSULTA,
  construirMensajeDespedida,
} from "../../utils/sinDatosFlow";

type PasoInteractivo = "sin-datos" | "otra-consulta" | "support-help" | null;

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
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

const CONTEXTO_FINANCIERO_INTERNO =
  /<!--\s*finsi-financial-context\s+metric=(?:income|expense|unknown)\s+granularity=(?:year|month|rank|other)\s+year=(?:\d{4}|none)\s+month=(?:\d{1,2}|none)\s+position=(?:\d+|none)\s*-->/gi;

function limpiarMetadataInterna(texto: string): string {
  return texto
    .replace(CONTEXTO_FINANCIERO_INTERNO, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Easter egg: si el usuario repite la misma pregunta dos veces seguidas, se le
// muestra el rickroll sin pasar por el backend. Mismo texto que el easter egg
// "rickroll" de AI-Service/app/services/agent/easter_eggs.py.
const RESPUESTA_RICKROLL_REPETIDA =
  "😏 You just got Rickrolled. Classic.\n\n!video[Rickroll](https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1)";

function normalizarPreguntaParaComparar(texto: string): string {
  return texto.trim().toLowerCase();
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
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

export default function AsistenteIA() {
  const { usuarioId, email, session } = useAuth();
  const { registrarEvento, desbloquearLogro } = useGamification();
  const location = useLocation();
  const navigate = useNavigate();
  const estadoNavegacion = location.state as { messages?: Message[]; autoPrompt?: string } | null;
  const mensajesTraidos = estadoNavegacion?.messages;
  const autoPromptTraido = estadoNavegacion?.autoPrompt;
  const [messages, setMessages] = useState<Message[]>(mensajesTraidos ?? []);
  const [enviando, setEnviando] = useState(false);
  const [mensajePensando, setMensajePensando] = useState(
    "Finsi está analizando tus finanzas"
  );
  const [pasoPendiente, setPasoPendiente] = useState<PasoInteractivo>(null);
  const ultimoMensajeAsistenteId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
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
    mensajesScrollRef.current?.scrollTo({ top: mensajesScrollRef.current.scrollHeight, behavior: "smooth" });
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

  const handleSubmit = async (prompt: string) => {
    if (enviando) return;
    setPasoPendiente(null);

    const ultimaPreguntaUsuario = [...messages].reverse().find((m) => m.role === "user")?.text;
    const esPreguntaRepetida =
      ultimaPreguntaUsuario !== undefined &&
      normalizarPreguntaParaComparar(ultimaPreguntaUsuario) === normalizarPreguntaParaComparar(prompt);

    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: prompt },
    ]);

    if (esPreguntaRepetida) {
      setAgentTabStatus("💬 El agente está escribiendo...");
      if (sonidoActivo) playSendSound();
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: RESPUESTA_RICKROLL_REPETIDA },
      ]);
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
    const previousAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.text;
    try {
      const { answer } = await preguntarAgente(prompt, usuarioId, previousAnswer);
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: answer },
      ]);
      if (/¿Puedo ayudarte con algo más\?/i.test(answer)) {
        setPasoPendiente("support-help");
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

  const responderSoporte = (respuesta: "sí" | "no") => {
    setPasoPendiente(null);
    void handleSubmit(respuesta);
  };

  const irAImportarDatos = () => {
    setPasoPendiente(null);
    navigate("/importar-csv");
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
    setPasoPendiente(null);
    if (messages.length === 0) return;
    setMessages([]);
    setChatActualId(null);
    setHistorialAbierto(false);
  };

  const cargarChat = (chat: ChatGuardado) => {
    stopSpeaking();
    setMessages(chat.messages);
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

  return (
    <>
      <PageMeta title="FinanceAI | Asistente IA" description="Asistente de inteligencia artificial para tus finanzas" />
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
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.role === "assistant" && (
                      <AvatarFinsi />
                    )}
                    <div className={`flex max-w-[80%] flex-col ${message.role === "user" ? "items-end" : "items-stretch"}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-theme-sm ${
                          message.role === "user"
                            ? "whitespace-pre-line bg-brand-500 text-white"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {message.role === "assistant"
                          ? renderMensajeAsistente(limpiarMetadataInterna(message.text))
                          : message.text}
                      </div>
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
                    </div>
                  </div>
                ))}
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
                {!enviando && pasoPendiente && pasoPendiente !== "support-help" && (
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
            <PromptComposer onSubmit={handleSubmit} />
          </div>
        </section>
      </div>
    </>
  );
}
