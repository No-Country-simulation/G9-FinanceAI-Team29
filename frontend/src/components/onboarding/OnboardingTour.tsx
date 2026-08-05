import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useOnboarding } from "../../context/OnboardingContext";
import { isSpeechSupported, speakText, stopSpeaking } from "../../utils/speech";
import {
  playDismiss,
  playMenuHighlight,
  playReveal,
  playStepClick,
  playTourComplete,
  playTourStart,
  playWelcomeChime,
} from "../../utils/sound";

const TOUR_VERSION = 1;
const MASCOTA_SRC = "/images/mascot/finsight-bird-v2.png";

const menuTargetByRoute: Record<string, string> = {
  "/": "nav-dashboard-menu",
  "/importar-csv": "nav-import",
  "/analisis": "nav-analysis",
  "/metas": "nav-goals",
  "/asistente-ia": "nav-assistant",
};

function HelpIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.8 9a2.35 2.35 0 1 1 3.35 2.13c-.76.38-1.15.86-1.15 1.62v.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

function MascotaTour({
  compact = false,
  mirrored = false,
}: {
  compact?: boolean;
  mirrored?: boolean;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-end justify-center overflow-hidden rounded-full bg-gradient-to-b from-brand-50 to-success-50 ring-1 ring-brand-100 dark:from-brand-500/15 dark:to-success-500/10 dark:ring-brand-500/20 ${
        compact ? "size-16 sm:size-[4.5rem]" : "size-24 sm:size-28"
      }`}
      aria-hidden="true"
    >
      <img
        src={MASCOTA_SRC}
        alt=""
        className={`relative h-[95%] w-auto object-contain drop-shadow-xl ${mirrored ? "-scale-x-100" : ""}`}
      />
    </div>
  );
}

function VolumeIcon({ muted = false, className = "size-4" }: { muted?: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 10v4h3l4 3V7L8 10H5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {muted ? (
        <path d="m16 10 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      ) : (
        <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      )}
    </svg>
  );
}

type TourStep = {
  id: string;
  route: string;
  target: string;
  title: string;
  description: string;
  spokenText: string;
};

const steps: TourStep[] = [
  {
    id: "dashboard",
    route: "/",
    target: "dashboard-summary",
    title: "Tu resumen financiero",
    description:
      "El Dashboard reúne tus ingresos, gastos, capacidad de ahorro y perfil financiero. Es el mejor lugar para revisar rápidamente cómo van tus finanzas.",
    spokenText:
      "Este es tu resumen financiero. Aquí puedes revisar ingresos, gastos, ahorro y tu perfil de un vistazo.",
  },
  {
    id: "import",
    route: "/importar-csv",
    target: "page-import",
    title: "Primero, carga tus movimientos",
    description:
      "En Importar CSV puedes descargar una plantilla, completarla con tus movimientos y procesarla. Esos datos alimentan el Dashboard, el análisis y el asistente.",
    spokenText:
      "Para comenzar, importa tus movimientos. Puedes descargar una plantilla de ejemplo y luego cargar tu archivo CSV.",
  },
  {
    id: "analysis",
    route: "/analisis",
    target: "page-analysis",
    title: "Entiende tu situación",
    description:
      "Análisis calcula tu perfil y nivel de riesgo. Recomendaciones convierte esos resultados en consejos concretos y fáciles de aplicar.",
    spokenText:
      "En Análisis puedes entender tu perfil, tu nivel de riesgo y recibir recomendaciones concretas.",
  },
  {
    id: "goals",
    route: "/metas",
    target: "page-goals",
    title: "Convierte consejos en metas",
    description:
      "Crea objetivos con monto y fecha, registra nuevos ahorros y observa cuánto te falta. Así puedes transformar una recomendación en progreso medible.",
    spokenText:
      "En Metas puedes definir un objetivo, registrar ahorros y seguir tu progreso hasta completarlo.",
  },
  {
    id: "assistant",
    route: "/asistente-ia",
    target: "assistant-composer",
    title: "Pregunta al Asistente IA",
    description:
      "Pídele que resuma tus gastos, explique tu perfil o te ayude con un presupuesto. También admite dictado y puede leer sus respuestas en voz alta.",
    spokenText:
      "El Asistente IA puede resumir tus gastos, explicar tu perfil y ayudarte a preparar un presupuesto. También admite voz.",
  },
];

function storageKey(authId: string) {
  return `finsight:onboarding:${authId}`;
}

function hasCompletedTour(authId: string) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(authId)) ?? "null") as {
      version?: number;
      completed?: boolean;
    } | null;
    return value?.version === TOUR_VERSION && value.completed === true;
  } catch {
    return false;
  }
}

function saveCompletedTour(authId: string) {
  localStorage.setItem(
    storageKey(authId),
    JSON.stringify({ version: TOUR_VERSION, completed: true, completedAt: Date.now() }),
  );
}

export default function OnboardingTour() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    isMobileOpen,
    toggleMobileSidebar,
    closeMobileSidebar,
  } = useSidebar();
  const { setIsTourActive } = useOnboarding();
  const authId = session?.user.id ?? "guest";
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [narration, setNarration] = useState(
    () => localStorage.getItem("finsight:onboarding:narration") === "true",
  );
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const currentStep = steps[stepIndex];
  const speechAvailable = isSpeechSupported();

  useEffect(() => {
    if (!session?.user.id || hasCompletedTour(session.user.id)) return;
    const timer = window.setTimeout(() => {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setWelcomeOpen(true);
      playWelcomeChime();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [session?.user.id]);

  useEffect(() => {
    localStorage.setItem("finsight:onboarding:narration", String(narration));
    if (!narration) stopSpeaking();
  }, [narration]);

  useEffect(() => {
    setIsTourActive(active || welcomeOpen);
  }, [active, welcomeOpen, setIsTourActive]);

  const finish = useCallback(
    (completed = false) => {
      stopSpeaking();
      if (completed) playTourComplete();
      else playDismiss();
      setActive(false);
      setWelcomeOpen(false);
      saveCompletedTour(authId);
      closeMobileSidebar();
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
      navigate("/");
    },
    [authId, closeMobileSidebar, navigate],
  );

  const start = () => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    playTourStart();
    setWelcomeOpen(false);
    setStepIndex(0);
    closeMobileSidebar();
    if (pathname !== "/") navigate("/");
    setActive(true);
  };

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (transitioning || nextIndex < 0 || nextIndex >= steps.length) return;

      const nextStep = steps[nextIndex];
      const menuTarget = menuTargetByRoute[nextStep.route];
      const mobile = window.innerWidth < 1024;
      const menuOpeningTime = mobile && !isMobileOpen ? 700 : 80;
      const pressDuration = mobile ? 900 : 520;
      const navigationDelay = mobile ? pressDuration + 300 : 380;
      const revealDelay = mobile ? navigationDelay + 700 : 720;

      stopSpeaking();
      setTransitionLabel(`Abriendo ${nextStep.title}`);
      setTransitioning(true);
      setTargetRect(null);

      if (mobile && !isMobileOpen) toggleMobileSidebar();

      window.setTimeout(() => {
        const menuItem = document.querySelector<HTMLElement>(`[data-tour="${menuTarget}"]`);

        menuItem?.scrollIntoView({ block: "nearest", inline: "nearest" });
        const keyframes: Keyframe[] = mobile
          ? [
              { offset: 0, transform: "scale(1)", backgroundColor: "rgba(70,95,255,0)", boxShadow: "0 0 0 0 rgba(70,95,255,0)" },
              { offset: 0.25, transform: "scale(0.95)", backgroundColor: "rgba(70,95,255,0.3)", boxShadow: "0 0 0 5px rgba(70,95,255,0.3)" },
              { offset: 0.72, transform: "scale(0.95)", backgroundColor: "rgba(70,95,255,0.3)", boxShadow: "0 0 0 5px rgba(70,95,255,0.3)" },
              { offset: 1, transform: "scale(1)", backgroundColor: "rgba(70,95,255,0)", boxShadow: "0 0 0 0 rgba(70,95,255,0)" },
            ]
          : [
              { transform: "scale(1)", filter: "brightness(1)", boxShadow: "0 0 0 0 rgba(70,95,255,0)" },
              { transform: "scale(0.96)", filter: "brightness(1.25)", boxShadow: "0 0 0 4px rgba(70,95,255,0.28)" },
              { transform: "scale(1)", filter: "brightness(1)", boxShadow: "0 0 0 0 rgba(70,95,255,0)" },
            ];

        menuItem?.animate(
          keyframes,
          { duration: pressDuration, easing: "ease-in-out" },
        );
        playMenuHighlight();

        window.setTimeout(() => {
          navigate(nextStep.route);
          setStepIndex(nextIndex);
          if (mobile) closeMobileSidebar();
        }, navigationDelay);

        window.setTimeout(() => {
          setTransitioning(false);
          setTransitionLabel("");
        }, revealDelay);
      }, menuOpeningTime);
    },
    [
      closeMobileSidebar,
      isMobileOpen,
      navigate,
      toggleMobileSidebar,
      transitioning,
    ],
  );

  const skipWelcome = () => finish();

  useEffect(() => {
    if (!active) return;
    if (pathname !== currentStep.route) navigate(currentStep.route);
  }, [active, currentStep.route, navigate, pathname]);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const updateTarget = (announce: boolean) => {
      const element = document.querySelector<HTMLElement>(`[data-tour="${currentStep.target}"]`);
      if (element) {
        element.scrollIntoView({
          block: currentStep.id === "assistant" ? "end" : "start",
          inline: "nearest",
        });
        setTargetRect(element.getBoundingClientRect());
        if (announce) playReveal();
      } else {
        setTargetRect(null);
      }
    };
    const delayed = window.setTimeout(() => updateTarget(true), 320);
    const handleViewportChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => updateTarget(false));
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.clearTimeout(delayed);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [active, currentStep.id, currentStep.target, pathname]);

  useEffect(() => {
    if ((!active && !welcomeOpen) || !headingRef.current) return;
    headingRef.current.focus();
    if (active && narration && !transitioning) void speakText(currentStep.spokenText);
    if (welcomeOpen && narration) void speakText("Hola, soy Finsi. Te acompañaré paso a paso.");
  }, [active, currentStep, narration, transitioning, welcomeOpen]);

  useEffect(() => {
    if (!active && !welcomeOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }
      if (active && event.key === "ArrowRight") {
        event.preventDefault();
        if (stepIndex < steps.length - 1) {
          playStepClick("forward");
          goToStep(stepIndex + 1);
        } else finish(true);
      }
      if (active && event.key === "ArrowLeft" && stepIndex > 0) {
        event.preventDefault();
        playStepClick("back");
        goToStep(stepIndex - 1);
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [active, finish, goToStep, stepIndex, welcomeOpen]);

  useEffect(() => () => stopSpeaking(), []);

  const spotlightStyle = useMemo(() => {
    if (!targetRect) return undefined;
    const gap = 6;
    return {
      left: Math.max(8, targetRect.left - gap),
      top: Math.max(8, targetRect.top - gap),
      width: Math.min(window.innerWidth - 16, targetRect.width + gap * 2),
      height: Math.min(window.innerHeight - 16, targetRect.height + gap * 2),
    };
  }, [targetRect]);

  return (
    <>
      {!(active && currentStep.id === "assistant") && pathname !== "/asistente-ia" && (
        <button
          type="button"
          onClick={() => {
            previousFocusRef.current = document.activeElement as HTMLElement | null;
            setWelcomeOpen(true);
            playWelcomeChime();
          }}
          className="fixed bottom-7 right-[5.25rem] z-[99990] flex size-10 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-600 shadow-theme-md transition hover:-translate-y-0.5 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 motion-reduce:transition-none dark:border-gray-700 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-gray-800 sm:right-24"
          aria-label="Abrir ayuda y recorrido guiado"
          title="Ayuda y recorrido"
        >
          <HelpIcon />
        </button>
      )}

      {transitioning && (
        <div className="fixed inset-0 z-[100000] cursor-wait" aria-live="polite">
          <span className="sr-only" role="status">
            {transitionLabel}
          </span>
        </div>
      )}

      {(welcomeOpen || active) && !transitioning && (
        <div className="fixed inset-0 z-[100000]" aria-live="polite">
          {(!active || !spotlightStyle) && (
            <div className="absolute inset-0 bg-gray-950/65" aria-hidden="true" />
          )}

          {active && spotlightStyle && (
            <div
              className="pointer-events-none fixed rounded-xl border-2 border-brand-300 transition-[left,top,width,height] duration-200 motion-reduce:transition-none"
              style={{
                ...spotlightStyle,
                boxShadow: "0 0 0 9999px rgba(3, 7, 18, 0.68), 0 0 0 4px rgba(70, 95, 255, 0.28)",
              }}
              aria-hidden="true"
            />
          )}

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-description"
            className={`fixed max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:p-6 ${
              active
                ? currentStep.id === "assistant"
                  ? "left-3 right-3 top-3 sm:left-auto sm:right-6 sm:top-6 sm:w-[25rem]"
                  : "bottom-3 left-3 right-3 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[25rem]"
                : "left-1/2 top-1/2 w-[calc(100%-1.5rem)] max-w-[25rem] -translate-x-1/2 -translate-y-1/2"
            }`}
          >
            {welcomeOpen ? (
              <>
                <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 py-1 pl-1.5 pr-3 text-xs font-medium text-white shadow-sm">
                  <span className="relative flex size-2 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/60 motion-reduce:hidden" />
                    <span className="relative size-2 rounded-full bg-white" />
                  </span>
                  Tu guía personal
                </span>
                <div className="mb-5 flex items-center gap-4 rounded-2xl border border-brand-100 bg-brand-25 p-3 dark:border-brand-500/20 dark:bg-brand-500/10 sm:p-4">
                  <MascotaTour />
                  <div className="relative min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white px-3 py-2 text-left text-sm font-medium leading-5 text-gray-700 shadow-theme-sm dark:border-brand-500/25 dark:bg-gray-800 dark:text-gray-200">
                    Hola, soy Finsi. Te acompañaré paso a paso.
                    <span className="absolute -left-1.5 top-1/2 size-3 -translate-y-1/2 rotate-45 border-b border-l border-brand-100 bg-white dark:border-brand-500/25 dark:bg-gray-800" />
                  </div>
                </div>
                <h2 id="onboarding-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none dark:text-white">
                  Bienvenido a FinSightAI
                </h2>
                <p id="onboarding-description" className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Te mostraremos cómo cargar tus movimientos, entender tu situación y convertir recomendaciones en metas. El recorrido tiene 5 pasos y dura menos de un minuto.
                </p>
                {speechAvailable && (
                  <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 dark:bg-white/[0.04] dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={narration}
                      onChange={(event) => setNarration(event.target.checked)}
                      className="size-4 accent-brand-500"
                    />
                    Leer las explicaciones en voz alta
                  </label>
                )}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={skipWelcome} className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]">
                    Explorar por mi cuenta
                  </button>
                  <button type="button" onClick={start} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
                    Iniciar recorrido
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                    Paso {stepIndex + 1} de {steps.length}
                  </span>
                  <button type="button" onClick={() => finish()} className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]" aria-label="Cerrar recorrido">
                    Cerrar
                  </button>
                </div>
                <div className="mt-3 flex gap-1" aria-hidden="true">
                  {steps.map((step, index) => (
                    <span key={step.id} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                  ))}
                </div>
                <div className={`mt-4 flex items-center gap-3 ${stepIndex % 2 === 1 ? "sm:flex-row-reverse" : ""}`}>
                  <MascotaTour compact mirrored={stepIndex % 2 === 1} />
                  <div className="min-w-0 flex-1">
                    <h2 id="onboarding-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 outline-none dark:text-white">
                      {currentStep.title}
                    </h2>
                    <p id="onboarding-description" className="mt-1.5 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {currentStep.description}
                    </p>
                  </div>
                </div>
                {speechAvailable && (
                  <button
                    type="button"
                    onClick={() => setNarration((value) => !value)}
                    aria-pressed={narration}
                    className="mt-3 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <VolumeIcon muted={!narration} />
                      {narration ? "Narración activada" : "Activar narración"}
                    </span>
                  </button>
                )}
                {stepIndex === steps.length - 1 ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        playStepClick("back");
                        goToStep(stepIndex - 1);
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      Anterior
                    </button>
                    <button type="button" onClick={() => finish(true)} className="rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-600">
                      Finalizar
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={stepIndex === 0}
                      onClick={() => {
                        playStepClick("back");
                        goToStep(stepIndex - 1);
                      }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:invisible dark:border-gray-700 dark:text-gray-200"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playStepClick("forward");
                        goToStep(stepIndex + 1);
                      }}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
