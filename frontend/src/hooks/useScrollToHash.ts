import { useEffect } from "react";
import { useLocation } from "react-router";

// Los resultados del buscador pueden apuntar a una sección dentro de una
// página (ej. "/#gastos-mensuales"). El elemento puede tardar en montarse
// (datos cargando, secciones colapsadas), así que reintentamos un rato.
export function useScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const id = decodeURIComponent(location.hash.slice(1));
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 30) {
        timeoutId = setTimeout(tryScroll, 150);
      }
    };

    tryScroll();

    return () => clearTimeout(timeoutId);
  }, [location.pathname, location.hash, location.key]);
}
