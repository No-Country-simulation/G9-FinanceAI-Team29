import React, { useMemo } from "react";
import { Link, useLocation } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";
import GraphSpiralBackground from "../../components/auth/GraphSpiralBackground";
import TeamCredit from "../../components/team/TeamCredit";

const IMAGENES_FONDO = [
  "/login/carousel_1.png",
  "/login/carousel_2.png",
  "/login/carousel_3.png",
];

export default function AuthLayout({
  children,
  showSideBranding = true,
}: {
  children: React.ReactNode;
  showSideBranding?: boolean;
}) {
  const location = useLocation();
  const imagenFondo = useMemo(
    () => IMAGENES_FONDO[Math.floor(Math.random() * IMAGENES_FONDO.length)],
    []
  );

  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full min-h-screen lg:h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        <div className="relative flex flex-col justify-center flex-1 pb-24 lg:pb-0">
          <GraphSpiralBackground />
          <div className="relative z-10 flex flex-col flex-1">{children}</div>
        </div>
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-brand-950 dark:bg-white/5 lg:grid">
          <div className="relative flex items-center justify-center z-1 w-full h-full overflow-hidden">
            <img
              key={imagenFondo}
              src={imagenFondo}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 object-cover w-full h-full opacity-90 animate-auth-pan"
            />
            <div className="absolute inset-0 bg-brand-950/30 dark:bg-gray-900/40" />
            {showSideBranding && (
              <div className="relative flex flex-col items-center max-w-xs px-8 py-6 rounded-2xl bg-black/30 backdrop-blur-sm ring-1 ring-white/10 shadow-xl">
                <Link to="/" className="block mb-4 px-5 py-3 rounded-xl bg-white/95 shadow-lg">
                  <img
                    width={231}
                    height={60}
                    src="/images/logo/logo.png"
                    alt="FinSightAI"
                    className="object-contain"
                  />
                </Link>
                <p className="text-center text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                  Tu asistente financiero inteligente
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="fixed z-50 bottom-28 right-4 lg:bottom-8 sm:right-6">
          <ThemeTogglerTwo />
        </div>
        <div className="fixed z-40 inset-x-0 bottom-2 flex flex-col items-center gap-1 bg-white/95 px-4 py-3 text-sm text-center text-gray-500 backdrop-blur-sm dark:bg-gray-900/95 dark:text-gray-400 lg:hidden">
          <p>
            &copy; {new Date().getFullYear()} - <TeamCredit />
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link
              to="/terminos"
              state={{ from: location.pathname }}
              className="whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300"
            >
              Términos y Condiciones
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link
              to="/privacidad"
              state={{ from: location.pathname }}
              className="whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-300"
            >
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
