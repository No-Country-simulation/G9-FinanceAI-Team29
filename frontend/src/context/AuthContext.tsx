import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  AppSession,
  getSession,
  saveToken,
  clearToken,
  setAvatar,
  setAvatarUrl,
  subscribe,
} from '../services/authSession';
import { obtenerPerfilCompleto } from '../services/api';
import { mostrarSesionExpirada } from '../utils/alerts';

/** Cuentas con rol admin: pueden cambiar entre todos los perfiles. */
const ADMIN_EMAILS = ['demo.admin@finsight.com'];

/** Lista de cuentas que el admin puede inspeccionar. */
export const CUENTAS_DEMO = [
  { usuarioId: 'USR0001', etiqueta: 'En Riesgo · USR0001' },
  { usuarioId: 'USR0002', etiqueta: 'En Observación · USR0002' },
  { usuarioId: 'USR0009', etiqueta: 'Saludable · USR0009' },
];

const ADMIN_DEFAULT_USUARIO = 'USR0001';

function normalizarApiBase(url: string): string {
  const limpia = url.replace(/\/$/, '');
  return limpia.endsWith('/api') ? limpia : `${limpia}/api`;
}

const API_BASE = normalizarApiBase(
  import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.VITE_BACKEND_URL ??
    import.meta.env.VITE_API_URL ??
    'http://localhost:8081/api',
);

interface AuthContextValue {
  session: AppSession | null;
  email: string | null;
  isAdmin: boolean;

  /** Usuario de datos activo. Es el `sub` del token (USR####). */
  usuarioId: string;

  /** Emoji elegido como foto de perfil (guardado localmente). Null si no eligió ninguno. */
  avatarIcon: string | null;

  /** URL de la foto de perfil subida a Object Storage. Null = usa el emoji. */
  avatarUrl: string | null;

  /** Solo cambia el perfil inspeccionado por una cuenta admin. */
  setUsuarioId: (id: string) => void;

  cuentas: typeof CUENTAS_DEMO;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  /** Re-lee la sesión actual (por ejemplo, tras cambiar el avatar). */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // getSession() es síncrono (lee el token de localStorage) → no hay parpadeo de carga.
  const [session, setSession] = useState<AppSession | null>(() => getSession());
  const [adminUsuarioId, setAdminUsuarioId] = useState(ADMIN_DEFAULT_USUARIO);

  // Reacciona a login/logout/avatar (mismo tab vía pub/sub; otros tabs vía 'storage').
  useEffect(() => {
    const refrescar = () => setSession(getSession());

    const unsubscribe = subscribe(refrescar);
    window.addEventListener('storage', refrescar);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', refrescar);
    };
  }, []);

  const avatarIcon =
    typeof session?.user.user_metadata.avatar_icon === 'string'
      ? session.user.user_metadata.avatar_icon
      : null;

  const avatarUrl =
    typeof session?.user.user_metadata.avatar_url === 'string'
      ? session.user.user_metadata.avatar_url
      : null;

  const email = session?.user.email?.toLowerCase() ?? null;
  const isAdmin = email ? ADMIN_EMAILS.includes(email) : false;

  // El sub del token ES el usuarioId. El admin puede inspeccionar otros perfiles.
  const usuarioId = isAdmin ? adminUsuarioId : session?.user.id ?? '';

  // La foto de perfil (avatar_url) vive en localStorage sin repoblarse en el
  // login: PerfilDataContext solo la carga perezosamente cuando se visita
  // /profile, así que en el resto de la app (header, sidebar) se veía una
  // foto vieja o ninguna hasta esa visita. Sincronizamos acá, una vez por
  // usuario activo, para que quede correcta desde el primer render.
  useEffect(() => {
    if (!usuarioId) return;

    let cancelado = false;

    obtenerPerfilCompleto(usuarioId)
      .then((perfil) => {
        if (!cancelado) setAvatarUrl(perfil.avatarUrl ?? null);
      })
      .catch((error) => {
        console.error('No se pudo sincronizar la foto de perfil:', error);
      });

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  const cambiarUsuarioId = (id: string) => {
    const idLimpio = id.trim();

    if (!idLimpio) {
      throw new Error('El ID del usuario no puede estar vacío.');
    }

    if (isAdmin) {
      setAdminUsuarioId(idLimpio);
      return;
    }

    // Un usuario normal no puede cambiar su propio ID (sale del token).
    console.warn('setUsuarioId ignorado: solo un admin puede cambiar de perfil.');
  };

  const signIn = async (correo: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: correo.trim().toLowerCase(),
        password,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.mensaje ??
          'No se pudo iniciar sesión. Verificá tu correo y contraseña.',
      );
    }

    const { token } = (await response.json()) as { token?: string };
    if (!token) {
      throw new Error('El servidor no devolvió un token de sesión.');
    }

    saveToken(token); // dispara el pub/sub → setSession
  };

  const signOut = async () => {
    clearToken();
    // El avatar vive en localStorage sin namespacing por usuario: si no se
    // limpia acá, la próxima cuenta que inicie sesión en este navegador
    // arranca mostrando la foto/emoji de la sesión anterior.
    setAvatar(null);
    setAvatarUrl(null);
    setSession(null);
    setAdminUsuarioId(ADMIN_DEFAULT_USUARIO);
  };

  const refreshSession = async () => {
    setSession(getSession());
  };

  // La sesión se resuelve de forma síncrona; no hay carga asíncrona inicial.
  const loading = false;

  /**
   * Auto-logout por inactividad: si el usuario no interactúa durante
   * VITE_INACTIVITY_MINUTES (25 por defecto), se cierra la sesión.
   */
  useEffect(() => {
    if (!session) return;

    const minutos = Number(import.meta.env.VITE_INACTIVITY_MINUTES ?? 25);
    const timeoutMs = minutos * 60 * 1000;
    let timer: number;

    const reiniciar = () => {
      window.clearTimeout(timer);

      timer = window.setTimeout(() => {
        void signOut().then(() => mostrarSesionExpirada());
      }, timeoutMs);
    };

    const eventos = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];

    eventos.forEach((evento) =>
      window.addEventListener(evento, reiniciar, { passive: true }),
    );

    reiniciar();

    return () => {
      window.clearTimeout(timer);

      eventos.forEach((evento) =>
        window.removeEventListener(evento, reiniciar),
      );
    };

    // signOut es estable en la práctica; no lo incluimos para no
    // reiniciar el timer en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        email,
        isAdmin,
        usuarioId,
        avatarIcon,
        avatarUrl,
        setUsuarioId: cambiarUsuarioId,
        cuentas: CUENTAS_DEMO,
        loading,
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }

  return ctx;
}
