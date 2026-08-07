import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import { obtenerPerfilCompleto } from '../../services/api';
import { confirmarCierreSesion } from '../../utils/alerts';

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

/**
 * Muestra la cuenta activa y permite cerrar sesión.
 * Si el usuario es admin, también permite cambiar entre perfiles
 * representativos o buscar cualquier usuario por su ID USRxxxx.
 */
export default function AccountSwitcher() {
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
            className="h-11 min-w-0 max-w-[10.5rem] rounded-lg border border-gray-300 bg-transparent px-3 text-center text-theme-xs font-medium text-gray-600 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 sm:max-w-none sm:px-4"
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
              className="absolute right-0 top-full z-50 mt-2 w-[290px] rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label
                  htmlFor="admin-user-search"
                  className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  Buscar por ID de usuario
                </label>

                <button
                  type="button"
                  onClick={cerrarBuscador}
                  aria-label="Cerrar buscador"
                  title="Cerrar"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
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
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />

                <button
                  type="submit"
                  disabled={buscandoUsuario}
                  className="h-10 rounded-lg bg-brand-500 px-3 text-theme-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {buscandoUsuario ? 'Buscando…' : 'Buscar'}
                </button>
              </div>

              <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
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

      <div className="relative hidden text-right sm:block">
        {isAdmin ? (
          <button
            type="button"
            onClick={handleAdminEmailClick}
            title="¡Eres admin!"
            className="text-theme-xs font-semibold text-success-600 transition hover:text-success-700 dark:text-success-400 dark:hover:text-success-300"
          >
            {email}
          </button>
        ) : (
          <p className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
            {email}
          </p>
        )}

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
        className="hidden shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] sm:inline-block"
      >
        Salir
      </button>
    </div>
  );
}