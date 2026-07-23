interface DebtBadgeProps {
  nivelEndeudamiento: number;
}

export default function DebtBadge({ nivelEndeudamiento }: DebtBadgeProps) {
  const getNivel = (nivel: number) => {
    if (nivel <= 20) return { texto: 'Bajo', color: 'text-success-600 bg-success-50 dark:bg-success-500/10', barColor: 'bg-success-500' };
    if (nivel <= 40) return { texto: 'Moderado', color: 'text-warning-600 bg-warning-50 dark:bg-warning-500/10', barColor: 'bg-warning-500' };
    return { texto: 'Alto', color: 'text-error-600 bg-error-50 dark:bg-error-500/10', barColor: 'bg-error-500' };
  };

  const nivel = getNivel(nivelEndeudamiento);

  const getMensaje = (nivelTexto: string) => {
    if (nivelTexto === 'Bajo') return 'Tu endeudamiento está en un nivel saludable, dentro del rango recomendado.';
    if (nivelTexto === 'Moderado') return 'Tu endeudamiento es moderado. Evitá tomar nuevas deudas hasta bajar del 30%.';
    return 'Tu endeudamiento es alto. Priorizá pagar las deudas de mayor interés primero.';
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Nivel de Endeudamiento
      </h3>

      <div className="flex flex-col items-center flex-1">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${nivel.color}`}>
          {nivel.texto}
        </span>

        <div className="w-full mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">0%</span>
            <span className="font-medium text-gray-800 dark:text-white/90">{nivelEndeudamiento}%</span>
            <span className="text-gray-500">100%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full dark:bg-gray-700">
            <div
              className={`h-3 rounded-full ${nivel.barColor}`}
              style={{ width: `${Math.min(nivelEndeudamiento, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="w-full space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Recomendado</span>
            <span className="font-medium text-success-600">≤ 30%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Riesgo medio</span>
            <span className="font-medium text-warning-600">30-50%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Riesgo alto</span>
            <span className="font-medium text-error-600">&gt; 50%</span>
          </div>
        </div>

        <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center">
          {getMensaje(nivel.texto)}
        </p>
      </div>
    </div>
  );
}
