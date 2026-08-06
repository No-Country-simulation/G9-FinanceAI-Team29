import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import { confirmarCierreSesion } from '../../utils/alerts';

/** Mensajes chistosos para quien le hace clic rápido al correo de admin. */
const ADMIN_EASTER_EGGS = [
  '🚨 ¡Alerta antifraude! Bájale al mouse 🕵️',
  '🔴 Tranquilo, ya eres admin, no hace falta insistir 😅',
  '🔴 Ese ritmo de clics preocuparía hasta al banco 📉',
];

const RAPID_CLICK_WINDOW_MS = 600;
const RAPID_CLICK_THRESHOLD = 5;

/**
 * Muestra la cuenta activa y permite cerrar sesión.
 * Si el usuario es admin, además puede cambiar entre todos los perfiles.
 */
export default function AccountSwitcher() {
  const { email, isAdmin, usuarioId, setUsuarioId, cuentas, signOut } = useAuth();
  const { desbloquearLogro } = useGamification();
  const navigate = useNavigate();
  const [adminBadgeKey, setAdminBadgeKey] = useState(0);
  const [showAdminBadge, setShowAdminBadge] = useState(false);
  const [adminBadgeMessage, setAdminBadgeMessage] = useState('✨ ¡Admin! 👑');
  const [isEasterEgg, setIsEasterEgg] = useState(false);
  const rapidClickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleLogout = async () => {
    if (!(await confirmarCierreSesion())) return;
    await signOut();
    navigate('/signin', { replace: true, state: { loggedOut: true } });
  };

  const handleAdminEmailClick = () => {
    const now = Date.now();
    const isRapid = now - lastClickTimeRef.current < RAPID_CLICK_WINDOW_MS;
    lastClickTimeRef.current = now;
    rapidClickCountRef.current = isRapid ? rapidClickCountRef.current + 1 : 1;

    if (rapidClickCountRef.current >= RAPID_CLICK_THRESHOLD) {
      rapidClickCountRef.current = 0;
      setIsEasterEgg(true);
      setAdminBadgeMessage(
        ADMIN_EASTER_EGGS[Math.floor(Math.random() * ADMIN_EASTER_EGGS.length)],
      );
      desbloquearLogro('admin_click_frenzy');
    } else {
      setIsEasterEgg(false);
      setAdminBadgeMessage('✨ ¡Admin! 👑');
    }

    setAdminBadgeKey((key) => key + 1);
    setShowAdminBadge(true);
  };

  if (!email) return null;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-3">
      {isAdmin && (
        <select
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          title="Cambiar de perfil (admin)"
          className="h-11 min-w-0 max-w-[9.5rem] rounded-lg border border-gray-300 bg-transparent px-4 text-center text-theme-xs font-medium text-gray-600 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 sm:max-w-none sm:px-4"
        >
          {cuentas.map((c) => (
            <option key={c.usuarioId} value={c.usuarioId}>
              {c.etiqueta}
            </option>
          ))}
        </select>
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
          <p className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">{email}</p>
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
        onClick={handleLogout}
        className="hidden shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] sm:inline-block"
      >
        Salir
      </button>
    </div>
  );
}
