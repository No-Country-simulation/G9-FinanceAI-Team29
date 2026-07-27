import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

/**
 * Mapeo de cada cuenta demo (Supabase Auth) al usuario de datos (USRxxxx) del backend.
 * Los usuarios USRxxxx son sintéticos y no tienen email, por eso mapeamos aquí.
 */
const EMAIL_TO_USUARIO: Record<string, string> = {
  'demo.critico@finsight.com': 'USR0001',
  'demo.intermedio@finsight.com': 'USR0002',
  'demo.saludable@finsight.com': 'USR0009',
};

/** Cuentas con rol admin: pueden cambiar entre todos los perfiles. */
const ADMIN_EMAILS = ['demo.admin@finsight.com'];

/** Lista de cuentas que el admin puede inspeccionar (etiquetas para el selector). */
export const CUENTAS_DEMO = [
  { usuarioId: 'USR0001', etiqueta: 'Crítico · USR0001' },
  { usuarioId: 'USR0002', etiqueta: 'Intermedio · USR0002' },
  { usuarioId: 'USR0009', etiqueta: 'Saludable · USR0009' },
];

const FALLBACK_USUARIO = 'USR0001';

interface AuthContextValue {
  session: Session | null;
  email: string | null;
  isAdmin: boolean;
  /** Usuario de datos activo (el que consumen todas las páginas). */
  usuarioId: string;
  /** Cambiar el usuario activo — solo tiene efecto para el admin. */
  setUsuarioId: (id: string) => void;
  cuentas: typeof CUENTAS_DEMO;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Selección del admin (los usuarios normales quedan atados a su mapeo).
  const [adminUsuarioId, setAdminUsuarioId] = useState(FALLBACK_USUARIO);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const email = session?.user?.email ?? null;
  const isAdmin = email ? ADMIN_EMAILS.includes(email) : false;

  const usuarioId = isAdmin
    ? adminUsuarioId
    : (email ? EMAIL_TO_USUARIO[email] : undefined) ?? FALLBACK_USUARIO;

  const signIn = async (correo: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: correo,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        email,
        isAdmin,
        usuarioId,
        setUsuarioId: setAdminUsuarioId,
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
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
