import type { ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <article
      className={[
        "rounded-2xl border border-slate-800 bg-slate-900 p-6",
        className,
      ].join(" ")}
    >
      {children}
    </article>
  )
}