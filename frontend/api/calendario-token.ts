import { crearClienteAdmin } from './_lib/supabaseAdmin';
import { resolverUsuarioIdDesdeToken } from './_lib/auth';
import { jsonResponse, leerSupabaseEnv } from './_lib/env';

// Edge Function de Vercel: le da al usuario logueado el token secreto que
// identifica su feed de calendario (.ics) sin exponer su usuarioId real.
// Lo genera la primera vez que se pide.
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ mensaje: 'Método no permitido.' }, 405);
  }

  const env = leerSupabaseEnv();
  if (!env) {
    console.error('[calendario-token] Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
    return jsonResponse({ mensaje: 'El servicio no está configurado.' }, 500);
  }

  const admin = crearClienteAdmin(env.supabaseUrl, env.serviceRoleKey);
  const usuarioId = await resolverUsuarioIdDesdeToken(admin, request);
  if (!usuarioId) {
    return jsonResponse({ mensaje: 'No autorizado.' }, 401);
  }

  const { data: usuario, error } = await admin
    .from('usuarios')
    .select('ics_token')
    .eq('id', usuarioId)
    .maybeSingle();

  if (error || !usuario) {
    return jsonResponse({ mensaje: 'Usuario no encontrado.' }, 404);
  }

  let token = usuario.ics_token as string | null;
  if (!token) {
    token = crypto.randomUUID();
    const { error: updateError } = await admin
      .from('usuarios')
      .update({ ics_token: token })
      .eq('id', usuarioId);

    if (updateError) {
      console.error('[calendario-token] No se pudo generar el token:', updateError.message);
      return jsonResponse({ mensaje: 'No se pudo generar el enlace del calendario.' }, 500);
    }
  }

  return jsonResponse({ token }, 200);
}
