import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ChatIcon, CloseIcon, PaperPlaneIcon, BoltIcon } from "../../icons";
import { preguntarAgente } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { speakText, stopSpeaking, isSpeechSupported } from "../../utils/speech";
import { playSendSound, playReceiveSound, playErrorSound, startTypingSound, stopTypingSound } from "../../utils/sound";
import { renderMensajeAsistente } from "../../utils/renderMensajeAsistente";
import { setAgentTabStatus } from "../../utils/tabTitle";
import { useEsModoMatrix } from "../../hooks/useEsModoMatrix";
import {
  esErrorSinDatos,
  MENSAJE_SIN_DATOS,
  MENSAJE_OTRA_CONSULTA,
  construirMensajeDespedida,
} from "../../utils/sinDatosFlow";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

type PasoInteractivo = "sin-datos" | "otra-consulta" | null;

const sugerencias = [
  "Resume mis gastos del último mes",
  "Dame consejos para ahorrar más",
];

const MENSAJE_EXPLICAME_MAS = "Explícame más";

function normalizarPreguntaParaComparar(texto: string): string {
  return texto.trim().toLowerCase();
}

function puedeMostrarExplicameMas(texto: string): boolean {
  const limpio = texto.trim();

  if (!limpio || limpio.length < 80) {
    return false;
  }

  // No mostrar "Explícame más" en saludos, cierres ni respuestas
  // conversacionales simples: el botón está pensado para contenido
  // informativo/financiero que realmente pueda ampliarse.
  const respuestaConversacional = (
    /^👋?\s*hola[,!.\s]/i.test(limpio) ||
    /^hola[,!.\s]/i.test(limpio) ||
    /^¡?hola[,!.\s]/i.test(limpio) ||
    /soy\s+\*\*?finsi\*\*?,?\s+el asistente de finsightai/i.test(limpio) ||
    /¿En qué puedo ayudarte hoy\?/i.test(limpio) ||
    /¿En qué más puedo ayudarte\?/i.test(limpio) ||
    /Para preguntas de soporte, en el selector de abajo/i.test(limpio) ||
    /Para preguntas financieras, en el selector de abajo/i.test(limpio) ||
    /^¡?perfecto!/i.test(limpio) ||
    /^¡?genial!/i.test(limpio) ||
    /^de acuerdo[.!]/i.test(limpio) ||
    /^gracias\b/i.test(limpio)
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

/** Tras estas cantidades de respuestas del asistente se invita a continuar
 * la charla en la página completa, para no interrumpir cada mensaje. */
const RESPUESTAS_PARA_INVITAR = [1, 2];

function PersonaHablandoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="8" r="3" fill="currentColor" />
      <path d="M4 19c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M15.8 7.5c.7.7 1.1 1.56 1.1 2.5s-.4 1.8-1.1 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M18 5.3c1.27 1.27 2 3 2 4.7s-.73 3.43-2 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Botón flotante de acceso rápido al Asistente IA, visible en todas las
 * secciones autenticadas excepto la propia página del Asistente IA. */
export default function FloatingChatWidget() {
  const { usuarioId, email } = useAuth();
  const navigate = useNavigate();
  const enModoMatrix = useEsModoMatrix();
  const [abierto, setAbierto] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pasoPendiente, setPasoPendiente] = useState<PasoInteractivo>(null);
  const [vozActiva, setVozActiva] = useState(
    () => localStorage.getItem("asistenteVozActiva") === "true"
  );
  const [sonidoActivo, setSonidoActivo] = useState(
    () => localStorage.getItem("asistenteSonidoActivo") !== "false"
  );
  const [invitacionVisible, setInvitacionVisible] = useState(false);
  const [invitacionDescartada, setInvitacionDescartada] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const respuestasCountRef = useRef(0);
  const ultimoMensajeAsistenteId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const ultimaPreguntaUsuarioTexto = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, enviando, invitacionVisible]);

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

  const toggleVoz = () => setVozActiva((prev) => !prev);
  const toggleSonido = () => setSonidoActivo((prev) => !prev);

  const continuarEnAsistente = () => {
    stopSpeaking();
    navigate("/asistente-ia", { state: { messages } });
  };

  const enviarPregunta = async (pregunta: string) => {
    if (!pregunta.trim() || enviando) return;
    setInvitacionVisible(false);
    setPasoPendiente(null);
    setMessages((prev) => [...prev, { id: prev.length + 1, role: "user", text: pregunta }]);
    setValue("");
    setEnviando(true);
    setAgentTabStatus("💬 El agente está escribiendo...");
    if (sonidoActivo) {
      playSendSound();
      startTypingSound();
    }
    const previousAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.text;
    try {
      const { answer } = await preguntarAgente(pregunta, usuarioId, previousAnswer);
      setMessages((prev) => [...prev, { id: prev.length + 1, role: "assistant", text: answer }]);
      setAgentTabStatus("✅ El agente ha respondido", 2000);
      if (sonidoActivo) playReceiveSound();
      if (vozActiva) speakText(answer);

      respuestasCountRef.current += 1;
      if (!invitacionDescartada && RESPUESTAS_PARA_INVITAR.includes(respuestasCountRef.current)) {
        setInvitacionVisible(true);
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
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            role: "assistant",
            text: "No pude responder ahora mismo. Intenta de nuevo o abre el Asistente IA completo.",
          },
        ]);
      }
    } finally {
      stopTypingSound();
      setEnviando(false);
    }
  };

  const handleSubmit = () => void enviarPregunta(value);

  const irAImportarDatos = () => {
    setPasoPendiente(null);
    setAbierto(false);
    navigate("/importar-csv");
  };

  const responderOtraConsulta = () => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: MENSAJE_OTRA_CONSULTA },
    ]);
    setPasoPendiente("otra-consulta");
  };

  const nuevoChat = () => {
    stopSpeaking();
    setPasoPendiente(null);
    setMessages([]);
    respuestasCountRef.current = 0;
    setInvitacionDescartada(false);
  };

  const finalizarSesion = async () => {
    setPasoPendiente(null);
    const despedida = await construirMensajeDespedida(usuarioId, email);
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "assistant", text: despedida },
    ]);
    setTimeout(() => {
      setAbierto(false);
      navigate("/");
    }, 1000);
  };

  return (
    <>
      {/* Panel de chat */}
      <div
        className={`fixed bottom-24 right-5 z-99999 flex w-[calc(100vw-2.5rem)] max-w-90 flex-col overflow-hidden rounded-2xl border shadow-theme-lg transition-all duration-200 ease-in-out dark:border-gray-800 dark:bg-gray-900 sm:right-6 ${
          enModoMatrix ? "border-error-900/40 bg-gray-950" : "border-gray-200 bg-white"
        } ${abierto ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
        style={{ height: "min(32rem, 70vh)" }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between gap-2 px-4 py-3.5 ${enModoMatrix ? "bg-error-700" : "bg-brand-500"}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
              <ChatIcon className="size-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Asistente IA</p>
              <p className="text-theme-xs text-white/80">Siempre disponible para ayudarte</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleSonido}
              title={sonidoActivo ? "Desactivar efectos de sonido" : "Activar efectos de sonido"}
              aria-label={sonidoActivo ? "Desactivar efectos de sonido" : "Activar efectos de sonido"}
              aria-pressed={sonidoActivo}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                sonidoActivo ? "bg-white/25 text-white" : "text-white/80 hover:bg-white/15 hover:text-white"
              }`}
            >
              <BoltIcon className="size-4.5" />
            </button>
            {isSpeechSupported() && (
              <button
                onClick={toggleVoz}
                title={vozActiva ? "Desactivar voz de lectura" : "Activar voz de lectura"}
                aria-label={vozActiva ? "Desactivar voz de lectura" : "Activar voz de lectura"}
                aria-pressed={vozActiva}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  vozActiva ? "bg-white/25 text-white" : "text-white/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                <PersonaHablandoIcon className="size-4.5" />
              </button>
            )}
            <button
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-900">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15" aria-hidden="true">
                <ChatIcon className="size-5" />
              </div>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                Pregúntame sobre tus finanzas o
                {" "}
                <button
                  onClick={() => navigate("/asistente-ia")}
                  className="font-medium text-brand-500 hover:underline"
                >
                  abre el chat completo
                </button>
                .
              </p>
              <div className="flex w-full flex-col gap-2">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    onClick={() => void enviarPregunta(s)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-theme-xs text-gray-600 transition hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[85%] flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-theme-xs ${
                      m.role === "user"
                        ? "whitespace-pre-line bg-brand-500 text-white"
                        : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {m.role === "assistant" ? renderMensajeAsistente(m.text) : m.text}
                  </div>

                  {m.role === "assistant" &&
                    m.id === ultimoMensajeAsistenteId &&
                    !enviando &&
                    !pasoPendiente &&
                    normalizarPreguntaParaComparar(ultimaPreguntaUsuarioTexto) !==
                      normalizarPreguntaParaComparar(MENSAJE_EXPLICAME_MAS) &&
                    puedeMostrarExplicameMas(m.text) && (
                      <button
                        type="button"
                        onClick={() => void enviarPregunta(MENSAJE_EXPLICAME_MAS)}
                        disabled={enviando}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-theme-xs font-medium text-brand-600 transition hover:border-brand-300 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-800 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                      >
                        <span aria-hidden="true">✨</span>
                        Explícame más
                      </button>
                    )}
                </div>
              </div>
            ))
          )}
          {enviando && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl bg-white px-3.5 py-2.5 dark:bg-gray-800">
                <span className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s] dark:bg-gray-500" />
                <span className="size-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s] dark:bg-gray-500" />
                <span className="size-1.5 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500" />
              </div>
            </div>
          )}

          {!enviando && pasoPendiente && (
            <div className="flex justify-start gap-2">
              {pasoPendiente === "sin-datos" ? (
                <>
                  <button
                    onClick={irAImportarDatos}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-theme-xs font-medium text-white transition hover:bg-brand-600"
                  >
                    Sí
                  </button>
                  <button
                    onClick={responderOtraConsulta}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={nuevoChat}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-theme-xs font-medium text-white transition hover:bg-brand-600"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => void finalizarSesion()}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                  >
                    No
                  </button>
                </>
              )}
            </div>
          )}

          {invitacionVisible && !enviando && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-theme-xs text-gray-700 dark:border-brand-800 dark:bg-brand-500/10 dark:text-gray-200">
                <p className="mb-2">¿Quieres seguir esta conversación con más espacio en el Asistente IA completo?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={continuarEnAsistente}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-theme-xs font-medium text-white transition hover:bg-brand-600"
                  >
                    Continuar allá
                  </button>
                  <button
                    onClick={() => {
                      setInvitacionVisible(false);
                      setInvitacionDescartada(true);
                    }}
                    className="rounded-lg px-3 py-1.5 text-theme-xs font-medium text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className={`flex items-center gap-2 border-t p-2.5 dark:border-gray-800 dark:bg-gray-900 ${
            enModoMatrix ? "border-error-900/40 bg-gray-950" : "border-gray-200 bg-white"
          }`}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Escribe tu mensaje..."
            className={`w-full flex-1 rounded-full border px-3.5 py-2 text-theme-xs focus:outline-hidden dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 ${
              enModoMatrix
                ? "border-error-900/40 bg-white/[0.03] text-white/90 placeholder:text-error-400/50"
                : "border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400"
            }`}
          />
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || enviando}
            aria-label="Enviar mensaje"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              enModoMatrix ? "bg-error-600 hover:bg-error-500" : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            <PaperPlaneIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setAbierto((prev) => !prev)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        className={`fixed bottom-5 right-5 z-99999 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-theme-lg transition-all duration-200 hover:scale-105 sm:right-6 ${
          enModoMatrix ? "bg-error-600 hover:bg-error-500" : "bg-brand-500 hover:bg-brand-600"
        }`}
      >
        <span className={`absolute transition-all duration-200 ${abierto ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}>
          <ChatIcon className="size-6" />
        </span>
        <span className={`absolute transition-all duration-200 ${abierto ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}>
          <CloseIcon className="size-6" />
        </span>
      </button>
    </>
  );
}