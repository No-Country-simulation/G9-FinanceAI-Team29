import { useState, useEffect } from 'react';
import PageMeta from "../../components/common/PageMeta";
import { analizarFinanzas, obtenerUsuario, obtenerTransacciones } from "../../services/api";
import { AnalisisResponse } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { mostrarError } from "../../utils/alerts";

export default function Recomendaciones() {
  const [resultado, setResultado] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const usuarioId = 'USR0001';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [perfil, transacciones] = await Promise.all([
          obtenerUsuario(usuarioId),
          obtenerTransacciones(usuarioId),
        ]);
        const request = construirAnalisisRequest(perfil, transacciones);
        const result = await analizarFinanzas(request, usuarioId);
        setResultado(result);
      } catch (err) {
        console.error(err);
        mostrarError('No se pudieron cargar las recomendaciones', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  // Mismos umbrales que SavingsGauge en el Dashboard, para que el color signifique lo mismo en toda la app.
  const getAhorroColor = (pct: number) => {
    if (pct >= 20) return 'text-success-600';
    if (pct >= 10) return 'text-warning-600';
    return 'text-error-600';
  };

  return (
    <>
      <PageMeta title="FinanceAI | Recomendaciones" description="Recomendaciones financieras personalizadas" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Recomendaciones</h1>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : resultado ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Tu Perfil Financiero</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Clasificación</p>
                  <p className="text-xl font-bold text-brand-600">{resultado.perfilFinanciero}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-500">Ingresos</p>
                    <p className="text-lg font-bold text-success-600">
                      ${resultado.totalIngresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-500">Gastos</p>
                    <p className="text-lg font-bold text-error-600">
                      ${resultado.totalGastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Capacidad de Ahorro</p>
                  <p className={`text-lg font-bold ${getAhorroColor(resultado.porcentajeAhorro)}`}>{resultado.porcentajeAhorro.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Recomendaciones Personalizadas</h2>
              
              {resultado.recomendaciones.length > 0 ? (
                <div className="space-y-3">
                  {resultado.recomendaciones.map((rec, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 ${getPrioridadColor(index)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getIcono(index)}</span>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white/90 mb-1">
                            {index === 0 ? 'Prioridad Alta' : index === 1 ? 'Prioridad Media' : 'Sugerencia'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{rec}</p>
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
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No se pudieron cargar las recomendaciones
          </div>
        )}
      </div>
    </>
  );
}
