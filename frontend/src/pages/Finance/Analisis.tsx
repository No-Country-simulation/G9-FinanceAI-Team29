import { useState, useEffect } from 'react';
import PageMeta from "../../components/common/PageMeta";
import { analizarFinanzas, obtenerUsuario, obtenerTransacciones } from "../../services/api";
import { AnalisisRequest, AnalisisResponse } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { useAuth } from "../../context/AuthContext";
import { mostrarError, mostrarExito } from "../../utils/alerts";

export default function Analisis() {
  const [formData, setFormData] = useState<AnalisisRequest | null>(null);
  const [resultado, setResultado] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const { usuarioId } = useAuth();

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
        setFormData(construirAnalisisRequest(perfil, transacciones));
      } catch (err) {
        console.error(err);
        setFormData(null);
        mostrarError('No se pudieron cargar tus datos', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setCargandoDatos(false);
      }
    }
  }, [usuarioId]);

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

  return (
    <>
      <PageMeta title="FinanceAI | Análisis" description="Análisis financiero personal" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Análisis Financiero</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Datos de Entrada</h2>
            
            {cargandoDatos ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Cargando tus datos...
              </div>
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

          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Resultado del Análisis</h2>
            
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
                  <p className="text-sm text-gray-500">Nivel de Riesgo</p>
                  <p className={`text-lg font-bold ${
                    resultado.nivelRiesgo === 'Bajo' ? 'text-success-600' :
                    resultado.nivelRiesgo === 'Medio' ? 'text-warning-600' : 'text-error-600'
                  }`}>
                    {resultado.nivelRiesgo}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recomendaciones</h3>
                  <ul className="space-y-2">
                    {resultado.recomendaciones.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-brand-500 mt-1">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
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
