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
   * Guarda el ID USRxxxx devuelto por Spring para la cuenta autenticada.
   * En una cuenta admin cambia el perfil inspeccionado.
   */
  setUsuarioId: (id: string) => void;

  cuentas: typeof CUENTAS_DEMO;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function storageKey(authUserId: string): string {
  return `finsight.usuarioId.${authUserId}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /**
   * Recupera el USRxxxx correspondiente a la cuenta real autenticada.
   * Se guarda por UUID de Supabase para no mezclar cuentas en el mismo navegador.
   */
  useEffect(() => {
    const authUserId = session?.user?.id;

    if (!authUserId) {
      setUsuarioRegistradoId('');
      return;
    }

    const guardado = localStorage.getItem(storageKey(authUserId)) ?? '';
    setUsuarioRegistradoId(guardado);
  }, [session?.user?.id]);

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
  };

  /**
   * Auto-logout por inactividad: si el usuario no interactúa durante
   * VITE_INACTIVITY_MINUTES (25 por defecto), se cierra la sesión.
   * Solo activo mientras hay sesión; cualquier interacción reinicia el contador.
   */
  useEffect(() => {
    if (!session) return;

    const minutos = Number(import.meta.env.VITE_INACTIVITY_MINUTES ?? 25);
    const timeoutMs = minutos * 60 * 1000;
    let timer: number;

    const reiniciar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void signOut();
      }, timeoutMs);
    };

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    eventos.forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
    reiniciar();

    return () => {
      window.clearTimeout(timer);
      eventos.forEach((ev) => window.removeEventListener(ev, reiniciar));
    };
    // signOut es estable en la práctica; no lo incluimos para no reiniciar el timer en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <AuthContext.Provider
      value={{
        session,
        email,
        isAdmin,
        usuarioId,
        setUsuarioId: cambiarUsuarioId,
        cuentas: CUENTAS_DEMO,
        loading,
        signIn,
        signOut,
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
