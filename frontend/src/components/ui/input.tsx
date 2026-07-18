import type { InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-200">
          {label}
        </label>
      )}

      <input
        id={id}
        className={[
          "w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500",
          error
            ? "border-rose-500 focus:border-rose-400"
            : "border-slate-700 focus:border-blue-500",
          className,
        ].join(" ")}
        {...props}
      />

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}