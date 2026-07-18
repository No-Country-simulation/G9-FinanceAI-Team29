interface Insight {
  id: number
  message: string
  type: "info" | "success" | "warning"
}

interface AiInsightsProps {
  insights: Insight[]
}

export default function AiInsights({
  insights,
}: AiInsightsProps) {
  const colors = {
    info: "border-blue-500/20 bg-blue-500/10",
    success: "border-emerald-500/20 bg-emerald-500/10",
    warning: "border-amber-500/20 bg-amber-500/10",
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold text-slate-100">
        Análisis inteligente
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Recomendaciones generadas por IA.
      </p>

      <div className="mt-6 space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={[
              "rounded-xl border p-4",
              colors[insight.type],
            ].join(" ")}
          >
            <p className="text-sm leading-6 text-slate-300">
              {insight.message}
            </p>
          </div>
        ))}
      </div>
    </article>
  )
}