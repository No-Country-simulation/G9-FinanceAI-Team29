import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

/**
 * Mapeo de cada cuenta demo (Supabase Auth) al usuario de datos (USRxxxx)
 * del backend.
 */
const EMAIL_TO_USUARIO: Record<string, string> = {
  'demo.critico@finsight.com': 'USR0001',
  'demo.intermedio@finsight.com': 'USR0002',
  'demo.saludable@finsight.com': 'USR0009',
};

/** Cuentas con rol admin: pueden cambiar entre todos los perfiles. */
const ADMIN_EMAILS = ['demo.admin@finsight.com'];

/** Lista de cuentas que el admin puede inspeccionar. */
export const CUENTAS_DEMO = [
  { usuarioId: 'USR0001', etiqueta: 'Crítico · USR0001' },
  { usuarioId: 'USR0002', etiqueta: 'Intermedio · USR0002' },
  { usuarioId: 'USR0009', etiqueta: 'Saludable · USR0009' },
  { usuarioId: 'USR1001', etiqueta: 'CSV demo · USR1001' },
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

interface MiPerfilResponse {
  id: string;
  authUserId?: string;
  email?: string | null;
}

interface AuthContextValue {
  session: Session | null;
  email: string | null;
  isAdmin: boolean;

  /**
   * Usuario de datos activo.
   * Queda vacío mientras una cuenta real todavía no tenga un perfil
   * asociado en Spring.
   */
  usuarioId: string;

  /**
   * Emoji elegido como foto de perfil, guardado en el user_metadata de
   * Supabase Auth. Null si el usuario todavía no eligió ninguno.
   */
  avatarIcon: string | null;

  /**
   * Guarda el ID USRxxxx devuelto por Spring para la cuenta autenticada.
   * En una cuenta admin cambia el perfil inspeccionado.
   */
  setUsuarioId: (id: string) => void;

  cuentas: typeof CUENTAS_DEMO;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  /**
   * Fuerza un refresco de la sesión de Supabase para traer el user_metadata
   * más reciente (por ejemplo, después de editar nombre/apellido en /profile).
   */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function storageKey(authUserId: string): string {
  return `finsight.usuarioId.${authUserId}`;
}

/**
 * Recupera el perfil del usuario autenticado desde el backend.
 * El backend deriva el authUserId desde el JWT de Supabase.
 */
async function obtenerMiPerfil(
  accessToken: string,
): Promise<MiPerfilResponse> {
  const response = await fetch(`${API_BASE}/usuarios/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('La sesión no es válida o venció.');
    }

    if (response.status === 403) {
      throw new Error('No tenés permiso para acceder a este perfil.');
    }

    if (response.status === 404) {
      throw new Error(
        'No existe un perfil financiero asociado a esta cuenta.',
      );
    }

    throw new Error(
      `No se pudo recuperar el perfil asociado (HTTP ${response.status}).`,
    );
  }

  const data = (await response.json()) as Partial<MiPerfilResponse>;

  if (!data.id || typeof data.id !== 'string') {
    throw new Error('El backend no devolvió un usuarioId válido.');
  }

  return {
    id: data.id,
    authUserId: data.authUserId,
    email: data.email,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [usuarioLoading, setUsuarioLoading] = useState(false);
  const [usuarioRegistradoId, setUsuarioRegistradoId] = useState<string>('');
  const [adminUsuarioId, setAdminUsuarioId] = useState(
    ADMIN_DEFAULT_USUARIO,
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error('No se pudo recuperar la sesión:', error);
      }

      setSession(data.session);
      setSessionLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setSessionLoading(false);
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /**
   * Recupera el USRxxxx correspondiente a la cuenta real autenticada.
   * Usa localStorage como caché y, si no existe (por ejemplo, un navegador
   * nuevo o el caché borrado), consulta al backend mediante /api/usuarios/me
   * enviando el JWT de Supabase.
   */
  useEffect(() => {
    let cancelled = false;

    const authUserId = session?.user?.id;
    const accessToken = session?.access_token;
    const correo = session?.user?.email?.toLowerCase() ?? null;
    const esAdmin = correo ? ADMIN_EMAILS.includes(correo) : false;
    const esDemo = correo ? Boolean(EMAIL_TO_USUARIO[correo]) : false;

    if (!authUserId || !accessToken) {
      setUsuarioRegistradoId('');
      setUsuarioLoading(false);

      return () => {
        cancelled = true;
      };
    }

    if (esAdmin || esDemo) {
      setUsuarioRegistradoId('');
      setUsuarioLoading(false);

      return () => {
        cancelled = true;
      };
    }

    const guardado =
      localStorage.getItem(storageKey(authUserId))?.trim() ?? '';

    if (guardado) {
      setUsuarioRegistradoId(guardado);
      setUsuarioLoading(false);

      return () => {
        cancelled = true;
      };
    }

    setUsuarioLoading(true);

    void obtenerMiPerfil(accessToken)
      .then((perfil) => {
        if (cancelled) return;

        const idLimpio = perfil.id.trim();

        localStorage.setItem(
          storageKey(authUserId),
          idLimpio,
        );

        setUsuarioRegistradoId(idLimpio);
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(
          'No se pudo recuperar el usuario asociado a la sesión:',
          error,
        );

        setUsuarioRegistradoId('');
      })
      .finally(() => {
        if (!cancelled) {
          setUsuarioLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    session?.user?.id,
    session?.user?.email,
    session?.access_token,
  ]);

  const avatarIcon =
    typeof session?.user?.user_metadata?.avatar_icon === 'string'
      ? session.user.user_metadata.avatar_icon
      : null;

  const email = session?.user?.email?.toLowerCase() ?? null;
  const isAdmin = email ? ADMIN_EMAILS.includes(email) : false;
  const usuarioDemoId = email ? EMAIL_TO_USUARIO[email] : undefined;

  const usuarioId = isAdmin
    ? adminUsuarioId
    : usuarioDemoId ?? usuarioRegistradoId;

  const cambiarUsuarioId = (id: string) => {
    const idLimpio = id.trim();

    if (!idLimpio) {
      throw new Error('El ID del usuario no puede estar vacío.');
    }

    if (isAdmin) {
      setAdminUsuarioId(idLimpio);
      return;
    }

    const authUserId = session?.user?.id;

    if (!authUserId) {
      throw new Error(
        'No hay una sesión activa para asociar el perfil del usuario.',
      );
    }

    localStorage.setItem(storageKey(authUserId), idLimpio);
    setUsuarioRegistradoId(idLimpio);
  };

  const signIn = async (correo: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setSession(null);
    setUsuarioRegistradoId('');
    setAdminUsuarioId(ADMIN_DEFAULT_USUARIO);
    setUsuarioLoading(false);
  };

  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();

    if (error) throw error;

    setSession(data.session);
  };

  const loading = sessionLoading || usuarioLoading;

  /**
   * Auto-logout por inactividad: si el usuario no interactúa durante
   * VITE_INACTIVITY_MINUTES (25 por defecto), se cierra la sesión.
   * Solo activo mientras hay sesión; cualquier interacción reinicia el contador.
   */
  useEffect(() => {
    if (!session) return;

    const minutos = Number(
      import.meta.env.VITE_INACTIVITY_MINUTES ?? 25,
    );
    const timeoutMs = minutos * 60 * 1000;
    let timer: number;

    const reiniciar = () => {
      window.clearTimeout(timer);

      timer = window.setTimeout(() => {
        void signOut();
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
