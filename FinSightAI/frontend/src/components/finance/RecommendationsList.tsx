interface RecommendationsListProps {
  recomendaciones: string[];
}

export default function RecommendationsList({ recomendaciones }: RecommendationsListProps) {
  const getPrioridadColor = (index: number) => {
    if (index === 0) return 'border-l-error-500 bg-error-50 dark:bg-error-500/10';
    if (index === 1) return 'border-l-warning-500 bg-warning-50 dark:bg-warning-500/10';
    return 'border-l-info-500 bg-info-50 dark:bg-info-500/10';
  };

  const getIcono = (index: number) => {
    if (index === 0) return '🔴';
    if (index === 1) return '🟡';
    return '🔵';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Recomendaciones
      </h3>

      {recomendaciones.length > 0 ? (
        <div className="space-y-3">
          {recomendaciones.map((rec, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border-l-4 ${getPrioridadColor(index)}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{getIcono(index)}</span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{rec}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-500">
          No hay recomendaciones disponibles
        </div>
      )}
    </div>
  );
}
