import { crearClienteAdmin } from './_lib/supabaseAdmin';
import { resolverUsuarioIdDesdeToken } from './_lib/auth';
import { jsonResponse, leerSupabaseEnv } from './_lib/env';

// Edge Function de Vercel: borra la suscripción push del usuario logueado
// (por ejemplo cuando desactiva los recordatorios desde el calendario).
export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ mensaje: 'Método no permitido.' }, 405);
  }

  const env = leerSupabaseEnv();
  if (!env) {
    console.error('[push-unsubscribe] Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
    return jsonResponse({ mensaje: 'El servicio no está configurado.' }, 500);
  }

  const admin = crearClienteAdmin(env.supabaseUrl, env.serviceRoleKey);
  const usuarioId = await resolverUsuarioIdDesdeToken(admin, request);
  if (!usuarioId) {
    return jsonResponse({ mensaje: 'No autorizado.' }, 401);
  }

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ mensaje: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) {
    return jsonResponse({ mensaje: 'Falta el endpoint de la suscripción.' }, 400);
  }

  await admin.from('push_subscriptions').delete().eq('usuario_id', usuarioId).eq('endpoint', endpoint);

  return jsonResponse({ ok: true }, 200);
}
