interface DebtBadgeProps {
  nivelEndeudamiento: number;
}

export default function DebtBadge({ nivelEndeudamiento }: DebtBadgeProps) {
  const getNivel = (nivel: number) => {
    if (nivel <= 30) {
      return {
        texto: 'Bajo',
        badgeColor: 'text-success-600 bg-success-50 dark:bg-success-500/10',
        ringColor: 'text-success-500',
      };
    }
    if (nivel <= 50) {
      return {
        texto: 'Moderado',
        badgeColor: 'text-warning-600 bg-warning-50 dark:bg-warning-500/10',
        ringColor: 'text-warning-500',
      };
    }
    return {
      texto: 'Alto',
      badgeColor: 'text-error-600 bg-error-50 dark:bg-error-500/10',
      ringColor: 'text-error-500',
    };
  };

  const nivel = getNivel(nivelEndeudamiento);
  const porcentajeVisible = Math.max(0, Math.min(nivelEndeudamiento, 100));

  const getMensaje = (nivelTexto: string) => {
    if (nivelTexto === 'Bajo') {
      return 'Tu endeudamiento está en un nivel saludable, dentro del rango recomendado.';
    }
    if (nivelTexto === 'Moderado') {
      return 'Tu endeudamiento es moderado. Evitá tomar nuevas deudas hasta bajar del 30%.';
    }
    return 'Tu endeudamiento es alto. Priorizá pagar las deudas de mayor interés primero.';
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Nivel de Endeudamiento
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Proporción de tus ingresos destinada a deudas
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-between gap-6">
        <div
          className="relative h-56 w-56"
          role="progressbar"
          aria-label="Nivel de endeudamiento"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentajeVisible}
        >
          <svg className="h-56 w-56 -rotate-90 transform" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="10"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="10"
              fill="none"
              strokeDasharray={`${porcentajeVisible * 3.14} 314`}
              strokeLinecap="round"
              className={nivel.ringColor}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tabular-nums text-gray-800 dark:text-white/90">
              {nivelEndeudamiento.toFixed(1)}%
            </span>
            <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${nivel.badgeColor}`}>
              Nivel {nivel.texto.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="w-full space-y-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/[0.03]">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Recomendado</span>
            <span className="font-semibold text-success-600">≤ 30%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Riesgo medio</span>
            <span className="font-semibold text-warning-600">30–50%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Riesgo alto</span>
            <span className="font-semibold text-error-600">&gt; 50%</span>
          </div>
        </div>

        <p className="w-full border-t border-gray-100 pt-4 text-center text-sm leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {getMensaje(nivel.texto)}
        </p>
      </div>
    </div>
  );
}
