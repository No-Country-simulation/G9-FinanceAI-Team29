/**
 * Sesión propia del frontend (reemplaza a Supabase Auth).
 *
 * Guarda el JWT que firma NUESTRO backend en localStorage, lo decodifica para
 * derivar el usuario (el claim `sub` ES el usuarioId USR####), y expone un
 * pequeño pub/sub para que el AuthContext reaccione a login/logout/avatar.
 *
 * El avatar (emoji) se guarda acá localmente porque ya no existe el
 * user_metadata de Supabase. (Más adelante puede persistirse en el backend.)
 */

const TOKEN_KEY = 'finsight.token';
const AVATAR_KEY = 'finsight.avatarIcon';
const AVATAR_URL_KEY = 'finsight.avatarUrl';

export interface JwtClaims {
  sub: string;
  email?: string | null;
  exp?: number;
  iat?: number;
}

/**
 * Sesión mínima con la forma que consumen los componentes (compatible con lo
 * que antes devolvía Supabase: `.access_token`, `.user.id`, `.user.email`,
 * `.user.user_metadata`).
 */
export interface AppSession {
  access_token: string;
  user: {
    id: string;
    email: string | null;
    user_metadata: Record<string, unknown> & { avatar_icon: string | null };
  };
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Se suscribe a cambios de sesión (login/logout/avatar). Devuelve el unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

/** Decodifica el payload de un JWT (base64url) sin verificar la firma (eso lo hace el backend). */
function decodeJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );

    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** Devuelve el token si existe y no venció; si venció lo borra y devuelve null. */
export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  if (claims.exp && claims.exp * 1000 <= Date.now()) {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }

  return token;
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notify();
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notify();
}

export function getAvatar(): string | null {
  return localStorage.getItem(AVATAR_KEY);
}

export function setAvatar(icono: string | null): void {
  if (icono) {
    localStorage.setItem(AVATAR_KEY, icono);
  } else {
    localStorage.removeItem(AVATAR_KEY);
  }
  notify();
}

export function getAvatarUrl(): string | null {
  return localStorage.getItem(AVATAR_URL_KEY);
}

export function setAvatarUrl(url: string | null): void {
  if (url) {
    localStorage.setItem(AVATAR_URL_KEY, url);
  } else {
    localStorage.removeItem(AVATAR_URL_KEY);
  }
  notify();
}

/** Construye la sesión actual a partir del token guardado (o null si no hay). */
export function getSession(): AppSession | null {
  const token = getToken();
  if (!token) return null;

  const claims = decodeJwt(token);
  if (!claims || !claims.sub) return null;

  return {
    access_token: token,
    user: {
      id: claims.sub,
      email: claims.email ?? null,
      user_metadata: { avatar_icon: getAvatar(), avatar_url: getAvatarUrl() },
    },
  };
}
