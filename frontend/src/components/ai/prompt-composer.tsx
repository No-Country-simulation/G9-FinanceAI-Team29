import { useState } from "react"
import { Send } from "lucide-react"

interface PromptComposerProps {
  placeholder?: string
  onSubmit: (prompt: string) => void
}

export default function PromptComposer({
  placeholder = "Escribe tu pregunta...",
  onSubmit,
}: PromptComposerProps) {
  const [value, setValue] = useState("")

  const submit = () => {
    if (!value.trim()) return
    onSubmit(value.trim())
    setValue("")
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Enviar
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
