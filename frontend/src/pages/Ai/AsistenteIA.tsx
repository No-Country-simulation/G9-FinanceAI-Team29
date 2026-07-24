import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PromptComposer from "../../components/ai/PromptComposer";
import { PlusIcon, ChatIcon } from "../../icons";
import { mostrarExito, mostrarError } from "../../utils/alerts";
import { preguntarAgente } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
}

const historial = [
  "¿Cómo voy con mis ahorros este mes?",
  "Resume mis gastos por categoría",
  "Ideas para reducir gastos hormiga",
  "Explica mi perfil financiero",
];

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

  const handleSubmit = async (prompt: string) => {
    if (enviando) return;
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: prompt },
    ]);
    setEnviando(true);
    try {
      const { answer } = await preguntarAgente(prompt, usuarioId);
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, role: "assistant", text: answer },
      ]);
    } catch {
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
    } finally {
      setEnviando(false);
    }
  };

  const nuevoChat = () => {
    if (messages.length === 0) return;
    setMessages([]);
    mostrarExito("Nueva conversación", "Se inició un chat nuevo con el asistente.");
  };

  return (
    <>
      <PageMeta title="FinanceAI | Asistente IA" description="Asistente de inteligencia artificial para tus finanzas" />
      <div className="flex h-[calc(100vh-150px)] gap-6">
        {/* Historial */}
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] xl:flex">
          <button
            onClick={nuevoChat}
            className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            <PlusIcon className="size-5" />
            Nuevo Chat
          </button>
          <p className="mb-2 px-2 text-theme-xs font-medium uppercase tracking-wide text-gray-400">
            Recientes
          </p>
          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto">
            {historial.map((item) => (
              <button
                key={item}
                className="flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-theme-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                <ChatIcon className="size-4 shrink-0" />
                <span className="truncate">{item}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversación */}
        <section className="flex flex-1 flex-col">
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                  <ChatIcon className="size-7" />
                </div>
                <h2 className="mt-4 text-title-sm font-bold text-gray-800 dark:text-white/90">
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
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                {enviando && (
                  <div className="flex justify-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15">
                      <ChatIcon className="size-4" />
                    </div>
                    <div className="rounded-2xl bg-gray-100 px-4 py-3 text-theme-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Escribiendo…
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
