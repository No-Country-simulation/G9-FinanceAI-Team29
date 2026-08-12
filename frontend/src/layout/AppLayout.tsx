import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { OnboardingProvider } from "../context/OnboardingContext";
import { Outlet, useLocation, Link } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import FloatingChatWidget from "../components/common/FloatingChatWidget";
import OnboardingTour from "../components/onboarding/OnboardingTour";
import { useScrollToHash } from "../hooks/useScrollToHash";
import TeamCredit from "../components/team/TeamCredit";
import SupportSuccessModal from "../components/common/SupportSuccessModal";
import AchievementToastHost from "../components/gamificacion/AchievementToastHost";
import { useEsModoMatrix } from "../hooks/useEsModoMatrix";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { pathname } = useLocation();
  const ocultarChatFlotante = pathname === "/asistente-ia";
  // Modo Matrix: en tema claro, el fondo general de la página (incluido el
  // pie de página) también se tiñe de tonos oscuros con acento rojo, igual
  // que el resto de las tarjetas de esa página. En el resto de la app y en
  // tema oscuro queda igual que antes.
  const enModoMatrix = useEsModoMatrix();

  useScrollToHash();

  return (
    <div className={`min-h-screen xl:flex ${enModoMatrix ? "bg-gray-950 dark:bg-transparent" : ""}`}>
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </div>
        <div
          className={`flex flex-col items-center gap-2 px-4 pb-6 text-sm text-center dark:text-gray-400 ${
            enModoMatrix ? "!text-error-400/70" : "text-gray-500"
          }`}
        >
          <div>
            &copy; {new Date().getFullYear()} - <TeamCredit />
          </div>
          <div className="flex items-center gap-3">
            <Link to="/terminos" className={`dark:hover:text-gray-300 ${enModoMatrix ? "hover:!text-error-300" : "hover:text-gray-700"}`}>
              Términos y Condiciones
            </Link>
            <span aria-hidden="true">&middot;</span>
            <Link to="/privacidad" className={`dark:hover:text-gray-300 ${enModoMatrix ? "hover:!text-error-300" : "hover:text-gray-700"}`}>
              Política de Privacidad
            </Link>
          </div>
          <p className={`max-w-2xl text-xs dark:text-gray-500 ${enModoMatrix ? "!text-error-500/50" : "text-gray-400"}`}>
            FinSightAI es un proyecto desarrollado por TwentyNineDevs durante
            el Hackathon ONE Next Education (Oracle, Alura y No Country). Las
            recomendaciones generadas por inteligencia artificial tienen
            fines informativos y educativos y no constituyen asesoramiento
            financiero profesional.
          </p>
        </div>
      </div>
      {!ocultarChatFlotante && <FloatingChatWidget />}
      <SupportSuccessModal />
      <OnboardingTour />
      <AchievementToastHost />
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <OnboardingProvider>
        <LayoutContent />
      </OnboardingProvider>
    </SidebarProvider>
  );
};

export default AppLayout;
