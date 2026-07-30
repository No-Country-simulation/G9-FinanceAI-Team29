import { useEffect, useMemo, useState, type ReactNode } from "react";
import PageMeta from "../../components/common/PageMeta";
import PromptComposer from "../../components/ai/PromptComposer";
import { PlusIcon, ChatIcon, BoltIcon, TrashBinIcon, CloseIcon } from "../../icons";
import { mostrarError } from "../../utils/alerts";
import { preguntarAgente } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { speakText, stopSpeaking, isSpeechSupported } from "../../utils/speech";
import { playSendSound, playReceiveSound, playErrorSound, startTypingSound, stopTypingSound } from "../../utils/sound";

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

function renderConNegritas(text: string) {
  const partes = text.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((parte, i) => {
    const match = parte.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return <strong key={i}>{match[1]}</strong>;
    }
    return parte;
  });
}

function renderMensajeAsistente(text: string) {
  const lineas = text.split("\n");
  const bloques: ReactNode[] = [];
  let viñetaActual: string[] = [];

  const cerrarViñetas = () => {
    if (viñetaActual.length > 0) {
      bloques.push(
        <ul key={`ul-${bloques.length}`} className="list-disc space-y-1 pl-5">
          {viñetaActual.map((item, i) => (
            <li key={i}>{renderConNegritas(item)}</li>
          ))}
        </ul>
      );
      viñetaActual = [];
    }
  };

  lineas.forEach((linea, i) => {
    const match = linea.match(/^\s*[*-]\s+(.*)$/);
    if (match) {
      viñetaActual.push(match[1]);
    } else {
      cerrarViñetas();
      if (linea.trim() !== "") {
        bloques.push(<p key={`p-${bloques.length}`}>{renderConNegritas(linea)}</p>);
      } else if (i !== lineas.length - 1) {
        bloques.push(<div key={`br-${bloques.length}`} className="h-2" />);
      }
    }
  });
  cerrarViñetas();

  return <div className="space-y-2">{bloques}</div>;
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

export default function AsistenteIA() {
  const { usuarioId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [enviando, setEnviando] = useState(false);
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

  useEffect(() => {
    setChatsGuardados(cargarChatsGuardados(usuarioId));
    setMessages([]);
    setChatActualId(null);
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
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: prompt },
    ]);
    setEnviando(true);
    if (sonidoActivo) {
      playSendSound();
      startTypingSound();
    }
    try {
      const { answer } = await preguntarAgente(prompt, usuarioId);
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: answer },
      ]);
      if (sonidoActivo) playReceiveSound();
      if (vozActiva) speakText(answer);
    } catch {
      mostrarError(
        "No se pudo consultar el asistente",
        "Revisa que el AI-Service (:8000) esté levantado y que tenga configurada la GROQ_API_KEY."
      );
      if (sonidoActivo) playErrorSound();
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          role: "assistant",
          text: "Ahora mismo no puedo responder. Verifica que el servicio de IA esté disponible.",
        },
      ]);
    } finally {
      stopTypingSound();
      setEnviando(false);
    }
  };

  const nuevoChat = () => {
    if (messages.length === 0) return;
    setMessages([]);
    setChatActualId(null);
    setHistorialAbierto(false);
  };

  const cargarChat = (chat: ChatGuardado) => {
    setMessages(chat.messages);
    setChatActualId(chat.id);
    setHistorialAbierto(false);
  };

  const eliminarChat = (id: string, evento: React.MouseEvent) => {
    evento.stopPropagation();
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
        <section className="flex flex-1 flex-col overflow-hidden">
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
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-theme-xs font-medium transition ${
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
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-theme-xs font-medium transition ${
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
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                  <ChatIcon className="size-7" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-gray-800 dark:text-white/90 sm:text-title-sm">
                  ¿En qué te puedo ayudar hoy?
                </h2>
                <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                  {sugerencias.map((sugerencia) => (
                    <button
                      key={sugerencia}
                      onClick={() => handleSubmit(sugerencia)}
                      className="rounded-xl border border-gray-200 bg-white p-4 text-left text-theme-sm text-gray-600 transition hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-800"
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
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                        <ChatIcon className="size-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-theme-sm ${
                        message.role === "user"
                          ? "whitespace-pre-line bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {message.role === "assistant" ? renderMensajeAsistente(message.text) : message.text}
                    </div>
                  </div>
                ))}
                {enviando && (
                  <div className="flex justify-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                      <ChatIcon className="size-4 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                      <span className="size-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s] dark:bg-gray-500" />
                      <span className="size-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s] dark:bg-gray-500" />
                      <span className="size-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <PromptComposer onSubmit={handleSubmit} />
          </div>
        </section>
      </div>
    </>
  );
}
