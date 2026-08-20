import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import { obtenerPerfilCompleto } from '../../services/api';
import { confirmarCierreSesion } from '../../utils/alerts';
import { useEsModoMatrix } from '../../hooks/useEsModoMatrix';

/** Mensajes chistosos para quien le hace clic rápido al correo de admin. */
const ADMIN_EASTER_EGGS = [
  '🚨 ¡Alerta antifraude! Bájale al mouse 🕵️',
  '🔴 Tranquilo, ya eres admin, no hace falta insistir 😅',
  '🔴 Ese ritmo de clics preocuparía hasta al banco 📉',
];

const RAPID_CLICK_WINDOW_MS = 600;
const RAPID_CLICK_THRESHOLD = 5;
const SEARCH_OPTION = '__buscar_usuario__';
const USER_ID_PATTERN = /^USR\d{4}$/;
const FINANCIAL_SCORE_EVENT = 'finsight:financial-score-updated';
const FINANCIAL_SCORE_STORAGE_KEY = (usuarioId: string) =>
  `finsight:financial-score:${usuarioId}`;

type FinancialScoreDetail = {
  financialScore: number;
  scoreStatus: string;
};

/**
 * Muestra la cuenta activa y permite cerrar sesión.
 * Si el usuario es admin, también permite cambiar entre perfiles
 * representativos o buscar cualquier usuario por su ID USRxxxx.
 */
export default function AccountSwitcher() {
  const enModoMatrix = useEsModoMatrix();
  const {
    email,
    isAdmin,
    usuarioId,
    setUsuarioId,
    cuentas,
    signOut,
  } = useAuth();

  const { desbloquearLogro } = useGamification();
  const navigate = useNavigate();

  const [adminBadgeKey, setAdminBadgeKey] = useState(0);
  const [showAdminBadge, setShowAdminBadge] = useState(false);
  const [adminBadgeMessage, setAdminBadgeMessage] = useState(
    '✨ ¡Admin! 👑',
  );
  const [isEasterEgg, setIsEasterEgg] = useState(false);

  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [usuarioBuscado, setUsuarioBuscado] = useState('');
  const [buscandoUsuario, setBuscandoUsuario] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [financialScore, setFinancialScore] =
    useState<FinancialScoreDetail | null>(null);

  const rapidClickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleLogout = async () => {
    if (!(await confirmarCierreSesion())) return;

    await signOut();

    navigate('/signin', {
      replace: true,
      state: { loggedOut: true },
    });
  };

  const handleAdminEmailClick = () => {
    const now = Date.now();
    const isRapid =
      now - lastClickTimeRef.current < RAPID_CLICK_WINDOW_MS;

    lastClickTimeRef.current = now;
    rapidClickCountRef.current = isRapid
      ? rapidClickCountRef.current + 1
      : 1;

    if (rapidClickCountRef.current >= RAPID_CLICK_THRESHOLD) {
      rapidClickCountRef.current = 0;
      setIsEasterEgg(true);
      setAdminBadgeMessage(
        ADMIN_EASTER_EGGS[
          Math.floor(Math.random() * ADMIN_EASTER_EGGS.length)
        ],
      );
      desbloquearLogro('admin_click_frenzy');
    } else {
      setIsEasterEgg(false);
      setAdminBadgeMessage('✨ ¡Admin! 👑');
    }

    setAdminBadgeKey((key) => key + 1);
    setShowAdminBadge(true);
  };

  const cerrarBuscador = () => {
    setMostrarBuscador(false);
    setUsuarioBuscado('');
    setErrorBusqueda('');
  };

  useEffect(() => {
    if (!mostrarBuscador) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cerrarBuscador();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [mostrarBuscador]);

  useEffect(() => {
    if (!usuarioId) {
      setFinancialScore(null);
      return;
    }

    const storageKey = FINANCIAL_SCORE_STORAGE_KEY(usuarioId);
    const guardado = sessionStorage.getItem(storageKey);

    if (guardado) {
      try {
        const parsed = JSON.parse(guardado) as FinancialScoreDetail;

        if (typeof parsed.financialScore === 'number') {
          setFinancialScore({
            financialScore: Math.max(
              0,
              Math.min(100, parsed.financialScore),
            ),
            scoreStatus: parsed.scoreStatus ?? '',
          });
        }
      } catch {
        sessionStorage.removeItem(storageKey);
        setFinancialScore(null);
      }
    } else {
      setFinancialScore(null);
    }

    const handleFinancialScore = (event: Event) => {
      const detail = (
        event as CustomEvent<FinancialScoreDetail | null>
      ).detail;

      if (
        !detail ||
        typeof detail.financialScore !== 'number'
      ) {
        setFinancialScore(null);
        sessionStorage.removeItem(storageKey);
        return;
      }

      const siguiente = {
        financialScore: Math.max(
          0,
          Math.min(100, detail.financialScore),
        ),
        scoreStatus: detail.scoreStatus ?? '',
      };

      setFinancialScore(siguiente);
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(siguiente),
      );
    };

    window.addEventListener(
      FINANCIAL_SCORE_EVENT,
      handleFinancialScore,
    );

    return () => {
      window.removeEventListener(
        FINANCIAL_SCORE_EVENT,
        handleFinancialScore,
      );
    };
  }, [usuarioId]);


  const getScoreHoverBorder = (score: number) => {
    if (score <= 25) {
      return 'hover:border-error-500/80 hover:shadow-[0_0_12px_rgba(239,68,68,0.16)]';
    }

    if (score <= 50) {
      return 'hover:border-amber-400/70 hover:shadow-[0_0_12px_rgba(182,162,90,0.16)]';
    }

    if (score <= 75) {
      return 'hover:border-brand-500/80 hover:shadow-[0_0_12px_rgba(79,109,245,0.16)]';
    }

    return 'hover:border-success-500/80 hover:shadow-[0_0_12px_rgba(34,197,94,0.16)]';
  };

  const handlePerfilChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;

    if (value === SEARCH_OPTION) {
      setMostrarBuscador(true);
      setErrorBusqueda('');
      return;
    }

    cerrarBuscador();
    setUsuarioId(value);
  };

  const handleBuscarUsuario = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const idNormalizado = usuarioBuscado.trim().toUpperCase();

    setUsuarioBuscado(idNormalizado);
    setErrorBusqueda('');

    if (!USER_ID_PATTERN.test(idNormalizado)) {
      setErrorBusqueda(
        'Usa un ID con formato USR0001.',
      );
      return;
    }

    try {
      setBuscandoUsuario(true);

      const perfil = await obtenerPerfilCompleto(idNormalizado);

      if (!perfil?.id) {
        throw new Error('Usuario no encontrado.');
      }

      setUsuarioId(perfil.id.trim().toUpperCase());
      cerrarBuscador();
    } catch (error) {
      console.error(
        'No se pudo buscar el usuario:',
        error,
      );

      setErrorBusqueda(
        'Usuario no encontrado o no disponible.',
      );
    } finally {
      setBuscandoUsuario(false);
    }
  };

  if (!email) return null;

  const usuarioEsDemo = cuentas.some(
    (cuenta) => cuenta.usuarioId === usuarioId,
  );

  const valorSelector =
    mostrarBuscador || !usuarioEsDemo
      ? SEARCH_OPTION
      : usuarioId;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {isAdmin && (
        <div className="relative flex items-center gap-2">
          <select
            value={valorSelector}
            onChange={handlePerfilChange}
            title="Cambiar de perfil o buscar usuario"
            aria-label="Cambiar de perfil o buscar usuario"
            className={`h-11 min-w-0 max-w-[10.5rem] rounded-lg border bg-transparent px-3 text-center text-theme-xs font-medium focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 sm:max-w-none sm:px-4 ${
              enModoMatrix
                ? "border-error-900/40 text-error-400 focus:border-error-500"
                : "border-gray-300 text-gray-600 focus:border-brand-500"
            }`}
          >
            {cuentas.map((cuenta) => (
              <option
                key={cuenta.usuarioId}
                value={cuenta.usuarioId}
              >
                {cuenta.etiqueta}
              </option>
            ))}

            <option value={SEARCH_OPTION}>
              Buscar usuario…
            </option>
          </select>

          {mostrarBuscador && (
            <form
              onSubmit={handleBuscarUsuario}
              className={`absolute right-0 top-full z-50 mt-2 w-[290px] rounded-xl border p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900 ${
                enModoMatrix ? "border-error-900/40 bg-gray-950" : "border-gray-200 bg-white"
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="admin-user-search"
                  className={`block text-theme-xs font-medium dark:text-gray-300 ${enModoMatrix ? "!text-gray-300" : "text-gray-700"}`}
                >
                  Buscar por ID de usuario
                </label>

                <button
                  type="button"
                  onClick={cerrarBuscador}
                  aria-label="Cerrar buscador"
                  title="Cerrar"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none transition dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200 ${
                    enModoMatrix ? "!text-error-400 hover:!bg-error-950/40 hover:!text-error-300" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  }`}
                >
                  ×
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  id="admin-user-search"
                  type="text"
                  value={usuarioBuscado}
                  onChange={(event) => {
                    setUsuarioBuscado(
                      event.target.value.toUpperCase(),
                    );
                    setErrorBusqueda('');
                  }}
                  placeholder="USR0001"
                  maxLength={7}
                  autoFocus
                  className={`h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white ${
                    enModoMatrix ? "border-error-900/40 bg-gray-900 text-white focus:border-error-500" : "border-gray-300 bg-white text-gray-900 focus:border-brand-500"
                  }`}
                />

                <button
                  type="submit"
                  disabled={buscandoUsuario}
                  className={`h-10 rounded-lg px-3 text-theme-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    enModoMatrix ? "bg-error-600 hover:bg-error-500" : "bg-brand-500 hover:bg-brand-600"
                  }`}
                >
                  {buscandoUsuario ? 'Buscando…' : 'Buscar'}
                </button>
              </div>

              <p className={`mt-1.5 text-theme-xs dark:text-gray-400 ${enModoMatrix ? "!text-error-400/70" : "text-gray-500"}`}>
                Ejemplo: USR0123
              </p>

              {errorBusqueda && (
                <p
                  role="alert"
                  className="mt-2 text-theme-xs font-medium text-error-600 dark:text-error-400"
                >
                  {errorBusqueda}
                </p>
              )}
            </form>
          )}
        </div>
      )}

      <div className="relative hidden sm:flex sm:items-center sm:gap-3">
        <div className="text-right">
          {isAdmin ? (
            <button
              type="button"
              onClick={handleAdminEmailClick}
              title="¡Eres admin!"
              className={`text-theme-xs font-semibold transition dark:text-success-400 dark:hover:text-success-300 ${
                enModoMatrix ? "!text-success-400 hover:!text-success-300" : "text-success-600 hover:text-success-700"
              }`}
            >
              {email}
            </button>
          ) : (
            <p className={`text-theme-xs font-medium dark:text-gray-300 ${enModoMatrix ? "!text-gray-300" : "text-gray-700"}`}>
              {email}
            </p>
          )}
        </div>

        {financialScore && (() => {
          const score = Math.round(financialScore.financialScore);
          const grados = score * 3.6;
          const hoverBorder = getScoreHoverBorder(score);

          return (
            <div
              className={`group relative cursor-default rounded-xl border border-transparent px-2.5 py-2 transition-all duration-200 ${hoverBorder}`}
            >
              <div className="flex items-center gap-2">
                <div className="relative h-8 w-8 shrink-0">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from -90deg, #ef4444 0deg, #b6a25a 105deg, #4f6df5 215deg, #22c55e 360deg)',
                      WebkitMask:
                        'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                      mask:
                        'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                    }}
                  />

                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(
                        from -90deg,
                        transparent 0deg,
                        transparent ${grados}deg,
                        rgb(55 65 81 / 0.92) ${grados}deg,
                        rgb(55 65 81 / 0.92) 360deg
                      )`,
                      WebkitMask:
                        'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                      mask:
                        'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))',
                    }}
                  />
                </div>

                <div className="text-left">
                  <div className="flex items-baseline gap-0.5 leading-none">
                    <span className="text-theme-sm font-black text-gray-800 dark:text-white">
                      {score}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-500">
                      /100
                    </span>
                  </div>

                  <p className="mt-1 whitespace-nowrap text-[10px] font-semibold leading-none text-gray-600 dark:text-gray-300">
                    Puntaje financiero
                  </p>
                </div>
              </div>

              <div className="pointer-events-none absolute right-0 top-full z-[1000003] mt-2 translate-y-1 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
                {financialScore.scoreStatus || 'Puntaje financiero'}
              </div>
            </div>
          );
        })()}

        {isAdmin && showAdminBadge && (
          <span
            key={adminBadgeKey}
            onAnimationEnd={() => setShowAdminBadge(false)}
            className={
              isEasterEgg
                ? 'animate-admin-badge-easter-egg pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-3 py-1 text-theme-xs font-bold text-white shadow-lg shadow-red-500/50'
                : 'animate-admin-badge-pop pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-success-500 to-success-300 px-3 py-1 text-theme-xs font-bold text-white shadow-lg shadow-success-500/40'
            }
          >
            {adminBadgeMessage}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className={`hidden shrink-0 rounded-lg border px-3 py-1.5 text-theme-sm font-medium transition dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] sm:inline-block ${
          enModoMatrix
            ? "border-error-800 text-error-400 hover:bg-error-950/40"
            : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        Salir
      </button>
    </div>
  );
}