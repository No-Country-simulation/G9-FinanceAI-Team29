import type { RecomendacionFinanciera } from "../../types/finance";

interface RecommendationsListProps {
  recomendaciones: RecomendacionFinanciera[];
}

const estilos = {
  alta: "border-l-error-500 bg-error-50 dark:bg-error-500/10",
  media: "border-l-warning-500 bg-warning-50 dark:bg-warning-500/10",
  sugerencia: "border-l-info-500 bg-info-50 dark:bg-info-500/10",
};
const iconos = { alta: "🔴", media: "🟡", sugerencia: "🔵" };

export default function RecommendationsList({ recomendaciones }: RecommendationsListProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Recomendaciones</h3>
      {recomendaciones.length > 0 ? (
        <div className="space-y-3">
          {recomendaciones.map((rec) => (
            <div key={rec.id} className={`rounded-lg border-l-4 p-3 ${estilos[rec.prioridad]}`}>
              <div className="flex items-start gap-2">
                <span className="text-sm">{iconos[rec.prioridad]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{rec.titulo}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{rec.diagnostico}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400"><strong>Acción:</strong> {rec.accion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center text-gray-500">No hay recomendaciones disponibles</div>
      )}
    </div>
  );
}
