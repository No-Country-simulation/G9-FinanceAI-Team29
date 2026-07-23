import { useState } from "react"
import { Bot, MessageSquare, Plus } from "lucide-react"
import PromptComposer from "../../components/ai/prompt-composer"
import { mostrarExito } from "../../utils/alerts"

interface Message {
  id: number
  role: "user" | "assistant"
  text: string
}

const historial = [
  "¿Cómo voy con mis ahorros este mes?",
  "Resume mis gastos por categoría",
  "Ideas para reducir gastos hormiga",
  "Explica mi perfil financiero",
]

const sugerencias = [
  "Resume mis gastos del último mes",
  "Dame consejos para ahorrar más",
  "Ayúdame a armar un presupuesto mensual",
  "Explica qué significa mi perfil financiero",
]

const respuestaDemo = (prompt: string) =>
  `Esta es una respuesta de demostración a: "${prompt}". Conecta este asistente a un modelo de IA real para obtener recomendaciones basadas en tus transacciones.`

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([])

  const handleSubmit = (prompt: string) => {
    setMessages((prev) => [
      ...prev,
      { id: prev.length + 1, role: "user", text: prompt },
      { id: prev.length + 2, role: "assistant", text: respuestaDemo(prompt) },
    ])
  }

  const nuevoChat = () => {
    if (messages.length === 0) return
    setMessages([])
    mostrarExito("Nueva conversación", "Se inició un chat nuevo con el asistente.")
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Historial */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-slate-800 bg-slate-900 p-4 xl:flex">
        <button
          onClick={nuevoChat}
          className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus size={18} />
          Nuevo Chat
        </button>
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Recientes
        </p>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {historial.map((item) => (
            <button
              key={item}
              className="flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <MessageSquare size={16} className="shrink-0" />
              <span className="truncate">{item}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Conversación */}
      <section className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-400">
                <Bot size={28} />
              </div>
              <h2 className="mt-4 text-xl font-bold text-slate-100">
                ¿En qué te puedo ayudar hoy?
              </h2>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
                {sugerencias.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    onClick={() => handleSubmit(sugerencia)}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-left text-sm text-slate-300 transition-colors hover:border-blue-800 hover:bg-slate-800"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 py-2">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
                      <Bot size={16} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <PromptComposer onSubmit={handleSubmit} />
        </div>
      </section>
    </div>
  )
}
