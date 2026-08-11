import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createPortal } from "react-dom";
import PageMeta from "../../components/common/PageMeta";
import {
  analizarFinanzas,
  obtenerUsuario,
  obtenerTransacciones,
} from "../../services/api";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import { useAuth } from "../../context/AuthContext";
import { speakText, stopSpeaking, isSpeechSupported } from "../../utils/speech";
import type { AnalisisResponse, RecomendacionFinanciera } from "../../types/finance";
import {
  DollarLineIcon,
  PieChartIcon,
  ChatIcon,
  AngleLeftIcon,
  AlertIcon,
  InfoIcon,
  TaskIcon,
  ListIcon,
  FileIcon,
} from "../../icons";

const MASCOT_EMPTY_SRC = "/images/mascot/finsight-bird-empty.png";

function ArrowUpIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M6.06462 1.62393C6.20193 1.47072 6.40135 1.37432 6.62329 1.37432C6.6236 1.37432 6.62391 1.37432 6.62422 1.37432C6.81631 1.37415 7.00845 1.44731 7.15505 1.5938L10.1551 4.5918C10.4481 4.88459 10.4483 5.35946 10.1555 5.65246C9.86273 5.94546 9.38785 5.94562 9.09486 5.65283L7.37329 3.93247L7.37329 10.125C7.37329 10.5392 7.03751 10.875 6.62329 10.875C6.20908 10.875 5.87329 10.5392 5.87329 10.125L5.87329 3.93578L4.15516 5.65281C3.86218 5.94561 3.3873 5.94546 3.0945 5.65248C2.8017 5.35949 2.80185 4.88462 3.09484 4.59182L6.06462 1.62393Z" />
    </svg>
  );
}

function ArrowDownIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M5.31462 10.3761C5.45194 10.5293 5.65136 10.6257 5.87329 10.6257C5.8736 10.6257 5.8739 10.6257 5.87421 10.6257C6.0663 10.6259 6.25845 10.5527 6.40505 10.4062L9.40514 7.4082C9.69814 7.11541 9.69831 6.64054 9.40552 6.34754C9.11273 6.05454 8.63785 6.05438 8.34486 6.34717L6.62329 8.06753L6.62329 1.875C6.62329 1.46079 6.28751 1.125 5.87329 1.125C5.45908 1.125 5.12329 1.46079 5.12329 1.875L5.12329 8.06422L3.40516 6.34719C3.11218 6.05439 2.6373 6.05454 2.3445 6.34752C2.0517 6.64051 2.05185 7.11538 2.34484 7.40818L5.31462 10.3761Z" />
    </svg>
  );
}

function fmtMoney(n: number) {
  return `$${Number(n).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const evitarPorcentajeLiteral = (texto: string) =>
  texto.replace(/(\d+(?:[.,]\d+)?)\s*%/g, "$1 por ciento");

function badgePrioridad(p: RecomendacionFinanciera["prioridad"]) {
  if (p === "alta") return "border-l-error-500 bg-error-50 dark:bg-error-500/10";
  if (p === "media") return "border-l-warning-500 bg-warning-50 dark:bg-warning-500/10";
  return "border-l-brand-500 bg-brand-50 dark:bg-brand-500/10";
}

function PriorityIcon({ p }: { p: RecomendacionFinanciera["prioridad"] }) {
  if (p === "alta") return <AlertIcon className="size-4 shrink-0 text-error-500 mt-0.5" />;
  if (p === "media") return <AlertIcon className="size-4 shrink-0 text-warning-500 mt-0.5" />;
  return <InfoIcon className="size-4 shrink-0 text-brand-500 mt-0.5" />;
}

function getPerfilClasses(perfil: string) {
  if (perfil === "Saludable") return "text-success-600 bg-success-50 dark:bg-success-500/10";
  if (perfil === "En observación") return "text-warning-600 bg-warning-50 dark:bg-warning-500/10";
  if (perfil === "En riesgo") return "text-error-600 bg-error-50 dark:bg-error-500/10";
  return "text-gray-600 bg-gray-50 dark:bg-gray-500/10";
}

function getAhorroClass(pct: number) {
  if (pct >= 20) return "text-success-600";
  if (pct >= 10) return "text-warning-600";
  return "text-error-600";
}

function getRiesgoClass(nivel: string) {
  if (nivel === "Bajo") return "text-success-600";
  if (nivel === "Medio") return "text-warning-600";
  return "text-error-600";
}

const SIMBOLOS_LLUVIA = ["$", "Y", "E", "B", "S", "o", "0", "1", "%", "X", "M"];

function FullPageMatrixRain() {
  const particulas = Array.from({ length: 26 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none z-0" aria-hidden>
      {particulas.map((i) => (
        <span
          key={i}
          className="absolute font-mono font-bold opacity-20 dark:opacity-25"
          style={{
            top: "-5%",
            left: `${(i * 3.9) % 100}%`,
            color: "#ef4444",
            fontSize: `${10 + (i % 4) * 2}px`,
            animationName: "mxRain",
            animationDuration: `${2.2 + (i % 6) * 0.7}s`,
            animationDelay: `${-(i % 8) * 0.55}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
          }}
        >
          {SIMBOLOS_LLUVIA[i % SIMBOLOS_LLUVIA.length]}
        </span>
      ))}
    </div>
  );
}

function SalidaOverlay({ visible }: { visible: boolean }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gray-950 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <p className="font-outfit text-3xl font-bold text-error-400 tracking-[0.15em] sm:text-5xl">
        SALIENDO...
      </p>
    </div>,
    document.body,
  );
}

// Bloque placeholder visible con shimmer/pulse para tema claro y oscuro
function MxSkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded bg-gray-200 dark:bg-white/10 animate-pulse ${className}`}
    />
  );
}

function ModoMatrixSkeleton() {
  return (
    <div className="space-y-6">
      {/* 4 Stat Cards Skeletons */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
          >
            <div className="space-y-3">
              <MxSkeletonBlock className="h-3.5 w-24" />
              <div className="flex items-center gap-2">
                <MxSkeletonBlock className="size-5 rounded-md" />
                <MxSkeletonBlock className="h-6 w-28" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Perfil + Recomendaciones Skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Perfil Financiero Skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="space-y-4">
            <MxSkeletonBlock className="h-5 w-44" />
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60 space-y-2">
              <MxSkeletonBlock className="h-3 w-20" />
              <MxSkeletonBlock className="h-7 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60 space-y-2">
                <MxSkeletonBlock className="h-3 w-16" />
                <MxSkeletonBlock className="h-5 w-24" />
              </div>
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60 space-y-2">
                <MxSkeletonBlock className="h-3 w-16" />
                <MxSkeletonBlock className="h-5 w-24" />
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/60 space-y-2">
              <MxSkeletonBlock className="h-3 w-28" />
              <MxSkeletonBlock className="h-5 w-16" />
              <MxSkeletonBlock className="h-2 w-full rounded-full" />
            </div>
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800 space-y-3">
              <MxSkeletonBlock className="h-4 w-36" />
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-1.5">
                  <div className="flex justify-between">
                    <MxSkeletonBlock className="h-3 w-20" />
                    <MxSkeletonBlock className="h-3 w-16" />
                  </div>
                  <MxSkeletonBlock className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Recomendaciones Personalizadas Skeleton */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="space-y-4">
            <MxSkeletonBlock className="h-5 w-56" />
            <div className="space-y-3">
              {[0, 1, 2].map((j) => (
                <div
                  key={j}
                  className="rounded-lg border-l-4 border-l-gray-300 bg-gray-50 p-4 dark:border-l-gray-700 dark:bg-gray-800/60 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <MxSkeletonBlock className="size-4 rounded-full" />
                    <MxSkeletonBlock className="h-3.5 w-24" />
                  </div>
                  <MxSkeletonBlock className="h-4 w-3/4" />
                  <MxSkeletonBlock className="h-3 w-full" />
                  <MxSkeletonBlock className="h-3 w-2/3" />
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-500/20 dark:bg-brand-500/10 space-y-3 flex flex-col items-center">
              <MxSkeletonBlock className="h-28 w-28 rounded-xl" />
              <MxSkeletonBlock className="h-4 w-60" />
              <MxSkeletonBlock className="h-9 w-36 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  valor,
  colorClass,
  icon,
}: {
  label: string;
  valor: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <p className="mb-1 text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <div className="flex items-center gap-2">
        {icon}
        <p className={`text-lg font-bold ${colorClass}`}>{valor}</p>
      </div>
    </div>
  );
}

const BAR_COLORS = [
  "bg-brand-500",
  "bg-error-500",
  "bg-warning-500",
  "bg-theme-purple-500",
  "bg-blue-light-500",
];

function CatBar({
  cat,
  monto,
  maximo,
  idx,
}: {
  cat: string;
  monto: number;
  maximo: number;
  idx: number;
}) {
  const pct = maximo > 0 ? (monto / maximo) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-theme-xs">
        <span className="capitalize text-gray-700 dark:text-gray-300">{cat}</span>
        <span className="font-medium text-gray-500 dark:text-gray-400">{fmtMoney(monto)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[idx % BAR_COLORS.length]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ModoMatrix() {
  const { usuarioId, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [analisis, setAnalisis] = useState<AnalisisResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const [leyendoId, setLeyendoId] = useState<string | null>(null);

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    if (authLoading || !usuarioId) return;

    const ctrl = new AbortController();
    let isCancelled = false;

    async function cargar() {
      try {
        setCargando(true);
        setError(null);
        const [perfil, transacciones] = await Promise.all([
          obtenerUsuario(usuarioId, ctrl.signal),
          obtenerTransacciones(usuarioId, ctrl.signal),
        ]);

        if (transacciones.length === 0) {
          if (!isCancelled) setError("Todavía no tienes datos financieros. Importa tus transacciones primero.");
          return;
        }

        const request = construirAnalisisRequest(perfil, transacciones);
        const resultado = await analizarFinanzas(request, usuarioId, ctrl.signal);
        if (!isCancelled) setAnalisis(resultado);
      } catch (e) {
        if (!isCancelled && (e as Error).name !== "AbortError") {
          setError("No se pudo cargar el análisis. Verifica que el backend esté activo.");
        }
      } finally {
        if (!isCancelled) setCargando(false);
      }
    }

    void cargar();
    return () => {
      isCancelled = true;
      ctrl.abort();
    };
  }, [usuarioId, authLoading]);

  function salir() {
    setSaliendo(true);
    setTimeout(() => navigate("/"), 900);
  }

  const leerRecomendacion = async (recomendacion: RecomendacionFinanciera) => {
    if (leyendoId === recomendacion.id) {
      stopSpeaking();
      setLeyendoId(null);
      return;
    }
    setLeyendoId(recomendacion.id);
    const texto = [
      recomendacion.titulo,
      recomendacion.diagnostico,
      `Acción sugerida: ${recomendacion.accion}`,
      recomendacion.objetivo ? `Objetivo: ${recomendacion.objetivo}` : null,
    ].filter(Boolean).join('. ');
    await speakText(texto);
    setLeyendoId((actual) => (actual === recomendacion.id ? null : actual));
  };

  const preguntarleAFinsi = (recomendacion: RecomendacionFinanciera) => {
    const contexto = [
      recomendacion.preguntaFinsi,
      `Perfil financiero: ${recomendacion.perfil}.`,
      `Diagnóstico: ${evitarPorcentajeLiteral(recomendacion.diagnostico)}`,
      `Acción sugerida: ${recomendacion.accion}`,
      recomendacion.objetivo ? `Objetivo: ${evitarPorcentajeLiteral(recomendacion.objetivo)}` : null,
      recomendacion.advertencia,
      "Continúa desde esta recomendación, usa mis datos financieros actuales y no me pidas que repita el contexto.",
    ].filter(Boolean).join("\n\n");

    navigate("/asistente-ia", { state: { autoPrompt: contexto } });
  };

  const topCategorias = analisis
    ? Object.entries(analisis.resumenGastos.porCategoria)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const maxCategoria = topCategorias[0]?.[1] ?? 1;

  const estaCargando = authLoading || cargando;

  return (
    <>
      <PageMeta
        title="Modo Matrix | FinSightAI"
        description="La verdad sobre tus finanzas — accesible solo con la pastilla roja."
      />

      <style>{`
        @keyframes mxRain {
          0%   { transform: translateY(-10vh); opacity: 0; }
          10%  { opacity: 0.4; }
          90%  { opacity: 0.3; }
          100% { transform: translateY(110vh); opacity: 0; }
        }
        @keyframes mxGlitch {
          0%,100% { transform: translate(0); }
          25%  { transform: translate(-2px, 1px); }
          50%  { transform: translate(2px, -1px); }
          75%  { transform: translate(-1px, 2px); }
        }
        .mx-glitch-hover:hover { animation: mxGlitch 0.2s linear infinite; }
      `}</style>

      <SalidaOverlay visible={saliendo} />
      <FullPageMatrixRain />

      <div className="relative z-10 space-y-6">
        {/* Banner de acceso exclusivo */}
        <div className="relative overflow-hidden rounded-2xl bg-gray-900 px-6 py-5 dark:bg-gray-950">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-ping rounded-full bg-error-500" />
                <p className="text-theme-xs font-semibold uppercase tracking-[0.3em] text-error-400">
                  Modo Matrix · Acceso exclusivo
                </p>
              </div>
              <h1 className="text-title-sm font-bold text-white">
                La verdad sobre tus finanzas
              </h1>
              <p className="mt-0.5 text-theme-xs text-gray-400">
                Elegiste la pastilla roja. Aquí está el análisis completo sin filtros.
              </p>
            </div>
            <button
              onClick={salir}
              className="mx-glitch-hover inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-error-800 px-4 py-2 text-theme-xs font-semibold text-error-400 transition hover:bg-error-950/40"
            >
              <AngleLeftIcon className="size-4" />
              Salir de la Matrix
            </button>
          </div>
        </div>

        {estaCargando ? (
          <ModoMatrixSkeleton />
        ) : error ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-theme-sm dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
                <AlertIcon className="size-7 text-error-500" />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
                Sin datos disponibles
              </h2>
              <p className="mb-6 text-theme-sm text-gray-500 dark:text-gray-400">{error}</p>
              <button
                onClick={() => navigate("/importar-csv")}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-theme-sm font-medium text-white transition hover:bg-brand-600"
              >
                Importar datos
              </button>
            </div>
          </div>
        ) : analisis ? (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="Total ingresos"
                valor={fmtMoney(analisis.totalIngresos)}
                colorClass="text-success-600"
                icon={<ArrowUpIcon className="size-4 text-success-600 shrink-0" />}
              />
              <StatCard
                label="Total gastos"
                valor={fmtMoney(analisis.totalGastos)}
                colorClass="text-error-600"
                icon={<ArrowDownIcon className="size-4 text-error-600 shrink-0" />}
              />
              <StatCard
                label="Capacidad de ahorro"
                valor={`${analisis.porcentajeAhorro.toFixed(1)}%`}
                colorClass={getAhorroClass(analisis.porcentajeAhorro)}
                icon={<DollarLineIcon className="size-4 text-brand-500 shrink-0" />}
              />
              <StatCard
                label="Nivel de riesgo"
                valor={analisis.nivelRiesgo}
                colorClass={getRiesgoClass(analisis.nivelRiesgo)}
                icon={<PieChartIcon className="size-4 text-warning-500 shrink-0" />}
              />
            </div>

            {/* Perfil + Recomendaciones */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Perfil */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Tu Perfil Financiero
                </h2>
                <div className="space-y-3">
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                    <p className="mb-1 text-theme-xs text-gray-500">Clasificación</p>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-theme-sm font-semibold ${getPerfilClasses(
                        analisis.perfilFinanciero
                      )}`}
                    >
                      {analisis.perfilFinanciero}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                      <p className="mb-1 text-theme-xs text-gray-500">Ingresos</p>
                      <p className="text-base font-bold text-success-600">
                        {fmtMoney(analisis.totalIngresos)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                      <p className="mb-1 text-theme-xs text-gray-500">Gastos</p>
                      <p className="text-base font-bold text-error-600">
                        {fmtMoney(analisis.totalGastos)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                    <p className="mb-1 text-theme-xs text-gray-500">Ahorro estimado</p>
                    <p className={`text-base font-bold ${getAhorroClass(analisis.porcentajeAhorro)}`}>
                      {analisis.porcentajeAhorro.toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          analisis.porcentajeAhorro >= 20
                            ? "bg-success-500"
                            : analisis.porcentajeAhorro >= 10
                              ? "bg-warning-500"
                              : "bg-error-500"
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, analisis.porcentajeAhorro))}%`,
                        }}
                      />
                    </div>
                  </div>
                  {topCategorias.length > 0 && (
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                      <p className="mb-3 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                        Gasto por categoría
                      </p>
                      <div className="space-y-3">
                        {topCategorias.map(([cat, monto], i) => (
                          <CatBar
                            key={cat}
                            cat={cat}
                            monto={monto}
                            maximo={maxCategoria}
                            idx={i}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recomendaciones */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
                <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
                  Recomendaciones Personalizadas
                </h2>
                {analisis.recomendaciones.length > 0 ? (
                  <div className="space-y-3">
                    {analisis.recomendaciones.slice(0, 4).map((rec) => (
                      <div
                        key={rec.id}
                        className={`rounded-lg border-l-4 p-4 ${badgePrioridad(rec.prioridad)}`}
                      >
                        <div className="flex items-start gap-3">
                          <PriorityIcon p={rec.prioridad} />
                          <div className="min-w-0 flex-1">
                            <p className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
                              {rec.prioridad === "alta"
                                ? "Prioridad Alta"
                                : rec.prioridad === "media"
                                  ? "Prioridad Media"
                                  : "Sugerencia"}
                            </p>
                            <h3 className="mt-0.5 text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                              {rec.titulo}
                            </h3>
                            <p className="mt-1 text-theme-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                              {rec.diagnostico}
                            </p>
                            <p className="mt-2 text-theme-xs text-gray-700 dark:text-gray-300">
                              <strong>Acción:</strong> {rec.accion}
                            </p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={() => preguntarleAFinsi(rec)}
                                className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                              >
                                <ChatIcon className="size-3.5" />
                                Preguntar a Finsi sobre esto
                              </button>
                              {isSpeechSupported() && (
                                <button
                                  type="button"
                                  onClick={() => leerRecomendacion(rec)}
                                  className="inline-flex items-center gap-1.5 text-theme-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                                >
                                  {leyendoId === rec.id ? '⏹️ Detener lectura' : '🔊 Que Finsi lo lea'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <img
                      src={MASCOT_EMPTY_SRC}
                      alt="Finsi"
                      className="h-32 w-auto object-contain mb-3"
                    />
                    <p className="text-theme-sm font-medium text-gray-500">
                      No hay recomendaciones disponibles
                    </p>
                  </div>
                )}

                {/* Card Mascota Finsi */}
                <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-brand-50 p-4 text-center dark:bg-brand-500/10">
                  <img
                    src={MASCOT_EMPTY_SRC}
                    alt="Finsi, el asistente financiero"
                    className="h-32 w-auto object-contain sm:h-36"
                  />
                  <p className="text-theme-sm text-gray-600 dark:text-gray-400">
                    ¿Quieres un plan más detallado y a tu medida?
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/asistente-ia", {
                        state: {
                          autoPrompt: `Mi perfil financiero es "${analisis.perfilFinanciero}" y mi ahorro es del ${analisis.porcentajeAhorro.toFixed(1)}%. Ayúdame con un plan detallado.`,
                        },
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
                  >
                    <ChatIcon className="size-4" />
                    Hablar con Finsi
                  </button>
                </div>
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                onClick={() => navigate("/recomendaciones")}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-theme-sm font-medium text-white transition hover:bg-brand-600"
              >
                <TaskIcon className="size-4" />
                Ver todas las recomendaciones
              </button>
              <button
                onClick={() => navigate("/transacciones")}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
              >
                <ListIcon className="size-4" />
                Ver transacciones
              </button>
              <button
                onClick={() => navigate("/analisis")}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-theme-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.06]"
              >
                <FileIcon className="size-4" />
                Análisis detallado
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}