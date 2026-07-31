import { useCallback, useEffect, useState, ComponentType } from 'react';
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
  PieChartIcon,
  BoltIcon,
  TaskIcon,
  ListIcon,
  FileIcon,
} from "../../icons";
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

  const { usuarioId, loading: authLoading } = useAuth();

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("usuarioId:", usuarioId);

      const perfilData = await obtenerUsuario(usuarioId);
      console.log("✓ Perfil", perfilData);

      const transData = await obtenerTransacciones(usuarioId);
      console.log("✓ Transacciones", transData);

      setPerfil(perfilData);
      setTransacciones(transData);
      setAnalisis(null);
      setRecomendaciones([]);

      // Un usuario recién registrado todavía no tiene movimientos.
      // No pedimos el resumen porque algunos backends responden 404 en ese caso.
      if (transData.length === 0) {
        setResumen(null);
        return;
      }

      const resumenData = await obtenerResumen(usuarioId);
      console.log("✓ Resumen", resumenData);
      setResumen(resumenData);

      const analisisData = await analizarFinanzas(
        construirAnalisisRequest(perfilData, transData),
        usuarioId
      );

      setAnalisis(analisisData);
      setRecomendaciones(analisisData.recomendaciones ?? []);
    } catch (err) {
      console.error("ERROR COMPLETO:", err);

      let mensaje = "Error desconocido";

      if (err instanceof Error) {
        mensaje = err.message;

        if (
          mensaje.includes("NetworkError") ||
          mensaje.includes("Failed to fetch") ||
          mensaje.includes("Load failed")
        ) {
          mensaje =
            "No se pudo conectar con el servidor. Verificá que el backend esté iniciado.";
        }
      }

      setError(mensaje);

      await mostrarError(
        "No se pudieron cargar tus datos",
        mensaje,
      );
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
  if (authLoading) return;
  if (!usuarioId) return;

  void cargarDatos();
}, [authLoading, usuarioId, cargarDatos]);

if (authLoading) {
  return (
    <div className="flex h-screen items-center justify-center">
      Cargando sesión...
    </div>
  );
}



  if (loading) {
    return (
      <>
        <PageMeta
          title="FinSightAI | Dashboard"
          description="Dashboard de análisis financiero"
        />

        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />

            <p className="text-gray-500 dark:text-gray-400">
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
          title="FinSightAI | Dashboard"
          description="Dashboard de análisis financiero"
        />

        <div className="flex min-h-[420px] items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-error-50 text-2xl dark:bg-error-500/10">
              !
            </div>

            <h1 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
              No pudimos cargar el dashboard
            </h1>

            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void cargarDatos()}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
            >
              Reintentar
            </button>
          </div>
        </div>
      </>
    );
  }

  const esUsuarioNuevo = transacciones.length === 0;

  if (esUsuarioNuevo) {
    return (
      <>
        <PageMeta
          title="FinSightAI | Bienvenida"
          description="Comenzá tu análisis financiero con FinSightAI"
        />

        <div className="mx-auto flex min-h-[620px] max-w-5xl items-center justify-center px-4 py-8">
          <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-purple-600 px-6 py-12 text-white sm:px-12">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
                Ver más allá de tus finanzas
              </p>

              <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
                Bienvenido a FinSightAI
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/90 sm:text-lg">
                Ya creamos tu cuenta. Ahora subí tus movimientos para armar tu
                dashboard y entender de un vistazo en qué se te va la plata.
              </p>
            </div>

            <div className="grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_0.9fr] lg:px-12">
              <div>
                <h2 className="mb-5 text-xl font-semibold text-gray-800 dark:text-white/90">
                  Qué vas a encontrar acá
                </h2>

                <div className="space-y-4">
                  {(
                    [
                      [PieChartIcon, 'Dashboard financiero', 'Ingresos, gastos y cómo evolucionan mes a mes.'],
                      [BoltIcon, 'Análisis con IA', 'Patrones en tus gastos y recomendaciones a tu medida.'],
                      [TaskIcon, 'Perfil financiero', 'Tu nivel de ahorro y endeudamiento, en un vistazo.'],
                      [ListIcon, 'Categorías automáticas', 'Cada movimiento clasificado para saber dónde se va la plata.'],
                    ] as [ComponentType<{ className?: string }>, string, string][]
                  ).map(([Icono, titulo, descripcion]) => (
                    <div
                      key={titulo}
                      className="flex gap-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-800"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                        <Icono className="h-5 w-5 text-brand-500" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-800 dark:text-white/90">
                          {titulo}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                          {descripcion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-center rounded-2xl bg-gray-50 p-6 dark:bg-white/[0.03] sm:p-8">
                <div className="mb-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-500/15">
                    <FileIcon className="h-7 w-7 text-brand-500" />
                  </div>

                  <h2 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
                    Subí tu primer archivo
                  </h2>

                  <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Elegí el CSV con tus movimientos y nosotros nos encargamos
                    de procesarlo y armar tu análisis.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/importar-csv";
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  <FileIcon className="h-4 w-4" />
                  Cargar CSV
                </button>

                <p className="mt-4 text-center text-xs leading-5 text-gray-400">
                  Tus datos se usan solo para generar tu análisis financiero.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const totalIngresos =
    analisis?.totalIngresos ??
    perfil?.ingresoMensual ??
    resumen?.totalIngresos ??
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
        title="FinSightAI | Dashboard"
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
    </>
  );
}