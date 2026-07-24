import { useState, useEffect } from 'react';
import PageMeta from "../../components/common/PageMeta";
import { obtenerTransacciones } from "../../services/api";
import { Transaccion } from "../../types/finance";
import { getCategoriaColor } from "../../utils/categoriaColors";
import { mostrarError } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";

export default function Transacciones() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('Todos');

  const { usuarioId } = useAuth();

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      try {
        const data = await obtenerTransacciones(usuarioId);
        setTransacciones(data);
      } catch (err) {
        console.error(err);
        mostrarError('No se pudieron cargar las transacciones', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [usuarioId]);

  const filtradas = filtro === 'Todos'
    ? transacciones
    : transacciones.filter(t => t.tipo === filtro);

  return (
    <>
      <PageMeta title="FinanceAI | Transacciones" description="Historial de transacciones financieras" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Transacciones</h1>
          
          <div className="flex gap-2">
            {['Todos', 'Ingreso', 'Gasto'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltro(tipo)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtro === tipo
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
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
                  {filtradas.map((t) => (
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
                        {t.tipo === 'Ingreso' ? '+' : '-'}${t.monto.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
