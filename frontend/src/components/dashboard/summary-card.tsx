import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

interface SummaryCardProps {
  title: string
  value: string
  change: string
  trend: "up" | "down"
  icon: LucideIcon
}

export default function SummaryCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
}: SummaryCardProps) {
  const isPositive = trend === "up"

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>

          <p className="mt-2 text-2xl font-bold text-slate-100">
            {value}
          </p>
        </div>

        <div className="flex size-11 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
          <Icon size={22} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={[
            "flex items-center gap-1 text-sm font-medium",
            isPositive ? "text-emerald-400" : "text-rose-400",
          ].join(" ")}
        >
          {isPositive ? (
            <ArrowUpRight size={16} />
          ) : (
            <ArrowDownRight size={16} />
          )}

          {change}
        </span>

        <span className="text-xs text-slate-500">
          respecto al mes anterior
        </span>
      </div>
    </article>
  )
}