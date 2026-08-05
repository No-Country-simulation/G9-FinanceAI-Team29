import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useLocation, useNavigate } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import AccountSwitcher from "../components/header/AccountSwitcher";
import { navItems, othersItems } from "./AppSidebar";
import { confirmarCierreSesion } from "../utils/alerts";

type SearchEntry = { name: string; path: string; group: string };

// Quita tildes/diacríticos para que "analisis" encuentre "Análisis".
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Construye un regex "difuso": permite cualquier texto entre cada letra
// buscada, así "imprtr csv" sigue encontrando "Importar CSV".
const buildFuzzyRegex = (query: string) => {
  const pattern = normalize(query).split("").map(escapeRegExp).join(".*");
  return new RegExp(pattern);
};

// Secciones/gráficos dentro de cada página. No están en el menú lateral,
// así que se listan a mano con su ancla (#id) para que el buscador también
// las encuentre y haga scroll hasta ellas.
const SECTION_ENTRIES: SearchEntry[] = [
  { name: "Perfil Financiero", path: "/#perfil-financiero", group: "Resumen Financiero" },
  { name: "Ingresos vs Gastos", path: "/#ingresos-vs-gastos", group: "Resumen Financiero" },
  { name: "Gastos Mensuales", path: "/#gastos-mensuales", group: "Resumen Financiero" },
  { name: "Estadísticas del Período", path: "/#estadisticas-del-periodo", group: "Resumen Financiero" },
  { name: "Gastos por Categoría", path: "/#gastos-por-categoria", group: "Resumen Financiero" },
  { name: "Capacidad de Ahorro", path: "/#capacidad-de-ahorro", group: "Resumen Financiero" },
  { name: "Nivel de Endeudamiento", path: "/#nivel-endeudamiento", group: "Resumen Financiero" },
  { name: "Últimas Transacciones", path: "/#ultimas-transacciones-dashboard", group: "Resumen Financiero" },
  { name: "Recomendaciones rápidas", path: "/#recomendaciones-dashboard", group: "Resumen Financiero" },
  { name: "Datos de Entrada", path: "/analisis#datos-entrada", group: "Análisis" },
  { name: "Resultado del Análisis", path: "/analisis#resultado-analisis", group: "Análisis" },
  { name: "Tu Perfil Financiero", path: "/recomendaciones#perfil-financiero-recomendaciones", group: "Recomendaciones" },
  { name: "Recomendaciones Personalizadas", path: "/recomendaciones#recomendaciones-personalizadas", group: "Recomendaciones" },
  { name: "Nueva Meta", path: "/metas#formulario-meta", group: "Metas" },
];

const buildSearchIndex = (): SearchEntry[] => {
  const entries: SearchEntry[] = [];

  const collect = (items: typeof navItems, group: string) => {
    items.forEach((item) => {
      if (item.subItems?.length) {
        item.subItems.forEach((sub) => {
          entries.push({ name: sub.name, path: sub.path, group: item.name });
        });
      } else if (item.path) {
        entries.push({ name: item.name, path: item.path, group });
      }
    });
  };

  collect(navItems, "Menú");
  collect(othersItems, "Otros");
  entries.push(...SECTION_ENTRIES);

  return entries;
};

const SEARCH_INDEX = buildSearchIndex();

const searchNav = (query: string): SearchEntry[] => {
  const q = normalize(query);
  if (!q) return [];

  const fuzzy = buildFuzzyRegex(query);

  return SEARCH_INDEX.map((entry) => {
    const name = normalize(entry.name);
    let score = -1;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 90;
    else if (name.includes(q)) score = 70;
    else if (fuzzy.test(name)) score = 40;
    return { entry, score };
  })
    .filter(({ score }) => score > -1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ entry }) => entry);
};

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchToggleRef = useRef<HTMLButtonElement>(null);

  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const handleLogout = async () => {
    if (!(await confirmarCierreSesion())) return;
    await signOut();
    navigate("/signin", { replace: true, state: { loggedOut: true } });
  };

  useEffect(() => {
    setApplicationMenuOpen(false);
    setIsMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileInputRef.current?.focus();
    } else {
      setQuery("");
      setIsSearchOpen(false);
    }
  }, [isMobileSearchOpen]);

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen((prevOpen) => {
      const nextOpen = !prevOpen;
      if (nextOpen) {
        setApplicationMenuOpen(false);
        if (isMobileOpen) toggleMobileSidebar();
      }
      return nextOpen;
    });
  };

  useEffect(() => {
    if (isMobileOpen) {
      setApplicationMenuOpen(false);
    }
  }, [isMobileOpen]);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen((prevOpen) => {
      const nextOpen = !prevOpen;
      if (nextOpen && isMobileOpen) {
        toggleMobileSidebar();
      }
      return nextOpen;
    });
  };

  const results = useMemo(() => searchNav(query), [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideDesktop = !!searchContainerRef.current?.contains(target);
      const insideMobile = !!mobileSearchContainerRef.current?.contains(target);
      const onMobileToggle = !!mobileSearchToggleRef.current?.contains(target);

      if (!insideDesktop && !insideMobile) {
        setIsSearchOpen(false);
      }
      if (!insideMobile && !onMobileToggle) {
        setIsMobileSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const goToResult = (entry: SearchEntry) => {
    navigate(entry.path);
    setQuery("");
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    inputRef.current?.blur();
    mobileInputRef.current?.blur();
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = results[activeIndex] ?? results[0];
    if (target) goToResult(target);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    }
  };

  const renderResultsDropdown = (listId: string) => (
    <ul
      id={listId}
      role="listbox"
      className="absolute left-0 top-[calc(100%+6px)] z-99999 w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
    >
      {results.length ? (
        results.map((entry, index) => (
          <li key={`${entry.group}-${entry.path}`} role="option" aria-selected={index === activeIndex}>
            <button
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => goToResult(entry)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                index === activeIndex
                  ? "bg-brand-50 text-brand-600 dark:bg-white/[0.05] dark:text-brand-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              <span>{entry.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{entry.group}</span>
            </button>
          </li>
        ))
      ) : (
        <li className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">
          Sin resultados para "{query}"
        </li>
      )}
    </ul>
  );

  const searchIconPath =
    "M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z";

  return (
    <header className="sticky top-0 flex w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg z-99999 dark:border-gray-800 lg:flex dark:text-gray-400 lg:h-11 lg:w-11 lg:border"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                  fill="currentColor"
                />
              </svg>
            )}
            {/* Cross Icon */}
          </button>

          <Link to="/" className="lg:hidden">
            <img
              src="/images/logo/logo.png"
              alt="FinSightAI"
              className="h-8 w-auto object-contain dark:hidden"
            />
            <img
              src="/images/logo/logo_white.png"
              alt="FinSightAI"
              className="hidden h-8 w-auto object-contain dark:block"
            />
          </Link>

          <div className="flex items-center lg:hidden">
            <button
              ref={mobileSearchToggleRef}
              type="button"
              onClick={toggleMobileSearch}
              aria-label="Buscar"
              aria-expanded={isMobileSearchOpen}
              className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg z-99999 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg
                className="fill-gray-700 dark:fill-gray-400"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path fillRule="evenodd" clipRule="evenodd" d={searchIconPath} fill="" />
              </svg>
            </button>

            <button
              onClick={toggleApplicationMenu}
              className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg z-99999 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>

          <div className="hidden lg:block">
            <div ref={searchContainerRef} className="relative">
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <span className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2">
                    <svg
                      className="fill-gray-500 dark:fill-gray-400"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path fillRule="evenodd" clipRule="evenodd" d={searchIconPath} fill="" />
                    </svg>
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => query && setIsSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Buscar en la app..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isSearchOpen && results.length > 0}
                    aria-controls="app-search-results-desktop"
                    className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[430px]"
                  />

                  <button
                    type="submit"
                    aria-label="Buscar"
                    className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path fillRule="evenodd" clipRule="evenodd" d={searchIconPath} fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </form>

              {isSearchOpen && query && renderResultsDropdown("app-search-results-desktop")}
            </div>
          </div>
        </div>

        {isMobileSearchOpen && (
          <div className="w-full border-b border-gray-200 px-3 pb-3 dark:border-gray-800 lg:hidden">
            <div ref={mobileSearchContainerRef} className="relative">
              <form onSubmit={handleSearchSubmit}>
                <div className="relative">
                  <span className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2">
                    <svg
                      className="fill-gray-500 dark:fill-gray-400"
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path fillRule="evenodd" clipRule="evenodd" d={searchIconPath} fill="" />
                    </svg>
                  </span>
                  <input
                    ref={mobileInputRef}
                    type="text"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => query && setIsSearchOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Buscar en la app..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isSearchOpen && results.length > 0}
                    aria-controls="app-search-results-mobile"
                    className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                  />

                  <button
                    type="submit"
                    aria-label="Buscar"
                    className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-1.5 text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.08]"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path fillRule="evenodd" clipRule="evenodd" d={searchIconPath} fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </form>

              {isSearchOpen && query && renderResultsDropdown("app-search-results-mobile")}
            </div>
          </div>
        )}

        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } w-full items-center justify-between gap-2 px-3 py-2.5 shadow-theme-md lg:flex lg:w-auto lg:justify-end lg:gap-4 lg:px-0 lg:py-4 lg:shadow-none`}
        >
          <div className="flex flex-1 items-center justify-start gap-1.5 2xsm:gap-2 lg:flex-none lg:gap-3">
            {/* <!-- Dark Mode Toggler --> */}
            <ThemeToggleButton />
            {/* <!-- Dark Mode Toggler --> */}
            <NotificationDropdown />
            {/* <!-- Notification Menu Area --> */}
            <AccountSwitcher />
          </div>
          {/* <!-- User Area --> */}
          <div className="flex items-center gap-2">
            <UserDropdown />
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:hidden"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 18.9149 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
