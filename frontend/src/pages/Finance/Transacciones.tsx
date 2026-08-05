import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import PageMeta from "../../components/common/PageMeta";
import ExportMenu from "../../components/common/ExportMenu";
import { SkeletonBlock } from "../../components/common/Skeleton";
import { formatMoney } from "../../utils/export/format";
import { exportDashboardXlsx } from "../../utils/export/exportXlsxDashboard";
import { obtenerTransacciones } from "../../services/api";
import Pagination from "../../components/ui/pagination/Pagination";
import { Transaccion } from "../../types/finance";
import { getCategoriaColor } from "../../utils/categoriaColors";
import { mostrarError, mostrarInfo } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";

function TransaccionesSkeleton() {
  return (
    <>
      {/* Vista de tarjetas — solo móvil */}
      <div className="space-y-3 sm:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
              <SkeletonBlock className="h-4 w-16 shrink-0" />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <SkeletonBlock className="h-5 w-16 rounded-full" />
              <SkeletonBlock className="h-5 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Vista de tabla — desde sm hacia arriba */}
      <div className="hidden animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:block">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div className="flex gap-10">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-14" />
            <SkeletonBlock className="ml-auto h-3 w-16" />
          </div>
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-10 border-b border-gray-100 px-6 py-4 last:border-b-0 dark:border-gray-800/50">
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-5 w-20 rounded-full" />
            <SkeletonBlock className="h-5 w-16 rounded-full" />
            <SkeletonBlock className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function Transacciones() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('Todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const POR_PAGINA = 20;

  const { usuarioId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await obtenerTransacciones(usuarioId);
        setTransacciones(data);

        if (data.length === 0) {
          await mostrarInfo(
            'Todavía no tienes movimientos cargados',
            'Carga tus transacciones para ver esta sección. Te llevamos al resumen financiero.',
          );
          navigate('/');
        }
      } catch (err) {
        console.error(err);
        mostrarError('No se pudieron cargar las transacciones', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [usuarioId, navigate]);

  const filtradas = filtro === 'Todos'
    ? transacciones
    : transacciones.filter(t => t.tipo === filtro);

  const totalIngresos = filtradas.filter(t => t.tipo === 'Ingreso').reduce((acc, t) => acc + Number(t.monto), 0);
  const totalGastos = filtradas.filter(t => t.tipo === 'Gasto').reduce((acc, t) => acc + Number(t.monto), 0);

  // Paginación en pantalla: mostramos de a POR_PAGINA. Totales/exportar siguen usando `filtradas` (todas).
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginadas = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Al cambiar el filtro, volvemos a la primera página.
  useEffect(() => {
    setPaginaActual(1);
  }, [filtro]);

  return (
    <>
      <PageMeta title="FinanceAI | Transacciones" description="Historial de transacciones financieras" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Transacciones</h1>

          <div className="flex flex-wrap items-center gap-2">
            {['Todos', 'Ingreso', 'Gasto'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltro(tipo)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                  filtro === tipo
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {tipo}
              </button>
            ))}

            <ExportMenu
              filename="transacciones"
              title="Transacciones"
              subtitle={`Filtro: ${filtro}  ·  ${filtradas.length} movimientos`}
              kpis={[
                { label: 'Total Ingresos', value: formatMoney(totalIngresos), color: 'success' },
                { label: 'Total Gastos', value: formatMoney(totalGastos), color: 'error' },
                { label: 'Balance', value: formatMoney(totalIngresos - totalGastos), color: 'brand' },
              ]}
              columns={[
                { header: 'Fecha', type: 'date' },
                { header: 'Descripción' },
                { header: 'Categoría' },
                { header: 'Tipo' },
                { header: 'Monto', type: 'currency' },
              ]}
              rows={filtradas.map((t) => [t.fecha, t.descripcion, t.categoria, t.tipo, Number(t.monto)])}
              rowColorFn={(idx) => (filtradas[idx]?.tipo === 'Ingreso' ? 'success' : 'error')}
              disabled={filtradas.length === 0}
              onExportDashboard={() => exportDashboardXlsx(transacciones, 'dashboard-financiero')}
            />
          </div>
        </div>

        {loading ? (
          <TransaccionesSkeleton />
        ) : (
          <>
            {/* Vista de tarjetas — solo móvil */}
            <div className="space-y-3 sm:hidden">
              {paginadas.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                        {t.descripcion}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.fecha}</p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        t.tipo === 'Ingreso' ? 'text-success-600' : 'text-error-600'
                      }`}
                    >
                      {t.tipo === 'Ingreso' ? '+' : '-'}$
                      {Number(t.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoriaColor(t.categoria)}`}>
                      {t.categoria}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        t.tipo === 'Ingreso'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-error-100 text-error-700'
                      }`}
                    >
                      {t.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista de tabla — desde sm hacia arriba */}
            <div className="hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Fecha</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Descripción</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Categoría</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">Tipo</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginadas.map((t) => (
                      <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{t.fecha}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{t.descripcion}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${getCategoriaColor(t.categoria)}`}>
                            {t.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            t.tipo === 'Ingreso'
                              ? 'bg-success-100 text-success-700'
                              : 'bg-error-100 text-error-700'
                          }`}>
                            {t.tipo}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm font-semibold text-right ${
                          t.tipo === 'Ingreso' ? 'text-success-600' : 'text-error-600'
                        }`}>
                          {t.tipo === 'Ingreso' ? '+' : '-'}${Number(t.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPaginas > 1 && (
              <div className="flex justify-center pt-2">
                <Pagination
                  currentPage={paginaActual}
                  totalPages={totalPaginas}
                  onPageChange={setPaginaActual}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
