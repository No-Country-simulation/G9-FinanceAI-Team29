import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resuelve el usuarioId interno (ej. "USR0001") a partir del JWT de Supabase
 * que manda el frontend en el header Authorization. Usa la service role key
 * para validar el token y para buscar en `usuarios` por auth_user_id, igual
 * que hace el backend Java en UsuarioController (`/por-auth/{authUserId}`).
 */
export async function resolverUsuarioIdDesdeToken(
  admin: SupabaseClient,
  request: Request,
): Promise<string | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) return null;

  const { data: usuario } = await admin
    .from('usuarios')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();

  return usuario?.id ?? null;
}
