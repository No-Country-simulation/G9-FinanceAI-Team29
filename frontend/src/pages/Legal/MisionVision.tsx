import { Link, useLocation } from "react-router";

/* ============================================================
   ICONOS
   ============================================================ */

function ArrowLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function MissionIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

function VisionIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function RoadmapIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h-1" />
    </svg>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

export default function MisionVision() {
  const location = useLocation();

  /*
    Si llegamos desde signin/signup, volvemos a esa pantalla.
    Si alguien entra directamente a /mision-vision,
    usamos /signin como fallback.
  */
  const backTo =
    (location.state as { from?: string } | null)?.from ?? "/signin";

  return (
    <main className="relative min-h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white">

      {/* ======================================================
          FONDO DECORATIVO
          ====================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-500/10 blur-3xl" />

        <div className="absolute -right-40 top-1/3 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-3xl" />

        <div className="absolute bottom-[-200px] left-1/3 h-[450px] w-[450px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      {/* ======================================================
          CONTENIDO
          ====================================================== */}

      <div className="relative z-10 mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:px-10">

        {/* ====================================================
            VOLVER
            ==================================================== */}

        <div className="mb-10">
          <Link
            to={backTo}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-400"
          >
            <ArrowLeftIcon />
            Volver
          </Link>
        </div>

        {/* ====================================================
            HERO
            ==================================================== */}

        <header className="mx-auto mb-14 max-w-3xl text-center sm:mb-20">

          <div className="mb-5 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
            Nuestro propósito
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
            Más que entender tus números.

            <span className="mt-2 block text-brand-500">
              Entender qué hacer con ellos.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-400 sm:text-lg">
            FinSightAI nace con una idea simple: que comprender tus finanzas
            no debería requerir ser especialista en finanzas.
          </p>

        </header>

        {/* ====================================================
            MISIÓN
            Texto izquierda / Super Finsi derecha
            ==================================================== */}

        <section className="mb-6 grid overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.025] lg:grid-cols-[1fr_0.75fr]">

          {/* Texto */}

          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">

            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <MissionIcon />
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              Misión
            </p>

            <h2 className="max-w-xl text-2xl font-bold leading-tight text-gray-900 dark:text-white sm:text-3xl">
              Democratizar la salud financiera en Latinoamérica.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400">
              Que cualquier persona entienda y mejore su relación con el
              dinero, con un asistente de IA claro, sin jerga y sin barrera
              de entrada.
            </p>

          </div>

          {/* Super Finsi */}

          <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden border-t border-gray-100 bg-gradient-to-br from-brand-50 to-blue-50 p-4 dark:border-gray-800 dark:from-brand-500/[0.07] dark:to-blue-500/[0.04] sm:min-h-[320px] lg:border-l lg:border-t-0">

            {/* Glow decorativo detrás de Finsi */}

            <div
              aria-hidden="true"
              className="absolute h-56 w-56 rounded-full bg-brand-400/10 blur-3xl dark:bg-brand-400/10"
            />

            <img
              src="/images/mascot/finsi-super.png"
              alt="Super Finsi representando la misión de FinSightAI"
              className="relative z-10 h-auto max-h-[330px] w-[90%] max-w-[400px] object-contain drop-shadow-xl transition-transform duration-500 hover:scale-[1.03]"
            />

          </div>

        </section>

        {/* ====================================================
            VISIÓN
            Finsi copiloto izquierda / Texto derecha
            ==================================================== */}

        <section className="mb-6 grid overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.025] lg:grid-cols-[0.75fr_1fr]">

          {/* Finsi copiloto */}

          <div className="relative order-2 flex min-h-[280px] items-center justify-center overflow-hidden border-t border-gray-100 bg-gradient-to-br from-violet-50 to-brand-50 p-4 dark:border-gray-800 dark:from-violet-500/[0.05] dark:to-brand-500/[0.07] sm:min-h-[320px] lg:order-1 lg:border-r lg:border-t-0">

            {/* Glow decorativo detrás de Finsi */}

            <div
              aria-hidden="true"
              className="absolute h-56 w-56 rounded-full bg-violet-400/10 blur-3xl dark:bg-brand-400/10"
            />

            <img
              src="/images/mascot/finsi-vision.png"
              alt="Finsi como copiloto financiero"
              className="relative z-10 h-auto max-h-[330px] w-[95%] max-w-[440px] object-contain drop-shadow-xl transition-transform duration-500 hover:scale-[1.03]"
            />

          </div>

          {/* Texto */}

          <div className="order-1 flex flex-col justify-center p-7 sm:p-10 lg:order-2 lg:p-12">

            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <VisionIcon />
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              Visión
            </p>

            <h2 className="max-w-xl text-2xl font-bold leading-tight text-gray-900 dark:text-white sm:text-3xl">
              Ser el copiloto financiero de referencia en LATAM.
            </h2>

            <p className="mt-5 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400">
              La capa de inteligencia que ayuda a personas, freelancers y
              pymes —y a las instituciones que los atienden— a tomar mejores
              decisiones con su dinero.
            </p>

          </div>

        </section>

        {/* ====================================================
            OBJETIVO / ROADMAP
            ==================================================== */}

        <section className="mt-12 rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-gray-800 dark:bg-white/[0.025] sm:p-10 lg:p-12">

          <div className="mx-auto mb-10 max-w-2xl text-center">

            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/10">
              <RoadmapIcon />
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
              Objetivo
            </p>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Los próximos 6–12 meses
            </h2>

            <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-400">
              Convertir la propuesta de FinSightAI en impacto medible y
              validar su potencial en escenarios reales.
            </p>

          </div>

          {/* Roadmap */}

          <div className="relative mx-auto grid max-w-4xl gap-5 md:grid-cols-3">

            {/* Línea de conexión en desktop */}

            <div
              aria-hidden="true"
              className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-brand-300 via-brand-500 to-brand-300 dark:from-brand-500/20 dark:via-brand-500/60 dark:to-brand-500/20 md:block"
            />

            {/* PASO 1 */}

            <div className="relative text-center">

              <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-brand-500 text-sm font-bold text-white shadow-md dark:border-gray-950">
                1
              </div>

              <h3 className="mt-5 font-semibold text-gray-900 dark:text-white">
                Validar
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Comprobar con usuarios reales que el diagnóstico y las
                recomendaciones generan cambios en su comportamiento
                financiero.
              </p>

            </div>

            {/* PASO 2 */}

            <div className="relative text-center">

              <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-brand-500 text-sm font-bold text-white shadow-md dark:border-gray-950">
                2
              </div>

              <h3 className="mt-5 font-semibold text-gray-900 dark:text-white">
                Crecer
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Alcanzar una base de usuarios activos recurrentes que
                encuentren valor continuo en FinSightAI.
              </p>

            </div>

            {/* PASO 3 */}

            <div className="relative text-center">

              <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-brand-500 text-sm font-bold text-white shadow-md dark:border-gray-950">
                3
              </div>

              <h3 className="mt-5 font-semibold text-gray-900 dark:text-white">
                Escalar
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Concretar nuestra primera alianza con una fintech o banco para
                acercar FinSightAI a sus usuarios.
              </p>

            </div>

          </div>

        </section>

        {/* ====================================================
            CIERRE
            ==================================================== */}

        <footer className="pb-4 pt-14 text-center">

          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            FinSightAI
          </p>

          <p className="mt-1 text-xs text-gray-400 dark:text-gray-600">
            Ver más allá de tus finanzas.
          </p>

        </footer>

      </div>
    </main>
  );
}