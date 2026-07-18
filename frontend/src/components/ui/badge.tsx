import type { ReactNode } from "react"

interface BadgeProps {
  children: ReactNode
  variant?: "success" | "warning" | "danger" | "info" | "neutral"
}

export default function Badge({
  children,
  variant = "neutral",
}: BadgeProps) {
  const variants = {
    success: "bg-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/15 text-amber-400",
    danger: "bg-rose-500/15 text-rose-400",
    info: "bg-blue-500/15 text-blue-400",
    neutral: "bg-slate-700 text-slate-300",
  }

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variants[variant],
      ].join(" ")}
    >
      {children}
    </span>
  )
}