import { useState } from "react";
import { PaperPlaneIcon } from "../../icons";

interface PromptComposerProps {
  placeholder?: string;
  models?: string[];
  buttonLabel?: string;
  onSubmit: (prompt: string) => void;
}

/** Barra de prompt inferior del Asistente IA. */
export default function PromptComposer({
  placeholder = "Escribe tu pregunta...",
  models = ["FinanceAI Advisor"],
  buttonLabel,
  onSubmit,
}: PromptComposerProps) {
  const [value, setValue] = useState("");
  const [model, setModel] = useState(models[0]);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue("");
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder={placeholder}
        className="w-full resize-none bg-transparent px-2 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
      />
      <div className="mt-2 flex items-center justify-between">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-theme-xs font-medium text-gray-600 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {models.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <button
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          {buttonLabel ?? "Enviar"}
          <PaperPlaneIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
