interface SavingsGaugeProps {
  porcentajeAhorro: number;
  totalIngresos: number;
  totalGastos: number;
}

export default function SavingsGauge({ porcentajeAhorro, totalIngresos, totalGastos }: SavingsGaugeProps) {
  const getColor = (pct: number) => {
    if (pct >= 20) return 'text-success-600';
    if (pct >= 10) return 'text-warning-600';
    return 'text-error-600';
  };

  const getMensaje = (pct: number) => {
    if (pct >= 20) return 'Tu capacidad de ahorro es sólida. Mantené este ritmo y considerá destinar el excedente a una meta a largo plazo.';
    if (pct >= 10) return 'Estás ahorrando, pero hay margen para mejorar. Revisá tus categorías de gasto variable.';
    if (pct >= 0) return 'Tu ahorro es bajo este período. Ajustar gastos no esenciales puede darte más margen.';
    return 'Estás gastando más de lo que ingresás este mes. Priorizá reducir gastos variables antes de fin de mes.';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Capacidad de Ahorro
      </h3>

      <div className="flex flex-col items-center flex-1">
        <div className="relative w-32 h-32 mb-4">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              strokeDasharray={`${Math.min(porcentajeAhorro, 100) * 3.14} 314`}
              className={getColor(porcentajeAhorro)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${getColor(porcentajeAhorro)}`}>
              {porcentajeAhorro.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">ahorro</span>
          </div>
        </div>

        <div className="w-full space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ingresos</span>
            <span className="font-medium text-gray-800 dark:text-white/90">
              ${totalIngresos?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gastos</span>
            <span className="font-medium text-gray-800 dark:text-white/90">
              ${totalGastos?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Ahorro estimado</span>
            <span className={`font-medium ${getColor(porcentajeAhorro)}`}>
              ${(totalIngresos - totalGastos)?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center">
          {getMensaje(porcentajeAhorro)}
        </p>
      </div>
    </div>
  );
}
