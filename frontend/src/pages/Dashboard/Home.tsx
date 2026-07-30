import { useState, useEffect } from 'react';
import PageMeta from "../../components/common/PageMeta";
import ProfileCard from "../../components/finance/ProfileCard";
import IncomeExpensesChart from "../../components/finance/IncomeExpensesChart";
import MonthlyExpensesChart from "../../components/finance/MonthlyExpensesChart";
import MonthlyStatsCard from "../../components/finance/MonthlyStatsCard";
import CategoryPieChart from "../../components/finance/CategoryPieChart";
import SavingsGauge from "../../components/finance/SavingsGauge";
import DebtBadge from "../../components/finance/DebtBadge";
import RecentTransactions from "../../components/finance/RecentTransactions";
import RecommendationsList from "../../components/finance/RecommendationsList";
import {
  obtenerUsuario,
  obtenerTransacciones,
  obtenerResumen,
  analizarFinanzas,
} from "../../services/api";
import {
  PerfilUsuario,
  Transaccion,
  ResumenTransacciones,
  AnalisisResponse,
} from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { mostrarError } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";

export default function Home() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [resumen, setResumen] = useState<ResumenTransacciones | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisResponse | null>(null);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  const { usuarioId } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [perfilData, transData, resumenData] = await Promise.all([
          obtenerUsuario(usuarioId),
          obtenerTransacciones(usuarioId),
          obtenerResumen(usuarioId),
        ]);

        setPerfil(perfilData);
        setTransacciones(transData);
        setResumen(resumenData);

        if (transData.length > 0) {
          const analisisData = await analizarFinanzas(
            construirAnalisisRequest(perfilData, transData),
            usuarioId
          );

          setAnalisis(analisisData);
          setRecomendaciones(analisisData.recomendaciones);
        }
      } catch (err) {
        setError('Error al cargar datos del servidor');
        console.error(err);

        mostrarError(
          'No se pudieron cargar tus datos',
          'Verifica que el backend esté disponible e intenta de nuevo.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [usuarioId]);

  if (loading) {
    return (
      <>
        <PageMeta
          title="FinanceAI | Dashboard"
          description="Dashboard de análisis financiero"
        />

        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>

            <p className="text-gray-500">
              Cargando datos financieros...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageMeta
          title="FinanceAI | Dashboard"
          description="Dashboard de análisis financiero"
        />

        <div className="flex items-center justify-center h-64">
          <div className="text-center text-error-600">
            <p className="text-lg font-semibold">
              Error
            </p>

            <p className="text-gray-500">
              {error}
            </p>
          </div>
        </div>
      </>
    );
  }

  const totalIngresos =
    analisis?.totalIngresos ??
    perfil?.ingresoMensual ??
    0;

  const totalGastosHistoricos =
    resumen?.totalGastos ??
    0;

  const gastoMensualPromedio =
    analisis?.totalGastos ??
    totalGastosHistoricos / 12;

  const porCategoria =
    resumen?.porCategoria ??
    {};

  const porcentajes: Record<string, number> = {};

  Object.keys(porCategoria).forEach((categoria) => {
    porcentajes[categoria] =
      totalGastosHistoricos > 0
        ? Math.round(
            (porCategoria[categoria] / totalGastosHistoricos) * 100
          )
        : 0;
  });

  const porcentajeAhorro =
    analisis?.porcentajeAhorro ??
    (
      totalIngresos > 0
        ? (
            (totalIngresos - gastoMensualPromedio) /
            totalIngresos
          ) * 100
        : 0
    );

  return (
    <>
      <PageMeta
        title="FinanceAI | Dashboard"
        description="Dashboard de análisis financiero personal"
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-3">
          <ProfileCard
            perfil={perfil}
            analisis={analisis}
            loading={loading}
          />
        </div>

        <div className="col-span-12 xl:col-span-9">
          <IncomeExpensesChart
            ingresos={totalIngresos}
            gastos={gastoMensualPromedio}
          />
        </div>

        <div className="col-span-12 xl:col-span-9">
          <MonthlyExpensesChart
            transacciones={transacciones}
          />
        </div>

        <div className="col-span-12 xl:col-span-3">
          <MonthlyStatsCard
            transacciones={transacciones}
          />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <CategoryPieChart
            porCategoria={porCategoria}
            porcentajes={porcentajes}
          />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SavingsGauge
            porcentajeAhorro={porcentajeAhorro}
            totalIngresos={totalIngresos}
            totalGastos={gastoMensualPromedio}
          />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <DebtBadge
            nivelEndeudamiento={perfil?.nivelEndeudamiento || 0}
          />
        </div>

        <div className="col-span-12 flex justify-end">
          <button
            type="button"
            onClick={() => setMostrarDetalles((visible) => !visible)}
            aria-expanded={mostrarDetalles}
            aria-controls="detalles-financieros"
            className="inline-flex items-center justify-center rounded-lg border border-brand-500 px-4 py-2.5 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50 focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            {mostrarDetalles
              ? 'Ocultar últimas transacciones y recomendaciones'
              : 'Mostrar últimas transacciones y recomendaciones'}
          </button>
        </div>

        {mostrarDetalles && (
          <div
            id="detalles-financieros"
            className="col-span-12 grid grid-cols-12 gap-4 md:gap-6"
          >
            <div className="col-span-12 xl:col-span-6">
              <RecentTransactions
                transacciones={transacciones}
              />
            </div>

            <div className="col-span-12 xl:col-span-6">
              <RecommendationsList
                recomendaciones={recomendaciones}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
