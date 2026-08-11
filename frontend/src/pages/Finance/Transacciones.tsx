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
import { getSubcategoriaIcon } from "../../utils/subcategoriaIcons";
import ColumnFilter from "../../components/common/ColumnFilter";
import TextColumnFilter from "../../components/common/TextColumnFilter";
import SortToggle from "../../components/common/SortToggle";
import { mostrarError, mostrarInfo } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";

const SIN_SUBCATEGORIA = '(Sin subcategoría)';

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
            <SkeletonBlock className="h-4 w-4" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-14" />
            <SkeletonBlock className="ml-auto h-3 w-16" />
          </div>
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-10 border-b border-gray-100 px-6 py-4 last:border-b-0 dark:border-gray-800/50">
            <SkeletonBlock className="h-4 w-4" />
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
  const [filtroCategorias, setFiltroCategorias] = useState<string[]>([]);
  const [filtroSubcategorias, setFiltroSubcategorias] = useState<string[]>([]);
  const [filtroDescripcion, setFiltroDescripcion] = useState('');
  const [filtroSigno, setFiltroSigno] = useState<string[]>([]);
  const [ordenFecha, setOrdenFecha] = useState<'asc' | 'desc'>('desc');
  const [paginaActual, setPaginaActual] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  // Filtrado en cascada: cada paso acota las opciones disponibles del siguiente filtro (estilo Excel).
  const porTipo = filtro === 'Todos'
    ? transacciones
    : transacciones.filter(t => t.tipo === filtro);

  const categoriasDisponibles = Array.from(new Set(porTipo.map(t => t.categoria))).sort();

  const porCategoria = filtroCategorias.length > 0
    ? porTipo.filter(t => filtroCategorias.includes(t.categoria))
    : porTipo;

  const subcategoriasDisponibles = Array.from(
    new Set(porCategoria.map(t => t.subcategoria || SIN_SUBCATEGORIA))
  ).sort();

  const porSubcategoria = filtroSubcategorias.length > 0
    ? porCategoria.filter(t => filtroSubcategorias.includes(t.subcategoria || SIN_SUBCATEGORIA))
    : porCategoria;

  const porDescripcion = filtroDescripcion.trim().length > 0
    ? porSubcategoria.filter(t => t.descripcion?.toLowerCase().includes(filtroDescripcion.trim().toLowerCase()))
    : porSubcategoria;

  const porSigno = filtroSigno.length > 0
    ? porDescripcion.filter(t => filtroSigno.includes(t.tipo === 'Ingreso' ? 'Positivos' : 'Negativos'))
    : porDescripcion;

  const filtradas = [...porSigno].sort((a, b) => {
    const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    return ordenFecha === 'desc' ? -diff : diff;
  });

  // Tipo y Monto están correlacionados 1 a 1 (Ingreso = Positivo, Gasto = Negativo):
  // se deshabilita la opción del otro filtro que garantizaría 0 resultados.
  const tipoDeshabilitado = filtroSigno.length === 1
    ? [filtroSigno[0] === 'Negativos' ? 'Ingreso' : 'Gasto']
    : [];
  const signoDeshabilitado = filtro === 'Todos' ? [] : [filtro === 'Ingreso' ? 'Negativos' : 'Positivos'];

  const transaccionesParaExportar = selectedIds.size > 0 
    ? filtradas.filter(t => selectedIds.has(t.id)) 
    : filtradas;

  const totalIngresos = transaccionesParaExportar.filter(t => t.tipo === 'Ingreso').reduce((acc, t) => acc + Number(t.monto), 0);
  const totalGastos = transaccionesParaExportar.filter(t => t.tipo === 'Gasto').reduce((acc, t) => acc + Number(t.monto), 0);

  // Paginación en pantalla: mostramos de a POR_PAGINA. Totales/exportar siguen usando `filtradas` (todas).
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginadas = filtradas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Al cambiar cualquier filtro, volvemos a la primera página.
  useEffect(() => {
    setPaginaActual(1);
    setSelectedIds(new Set());
  }, [filtro, filtroCategorias, filtroSubcategorias, filtroDescripcion, filtroSigno, ordenFecha]);

  // Si el filtro de categoría deja afuera subcategorías ya seleccionadas, las descartamos.
  useEffect(() => {
    setFiltroSubcategorias((prev) => prev.filter((s) => subcategoriasDisponibles.includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCategorias, filtro]);

  // Tipo y Monto (signo) son mutuamente excluyentes en combinaciones contradictorias:
  // si cambia uno, descartamos del otro la opción que quedaría deshabilitada.
  useEffect(() => {
    setFiltroSigno((prev) => prev.filter((s) => !signoDeshabilitado.includes(s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  useEffect(() => {
    if (tipoDeshabilitado.includes(filtro)) setFiltro('Todos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroSigno]);

  return (
    <>
      <PageMeta title="Transacciones | FinSightAI" description="Historial de transacciones financieras" />
      <div className="space-y-6" data-tour="page-transactions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Transacciones</h1>

          <div className="flex flex-wrap items-center gap-2">
            {['Todos', 'Ingreso', 'Gasto'].map((tipo) => {
              const isDisabled = tipoDeshabilitado.includes(tipo);
              return (
                <button
                  key={tipo}
                  disabled={isDisabled}
                  title={isDisabled ? 'No combina con el filtro de Monto activo' : undefined}
                  onClick={() => setFiltro(tipo)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                    isDisabled
                      ? 'cursor-not-allowed bg-gray-50 text-gray-300 dark:bg-gray-800/50 dark:text-gray-600'
                      : filtro === tipo
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {tipo}
                </button>
              );
            })}

            {(filtroCategorias.length > 0 || filtroSubcategorias.length > 0 || filtroDescripcion.trim().length > 0 || filtroSigno.length > 0) && (
              <button
                onClick={() => {
                  setFiltroCategorias([]);
                  setFiltroSubcategorias([]);
                  setFiltroDescripcion('');
                  setFiltroSigno([]);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-500 hover:underline"
              >
                Limpiar filtros
              </button>
            )}

            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-500 hover:underline"
              >
                Desmarcar ({selectedIds.size})
              </button>
            )}

            <ExportMenu
              filename="transacciones"
              title="Transacciones"
              subtitle={`Filtro: ${filtro}  ·  ${transaccionesParaExportar.length} movimientos${selectedIds.size > 0 ? ' (Personalizado)' : ''}`}
              kpis={[
                { label: 'Total Ingresos', value: formatMoney(totalIngresos), color: 'success' },
                { label: 'Total Gastos', value: formatMoney(totalGastos), color: 'error' },
                { label: 'Balance', value: formatMoney(totalIngresos - totalGastos), color: 'brand' },
              ]}
              columns={[
                { header: 'Fecha', type: 'date' },
                { header: 'Descripción' },
                { header: 'Categoría' },
                { header: 'Subcategoría' },
                { header: 'Tipo' },
                { header: 'Monto', type: 'currency' },
              ]}
              rows={transaccionesParaExportar.map((t) => [t.fecha, t.descripcion, t.categoria, t.subcategoria ?? '', t.tipo, Number(t.monto)])}
              rowColorFn={(idx) => (transaccionesParaExportar[idx]?.tipo === 'Ingreso' ? 'success' : 'error')}
              disabled={transaccionesParaExportar.length === 0}
              onExportDashboard={() => exportDashboardXlsx(transaccionesParaExportar, 'dashboard-financiero')}
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
                  onClick={() => {
                    const newSet = new Set(selectedIds);
                    if (newSet.has(t.id)) newSet.delete(t.id);
                    else newSet.add(t.id);
                    setSelectedIds(newSet);
                  }}
                  className={`rounded-2xl border p-4 cursor-pointer transition-colors ${
                    selectedIds.has(t.id)
                      ? 'border-brand-500 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-500/10'
                      : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          readOnly
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                          {t.descripcion}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t.fecha}</p>
                      </div>
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
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${getCategoriaColor(t.categoria)}`}>
                        {t.categoria}
                      </span>
                      {t.subcategoria && (
                        <span className="inline-flex w-fit items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <span aria-hidden="true">{getSubcategoriaIcon(t.subcategoria, t.categoria)}</span>
                          {t.subcategoria}
                        </span>
                      )}
                    </div>
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
                      <th className="px-6 py-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filtradas.length > 0 && selectedIds.size === filtradas.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(filtradas.map(t => t.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-800"
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          Fecha
                          <SortToggle
                            order={ordenFecha}
                            onToggle={() => setOrdenFecha((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          Descripción
                          <TextColumnFilter
                            value={filtroDescripcion}
                            onChange={setFiltroDescripcion}
                            placeholder="Buscar descripción..."
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          Categoría
                          <ColumnFilter
                            options={categoriasDisponibles}
                            selected={filtroCategorias}
                            onChange={setFiltroCategorias}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          Subcategoría
                          <ColumnFilter
                            options={subcategoriasDisponibles}
                            selected={filtroSubcategorias}
                            onChange={setFiltroSubcategorias}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          Tipo
                          <ColumnFilter
                            options={['Ingreso', 'Gasto']}
                            selected={filtro === 'Todos' ? [] : [filtro]}
                            onChange={(vals) => setFiltro(vals.length === 1 ? vals[0] : 'Todos')}
                            disabledOptions={tipoDeshabilitado}
                          />
                        </div>
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">
                        <div className="flex items-center justify-end gap-1">
                          Monto
                          <ColumnFilter
                            options={['Positivos', 'Negativos']}
                            selected={filtroSigno}
                            onChange={setFiltroSigno}
                            disabledOptions={signoDeshabilitado}
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginadas.map((t) => (
                      <tr 
                        key={t.id} 
                        onClick={() => {
                          const newSet = new Set(selectedIds);
                          if (newSet.has(t.id)) newSet.delete(t.id);
                          else newSet.add(t.id);
                          setSelectedIds(newSet);
                        }}
                        className={`border-b border-gray-100 cursor-pointer transition-colors dark:border-gray-800/50 ${
                          selectedIds.has(t.id) 
                            ? 'bg-brand-50/50 dark:bg-brand-500/10' 
                            : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            readOnly
                            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600 dark:border-gray-600 dark:bg-gray-800"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{t.fecha}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white/90">{t.descripcion}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${getCategoriaColor(t.categoria)}`}>
                            {t.categoria}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {t.subcategoria ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                              <span aria-hidden="true">{getSubcategoriaIcon(t.subcategoria, t.categoria)}</span>
                              {t.subcategoria}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-700">—</span>
                          )}
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