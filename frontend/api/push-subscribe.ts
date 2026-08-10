import { crearClienteAdmin } from './_lib/supabaseAdmin';
import { resolverUsuarioIdDesdeToken } from './_lib/auth';
import { jsonResponse, leerSupabaseEnv } from './_lib/env';

// Edge Function de Vercel: guarda la suscripción push del navegador del
// usuario logueado, para poder mandarle recordatorios más adelante.
export const config = { runtime: 'edge' };

interface SubscribeBody {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ mensaje: 'Método no permitido.' }, 405);
  }

  const env = leerSupabaseEnv();
  if (!env) {
    console.error('[push-subscribe] Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
    return jsonResponse({ mensaje: 'El servicio no está configurado.' }, 500);
  }

  const admin = crearClienteAdmin(env.supabaseUrl, env.serviceRoleKey);
  const usuarioId = await resolverUsuarioIdDesdeToken(admin, request);
  if (!usuarioId) {
    return jsonResponse({ mensaje: 'No autorizado.' }, 401);
  }

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ mensaje: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';

  if (!endpoint || !p256dh || !auth) {
    return jsonResponse({ mensaje: 'La suscripción push es inválida.' }, 400);
  }

  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ usuario_id: usuarioId, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push-subscribe] Error al guardar la suscripción:', error.message);
    return jsonResponse({ mensaje: 'No se pudo guardar la suscripción.' }, 500);
  }

  return jsonResponse({ ok: true }, 200);
}
