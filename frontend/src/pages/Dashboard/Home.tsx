import { useState, useEffect } from 'react';
import PageMeta from "../../components/common/PageMeta";
import ProfileCard from "../../components/finance/ProfileCard";
import IncomeExpensesChart from "../../components/finance/IncomeExpensesChart";
import CategoryPieChart from "../../components/finance/CategoryPieChart";
import SavingsGauge from "../../components/finance/SavingsGauge";
import DebtBadge from "../../components/finance/DebtBadge";
import RecentTransactions from "../../components/finance/RecentTransactions";
import RecommendationsList from "../../components/finance/RecommendationsList";
import { obtenerUsuario, obtenerTransacciones, obtenerResumen, analizarFinanzas } from "../../services/api";
import { PerfilUsuario, Transaccion, ResumenTransacciones } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { mostrarError } from "../../utils/alerts";

export default function Home() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [resumen, setResumen] = useState<ResumenTransacciones | null>(null);
  const [recomendaciones, setRecomendaciones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const usuarioId = import.meta.env.VITE_USER_ID ?? 'USR0001';

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
          const analisis = await analizarFinanzas(construirAnalisisRequest(perfilData, transData), usuarioId);
          setRecomendaciones(analisis.recomendaciones);
        }
      } catch (err) {
        setError('Error al cargar datos del servidor');
        console.error(err);
        mostrarError('No se pudieron cargar tus datos', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <PageMeta title="FinanceAI | Dashboard" description="Dashboard de análisis financiero" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Cargando datos financieros...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageMeta title="FinanceAI | Dashboard" description="Dashboard de análisis financiero" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center text-error-600">
            <p className="text-lg font-semibold">Error</p>
            <p className="text-gray-500">{error}</p>
          </div>
        </div>
      </>
    );
  }

  // El ingreso real del usuario vive en su perfil: el dataset de transacciones
  // solo contiene gastos, así que nunca hay que derivarlo de `transacciones`.
  const totalIngresos = perfil?.ingresoMensual || 0;
  const totalGastos = resumen?.totalGastos || 0;
  const porCategoria = resumen?.porCategoria || {};

  const porcentajes: Record<string, number> = {};
  Object.keys(porCategoria).forEach(cat => {
    porcentajes[cat] = totalGastos > 0 ? Math.round((porCategoria[cat] / totalGastos) * 100) : 0;
  });

  const porcentajeAhorro = totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) * 100 : 0;

  return (
    <>
      <PageMeta title="FinanceAI | Dashboard" description="Dashboard de análisis financiero personal" />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 xl:col-span-3">
          <ProfileCard perfil={perfil} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-9">
          <IncomeExpensesChart ingresos={totalIngresos} gastos={totalGastos} />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <CategoryPieChart porCategoria={porCategoria} porcentajes={porcentajes} />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <SavingsGauge porcentajeAhorro={porcentajeAhorro} totalIngresos={totalIngresos} totalGastos={totalGastos} />
        </div>

        <div className="col-span-12 md:col-span-6 xl:col-span-4">
          <DebtBadge nivelEndeudamiento={perfil?.nivelEndeudamiento || 0} />
        </div>

        <div className="col-span-12 xl:col-span-6">
          <RecentTransactions transacciones={transacciones} />
        </div>

        <div className="col-span-12 xl:col-span-6">
          <RecommendationsList recomendaciones={recomendaciones} />
        </div>
      </div>
    </>
  );
}
