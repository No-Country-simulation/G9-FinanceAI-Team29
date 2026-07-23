import { Transaccion } from '../../types/finance';

interface MonthlyStatsCardProps {
  transacciones: Transaccion[];
}

export default function MonthlyStatsCard({ transacciones }: MonthlyStatsCardProps) {
  const totalesPorMes = new Map<string, number>();

  transacciones
    .filter(t => t.tipo === 'Gasto')
    .forEach(t => {
      const fecha = new Date(t.fecha);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      totalesPorMes.set(clave, (totalesPorMes.get(clave) || 0) + t.monto);
    });

  const clavesOrdenadas = Array.from(totalesPorMes.keys()).sort();

  const formatearEtiqueta = (clave: string) => {
    const [anio, mes] = clave.split('-');
    const etiqueta = new Date(Number(anio), Number(mes) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'long' })
      .replace('.', '');
    return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
  };

  if (clavesOrdenadas.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full flex items-center justify-center">
        <p className="text-sm text-gray-500">Sin datos suficientes</p>
      </div>
    );
  }

  const valores = clavesOrdenadas.map(c => totalesPorMes.get(c) || 0);
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

  let claveMax = clavesOrdenadas[0];
  let claveMin = clavesOrdenadas[0];
  clavesOrdenadas.forEach(clave => {
    if ((totalesPorMes.get(clave) || 0) > (totalesPorMes.get(claveMax) || 0)) claveMax = clave;
    if ((totalesPorMes.get(clave) || 0) < (totalesPorMes.get(claveMin) || 0)) claveMin = clave;
  });

  const ultimo = valores[valores.length - 1];
  const anterior = valores.length > 1 ? valores[valores.length - 2] : null;
  const variacion = anterior !== null && anterior > 0 ? ((ultimo - anterior) / anterior) * 100 : null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Estadísticas del Período
      </h3>

      <div className="space-y-4 flex-1">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Promedio mensual</span>
          <p className="text-xl font-bold text-gray-800 dark:text-white/90">
            ${promedio.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Mes más alto</span>
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-white/90">{formatearEtiqueta(claveMax)}</span>
            <span className="font-medium text-error-600">
              ${(totalesPorMes.get(claveMax) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">Mes más bajo</span>
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-800 dark:text-white/90">{formatearEtiqueta(claveMin)}</span>
            <span className="font-medium text-success-600">
              ${(totalesPorMes.get(claveMin) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {variacion !== null && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Vs. mes anterior</span>
            <span className={`inline-flex items-center gap-1 text-sm font-medium ${variacion > 0 ? 'text-error-600' : 'text-success-600'}`}>
              {variacion > 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
