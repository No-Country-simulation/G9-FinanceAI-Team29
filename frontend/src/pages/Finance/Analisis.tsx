import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import PageMeta from "../../components/common/PageMeta";
import ExportMenu from "../../components/common/ExportMenu";
import { SkeletonBlock } from "../../components/common/Skeleton";
import { formatMoney } from "../../utils/export/format";
import { analizarFinanzas, obtenerUsuario, obtenerTransacciones } from "../../services/api";
import { AnalisisRequest, AnalisisResponse } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { mostrarError, mostrarExito, mostrarInfo } from "../../utils/alerts";

function DatosEntradaSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div>
        <SkeletonBlock className="mb-2 h-4 w-32" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
      <div>
        <SkeletonBlock className="mb-2 h-4 w-40" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
      <div>
        <SkeletonBlock className="mb-2 h-4 w-36" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
      <SkeletonBlock className="h-10 w-full rounded-lg" />
    </div>
  );
}

export default function Analisis() {
  const [formData, setFormData] = useState<AnalisisRequest | null>(null);
  const [resultado, setResultado] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const { usuarioId } = useAuth();
  const { isTourActive } = useOnboarding();
  const navigate = useNavigate();

  // El formulario se llena con el perfil y las transacciones reales de la
  // cuenta activa. Al cambiar de usuario se vuelve a pedir todo.
  useEffect(() => {
    setCargandoDatos(true);
    obtenerDatosReales();
    async function obtenerDatosReales() {
      try {
        const [perfil, transacciones] = await Promise.all([
          obtenerUsuario(usuarioId),
          obtenerTransacciones(usuarioId),
        ]);

        if (transacciones.length === 0) {
          setFormData(null);
          if (!isTourActive) {
            await mostrarInfo(
              'Todavía no tienes datos financieros',
              'Carga tus movimientos para poder analizar tus finanzas. Te llevamos al resumen financiero.',
            );
            navigate('/');
          }
          return;
        }

        setFormData(construirAnalisisRequest(perfil, transacciones));
      } catch (err) {
        console.error(err);
        setFormData(null);
        mostrarError('No se pudieron cargar tus datos', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setCargandoDatos(false);
      }
    }
  }, [usuarioId, isTourActive, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;
    setLoading(true);
    try {
      const result = await analizarFinanzas(formData, usuarioId);
      setResultado(result);
      mostrarExito('Análisis completado', `Perfil financiero: ${result.perfilFinanciero}`);
    } catch (err) {
      console.error(err);
      mostrarError('No se pudo completar el análisis', 'Revisa los datos ingresados e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getPerfilColor = (perfil: string) => {
    switch (perfil) {
      case 'Saludable': return 'text-success-600 bg-success-50 dark:bg-success-500/10';
      case 'En observación': return 'text-warning-600 bg-warning-50 dark:bg-warning-500/10';
      case 'En riesgo': return 'text-error-600 bg-error-50 dark:bg-error-500/10';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
    }
  };

  const getRiskColor = (risk: string) => {
    const normalized = risk.trim().toLowerCase();
    if (normalized === 'bajo') return 'text-success-600';
    if (normalized === 'medio' || normalized === 'moderado') return 'text-warning-600';
    return 'text-error-600';
  };

  const recomendacionesDelAgente = (data: AnalisisResponse) => {
    const items = data.recomendaciones.map(
      (rec) => `${rec.titulo}: ${rec.diagnostico} Acción sugerida: ${rec.accion}`
    );
    const perfil = data.perfilFinanciero.toLowerCase();
    const riesgo = data.nivelRiesgo.toLowerCase();
    const isRisk = perfil.includes('riesgo') || riesgo.includes('alto');
    const isObservation = perfil.includes('observación') || riesgo.includes('moderado') || riesgo.includes('medio');

    if (isRisk) {
      items.unshift('Te recomiendo crear una meta para saldar tu deuda y destinar aportes periódicos hasta completar el objetivo.');
      items.push('Si tu deuda tiene intereses elevados, cuotas vencidas o te cuesta cumplir con los pagos, te recomiendo consultar con un asesor financiero.');
    } else if (isObservation) {
      items.push('Te recomiendo crear una meta financiera concreta para transformar tu margen de ahorro en un progreso medible.');
    }

    return Array.from(new Set(items));
  };

  return (
    <>
      <PageMeta title="FinanceAI | Análisis" description="Análisis financiero personal" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Análisis Financiero</h1>

        <div data-tour="page-analysis" className="scroll-mt-24 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div id="datos-entrada" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Datos de Entrada</h2>
            
            {cargandoDatos ? (
              <DatosEntradaSkeleton />
            ) : !formData ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No se pudieron cargar tus datos. Reintenta más tarde.
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ingreso Mensual ($)
                </label>
                <input
                  type="number"
                  value={formData.ingresoMensual}
                  onChange={(e) => setFormData({ ...formData, ingresoMensual: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nivel Endeudamiento (%)
                </label>
                <input
                  type="number"
                  value={formData.nivelEndeudamiento}
                  onChange={(e) => setFormData({ ...formData, nivelEndeudamiento: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frecuencia de Ahorro
                </label>
                <select
                  value={formData.frecuenciaAhorro}
                  onChange={(e) => setFormData({ ...formData, frecuenciaAhorro: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                  <option value="Nunca">Nunca</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Analizando...' : 'Analizar Finanzas'}
              </button>
            </form>
            )}
          </div>

          <div id="resultado-analisis" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Resultado del Análisis</h2>
              <ExportMenu
                filename="analisis-financiero"
                title="Análisis Financiero"
                subtitle={resultado ? `Perfil: ${resultado.perfilFinanciero}` : undefined}
                kpis={resultado ? [
                  { label: 'Perfil', value: resultado.perfilFinanciero, color: 'brand' },
                  { label: 'Probabilidad', value: `${resultado.probabilidad}%`, color: 'success' },
                  { label: 'Nivel de Riesgo', value: resultado.nivelRiesgo, color: 'error' },
                ] : []}
                columns={[{ header: 'Concepto' }, { header: 'Detalle' }]}
                rows={resultado ? [
                  ['Ingresos', formatMoney(Number(resultado.totalIngresos))],
                  ['Gastos', formatMoney(Number(resultado.totalGastos))],
                  ['Nivel de Riesgo', resultado.nivelRiesgo],
                  ...recomendacionesDelAgente(resultado).map((rec) => ['Recomendación', rec]),
                ] : []}
                disabled={!resultado}
              />
            </div>

            {resultado ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPerfilColor(resultado.perfilFinanciero)}`}>
                    {resultado.perfilFinanciero}
                  </span>
                  <span className="text-sm text-gray-500">
                    Probabilidad: {resultado.probabilidad}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-500">Ingresos</p>
                    <p className="text-lg font-bold text-success-600">
                      ${Number(resultado.totalIngresos).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-500">Gastos</p>
                    <p className="text-lg font-bold text-error-600">
                      ${Number(resultado.totalGastos).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-500">Nivel de Riesgo</p>
                  <p className={`text-lg font-bold ${getRiskColor(resultado.nivelRiesgo)}`}>
                    {resultado.nivelRiesgo}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recomendaciones</h3>
                  <ul className="space-y-2">
                    {recomendacionesDelAgente(resultado).map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-brand-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => navigate('/metas')}
                    className="mt-4 inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
                  >
                    {resultado.perfilFinanciero.toLowerCase().includes('riesgo') ? 'Crear meta para saldar deuda' : 'Crear o ver mis metas'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Completa el formulario y haz clic en "Analizar Finanzas" para ver los resultados
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
