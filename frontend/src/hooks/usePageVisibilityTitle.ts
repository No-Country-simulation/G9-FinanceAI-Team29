import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { getAgentTabStatus, setAgentTabStatus, subscribeAgentTabStatus } from "../utils/tabTitle";

export function usePageVisibilityTitle(
  awayTitle = "Te extrañamos, vuelve pronto!"
) {
  const location = useLocation();
  const originalTitle = useRef(document.title);

  // Este componente se monta después de <Routes> en App.tsx, por lo que su
  // efecto corre después del de PageMeta de la página recién montada, que ya
  // dejó document.title correcto. Resincronizamos aquí para que
  // originalTitle.current nunca quede con el nombre del módulo anterior si la
  // pestaña se oculta justo durante la navegación.
  useEffect(() => {
    if (!document.hidden) {
      originalTitle.current = document.title;
    }
    // Un cambio de ruta cierra cualquier estado de "agente escribiendo..."
    // que pertenecía al módulo anterior (ej. Soporte o AsistenteIA).
    setAgentTabStatus(null);
  }, [location.pathname]);

  useEffect(() => {
    const applyHiddenTitle = () => {
      document.title = getAgentTabStatus() ?? awayTitle;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        originalTitle.current = document.title;
        applyHiddenTitle();
      } else {
        document.title = originalTitle.current;
        setAgentTabStatus(null);
      }
    };

    const unsubscribeAgentStatus = subscribeAgentTabStatus(() => {
      if (document.hidden) applyHiddenTitle();
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeAgentStatus();
    };
  }, [awayTitle]);
}
