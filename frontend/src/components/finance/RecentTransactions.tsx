import { Transaccion } from '../../types/finance';
import { getCategoriaColor } from '../../utils/categoriaColors';

interface RecentTransactionsProps {
  transacciones: Transaccion[];
}

export default function RecentTransactions({ transacciones }: RecentTransactionsProps) {
  const ultimasTransacciones = transacciones.slice(0, 5);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Últimas Transacciones
      </h3>

      {ultimasTransacciones.length > 0 ? (
        <div className="space-y-3">
          {ultimasTransacciones.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <span className="text-lg">
                    {t.tipo === 'Ingreso' ? '📈' : '📉'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                    {t.descripcion}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.fecha} • {t.categoria}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold text-sm ${t.tipo === 'Ingreso' ? 'text-success-600' : 'text-error-600'}`}>
                  {t.tipo === 'Ingreso' ? '+' : '-'}{'$'}{t.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoriaColor(t.categoria)}`}>
                  {t.categoria}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-500">
          No hay transacciones registradas
        </div>
      )}
    </div>
  );
}
