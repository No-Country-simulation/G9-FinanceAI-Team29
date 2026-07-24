import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

/**
 * Muestra la cuenta activa y permite cerrar sesión.
 * Si el usuario es admin, además puede cambiar entre todos los perfiles.
 */
export default function AccountSwitcher() {
  const { email, isAdmin, usuarioId, setUsuarioId, cuentas, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  if (!email) return null;

  return (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <select
          value={usuarioId}
          onChange={(e) => setUsuarioId(e.target.value)}
          title="Cambiar de perfil (admin)"
          className="rounded-lg border border-gray-300 bg-transparent px-3 py-1.5 text-theme-xs font-medium text-gray-600 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {cuentas.map((c) => (
            <option key={c.usuarioId} value={c.usuarioId}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      )}

      <div className="hidden text-right sm:block">
        <p className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">{email}</p>
        <p className="text-theme-xs text-gray-400">
          {isAdmin ? `admin · ${usuarioId}` : usuarioId}
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
      >
        Salir
      </button>
    </div>
  );
}
