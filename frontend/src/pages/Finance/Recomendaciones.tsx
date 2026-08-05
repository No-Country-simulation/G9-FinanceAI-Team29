import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import PageMeta from "../../components/common/PageMeta";
import { SkeletonBlock } from "../../components/common/Skeleton";
import { analizarFinanzas, obtenerUsuario, obtenerTransacciones } from "../../services/api";
import { AnalisisResponse, RecomendacionFinanciera } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { mostrarError, mostrarInfo } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";
import { useOnboarding } from "../../context/OnboardingContext";

const MASCOTA_SRC = "/images/mascot/finsight-bird.png";

function RecomendacionesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <SkeletonBlock className="mb-4 h-5 w-44" />
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
            <SkeletonBlock className="mb-2 h-3 w-24" />
            <SkeletonBlock className="h-6 w-32" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <SkeletonBlock className="mb-2 h-3 w-16" />
              <SkeletonBlock className="h-5 w-20" />
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <SkeletonBlock className="mb-2 h-3 w-16" />
              <SkeletonBlock className="h-5 w-20" />
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
            <SkeletonBlock className="mb-2 h-3 w-32" />
            <SkeletonBlock className="h-5 w-16" />
          </div>
        </div>
      </div>

      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <SkeletonBlock className="mb-4 h-5 w-56" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border-l-4 border-l-gray-200 bg-gray-50 p-4 dark:border-l-gray-700 dark:bg-gray-800/50">
              <SkeletonBlock className="mb-2 h-3 w-24" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="mt-2 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Recomendaciones() {
  const [resultado, setResultado] = useState<AnalisisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const { usuarioId, loading: authLoading } = useAuth();
  const { isTourActive } = useOnboarding();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !usuarioId) return;

    let cancelado = false;
    setLoading(true);

    const fetchData = async () => {
      try {
        const [perfil, transacciones] = await Promise.all([
          obtenerUsuario(usuarioId),
          obtenerTransacciones(usuarioId),
        ]);
        if (cancelado) return;

        // Cuenta nueva sin movimientos: no tiene sentido pedirle al backend
        // un análisis, le avisamos que será redirigido a cargar sus datos.
        if (transacciones.length === 0) {
          setLoading(false);
          if (!isTourActive) {
            await mostrarInfo(
              'No has cargado datos a tu perfil',
              'Serás redirigido al inicio para que puedas ingresar tus datos.',
            );
            if (!cancelado) navigate('/');
          }
          return;
        }

        const request = construirAnalisisRequest(perfil, transacciones);
        const result = await analizarFinanzas(request, usuarioId);
        if (cancelado) return;
        setResultado(result);
      } catch (err) {
        if (cancelado) return;
        console.error(err);
        mostrarError('No se pudieron cargar las recomendaciones', 'Verifica que el backend esté disponible e intenta de nuevo.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelado = true;
    };
  }, [usuarioId, authLoading, navigate, isTourActive]);

  const getPrioridadColor = (prioridad: RecomendacionFinanciera['prioridad']) => {
    if (prioridad === 'alta') return 'border-l-error-500 bg-error-50 dark:bg-error-500/10';
    if (prioridad === 'media') return 'border-l-warning-500 bg-warning-50 dark:bg-warning-500/10';
    return 'border-l-info-500 bg-info-50 dark:bg-info-500/10';
  };

  const getIcono = (prioridad: RecomendacionFinanciera['prioridad']) =>
    prioridad === 'alta' ? '🔴' : prioridad === 'media' ? '🟡' : '🔵';

  // Mismos umbrales que SavingsGauge en el Dashboard, para que el color signifique lo mismo en toda la app.
  const getAhorroColor = (pct: number) => {
    if (pct >= 20) return 'text-success-600';
    if (pct >= 10) return 'text-warning-600';
    return 'text-error-600';
  };

  const describirNivelAhorro = (pct: number) => {
    if (pct >= 20) return 'alta';
    if (pct >= 10) return 'media';
    return 'baja';
  };

  // El detector de intención del asistente interpreta "numero%" como una
  // operación matemática a resolver (no como dato financiero) y rechaza la
  // consulta, así que se reescribe a "numero por ciento" antes de enviarla.
  const evitarPorcentajeLiteral = (texto: string) =>
    texto.replace(/(\d+(?:[.,]\d+)?)\s*%/g, '$1 por ciento');

  const preguntarleAFinsi = (recomendacion: RecomendacionFinanciera) => {
    const contexto = [
      recomendacion.preguntaFinsi,
      `Perfil financiero: ${recomendacion.perfil}.`,
      `Diagnóstico: ${evitarPorcentajeLiteral(recomendacion.diagnostico)}`,
      `Acción sugerida: ${recomendacion.accion}`,
      recomendacion.objetivo ? `Objetivo: ${evitarPorcentajeLiteral(recomendacion.objetivo)}` : null,
      recomendacion.advertencia,
      'Continúa desde esta recomendación, usa mis datos financieros actuales y no me pidas que repita el contexto.',
    ].filter(Boolean).join('\n\n');

    navigate('/asistente-ia', { state: { autoPrompt: contexto } });
  };

  // Se evita escribir el porcentaje como "96.2%": el detector de intención del
  // asistente interpreta "numero%" como una operación matemática a resolver
  // y rechaza la consulta en lugar de responderla.
  const mensajePlanDetallado = () =>
    resultado
      ? `Según mi análisis financiero, mi perfil es "${resultado.perfilFinanciero}" y mi capacidad de ahorro es ${describirNivelAhorro(resultado.porcentajeAhorro)}. Ayúdame a armar un plan detallado y paso a paso para mejorar mis finanzas.`
      : 'Ayúdame a armar un plan financiero detallado.';

  return (
    <>
      <PageMeta title="FinanceAI | Recomendaciones" description="Recomendaciones financieras personalizadas" />
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">Recomendaciones</h1>

        {loading ? (
          <RecomendacionesSkeleton />
        ) : resultado ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div id="perfil-financiero-recomendaciones" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
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
                  <p className="text-sm text-gray-500 mb-1">Capacidad de Ahorro</p>
                  <p className={`text-lg font-bold ${getAhorroColor(resultado.porcentajeAhorro)}`}>{resultado.porcentajeAhorro.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div id="recomendaciones-personalizadas" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">Recomendaciones Personalizadas</h2>
              
              {resultado.recomendaciones.length > 0 ? (
                <div className="space-y-3">
                  {resultado.recomendaciones.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-4 rounded-lg border-l-4 ${getPrioridadColor(rec.prioridad)}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg">{getIcono(rec.prioridad)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 dark:text-white/90 mb-1">
                            {rec.prioridad === 'alta' ? 'Prioridad Alta' : rec.prioridad === 'media' ? 'Prioridad Media' : 'Sugerencia'}
                          </p>
                          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{rec.titulo}</h3>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{rec.diagnostico}</p>
                          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300"><strong>Acción sugerida:</strong> {rec.accion}</p>
                          {rec.objetivo && <p className="mt-2 text-sm text-gray-700 dark:text-gray-300"><strong>Objetivo:</strong> {rec.objetivo}</p>}
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{rec.advertencia}</p>
                          <button
                            type="button"
                            onClick={() => preguntarleAFinsi(rec)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                          >
                            💬 Preguntar a Finsi sobre esto
                          </button>
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

              {resultado.recomendaciones.length > 0 && (
                <div className="mt-5 flex flex-col items-center gap-2 rounded-lg bg-brand-50 p-4 text-center dark:bg-brand-500/10">
                  <img
                    src={MASCOTA_SRC}
                    alt="Finsi, el asistente financiero"
                    className="h-36 w-auto object-contain sm:h-44"
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ¿Quieres un plan más detallado y a tu medida?
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/asistente-ia', { state: { autoPrompt: mensajePlanDetallado() } })}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
                  >
                    💬 Habla con tu asistente financiero
                  </button>
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
