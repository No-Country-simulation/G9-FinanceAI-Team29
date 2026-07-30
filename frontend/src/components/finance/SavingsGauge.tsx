interface SavingsGaugeProps {
  porcentajeAhorro: number;
  totalIngresos: number;
  totalGastos: number;
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SavingsGauge({
  porcentajeAhorro,
  totalIngresos,
  totalGastos,
}: SavingsGaugeProps) {
  const getColor = (pct: number) => {
    if (pct >= 20) return 'text-success-600';
    if (pct >= 10) return 'text-warning-600';
    return 'text-error-600';
  };

  const getMensaje = (pct: number) => {
    if (pct >= 20) {
      return 'Tu capacidad de ahorro es sólida. Mantené este ritmo y considerá destinar el excedente a una meta a largo plazo.';
    }
    if (pct >= 10) {
      return 'Estás ahorrando, pero hay margen para mejorar. Revisá tus categorías de gasto variable.';
    }
    if (pct >= 0) {
      return 'Tu ahorro es bajo este período. Ajustar gastos no esenciales puede darte más margen.';
    }
    return 'Estás gastando más de lo que ingresás este mes. Priorizá reducir gastos variables antes de fin de mes.';
  };

  const porcentajeVisible = Math.max(0, Math.min(porcentajeAhorro, 100));
  const ahorroEstimado = totalIngresos - totalGastos;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Capacidad de Ahorro
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Porcentaje de tus ingresos que queda disponible
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-between gap-6">
        <div
          className="relative h-56 w-56"
          role="progressbar"
          aria-label="Capacidad de ahorro"
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
              className={getColor(porcentajeAhorro)}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${getColor(porcentajeAhorro)}`}>
              {porcentajeAhorro.toFixed(1)}%
            </span>
            <span className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
              ahorro estimado
            </span>
          </div>
        </div>

        <div className="w-full space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500">Ingresos</span>
            <span className="font-semibold tabular-nums text-gray-800 dark:text-white/90">
              {money.format(totalIngresos)}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500">Gastos</span>
            <span className="font-semibold tabular-nums text-gray-800 dark:text-white/90">
              {money.format(totalGastos)}
            </span>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
            <span className="text-gray-500">Ahorro estimado</span>
            <span className={`font-semibold tabular-nums ${getColor(porcentajeAhorro)}`}>
              {money.format(ahorroEstimado)}
            </span>
          </div>
        </div>

        <p className="w-full border-t border-gray-100 pt-4 text-center text-sm leading-5 text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {getMensaje(porcentajeAhorro)}
        </p>
      </div>
    </div>
  );
}
