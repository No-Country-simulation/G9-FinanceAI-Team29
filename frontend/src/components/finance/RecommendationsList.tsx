import { useNavigate } from "react-router";
import type { RecomendacionFinanciera } from "../../types/finance";

interface RecommendationsListProps {
  recomendaciones: RecomendacionFinanciera[];
  className?: string;
}

// El detector de intención del asistente interpreta "numero%" como una
// operación matemática a resolver (no como dato financiero) y rechaza la
// consulta, así que se reescribe a "numero por ciento" antes de enviarla.
const evitarPorcentajeLiteral = (texto: string) =>
  texto.replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 por ciento');

const estilosPrioridad: Record<RecomendacionFinanciera['prioridad'], string> = {
  alta: 'border-l-error-500 bg-error-50 dark:bg-error-500/10',
  media: 'border-l-warning-500 bg-warning-50 dark:bg-warning-500/10',
  sugerencia: 'border-l-info-500 bg-info-50 dark:bg-info-500/10',
};

const iconosPrioridad: Record<RecomendacionFinanciera['prioridad'], string> = {
  alta: '🔴',
  media: '🟡',
  sugerencia: '🔵',
};

export default function RecommendationsList({ recomendaciones, className = "" }: RecommendationsListProps) {
  const navigate = useNavigate();

  const preguntarleAFinsi = (recomendacion: RecomendacionFinanciera) => {
    const contexto = [
      recomendacion.preguntaFinsi,
      `Perfil financiero: ${recomendacion.perfil}.`,
      `Diagnóstico: ${evitarPorcentajeLiteral(recomendacion.diagnostico)}`,
      `Acción sugerida: ${recomendacion.accion}`,
      recomendacion.objetivo ? `Objetivo: ${evitarPorcentajeLiteral(recomendacion.objetivo)}` : null,
      recomendacion.advertencia,
      'Continúa desde esta recomendación, usa mis datos financieros actuales y no me pidas que repita el contexto.',
    ].filter(Boolean).join('\n\n');

    navigate('/asistente-ia', { state: { autoPrompt: contexto } });
  };

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Recomendaciones
      </h3>

      {recomendaciones.length > 0 ? (
        <div className="space-y-3">
          {recomendaciones.map((rec) => (
            <div
              key={rec.id}
              className={`p-3 rounded-lg border-l-4 ${estilosPrioridad[rec.prioridad]}`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{iconosPrioridad[rec.prioridad]}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{rec.titulo}</p>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{rec.diagnostico}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400"><strong>Acción:</strong> {rec.accion}</p>
                  <button
                    type="button"
                    onClick={() => preguntarleAFinsi(rec)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    💬 Preguntar a Finsi sobre esto
                  </button>
                </div>
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
