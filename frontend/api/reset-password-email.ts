import { createClient } from '@supabase/supabase-js';
import { resetPasswordEmail } from '../src/emails/templates';
import { enviarCorreo } from './_lib/resend';
import { jsonResponse, leerEmailEnv } from './_lib/env';

// Edge Function de Vercel: corre en un servidor, nunca en el navegador.
// Las claves (RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY) viven solo acá,
// como variables de entorno del proyecto en Vercel — nunca en el bundle del frontend.
export const config = { runtime: 'edge' };

// Mensaje idéntico ante éxito o "el email no existe" para no filtrar
// qué correos están registrados (mismo comportamiento que el flujo nativo de Supabase).
const MENSAJE_GENERICO =
  'Si el correo existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña.';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ mensaje: 'Método no permitido.' }, 405);
  }

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined;
  } catch {
    return jsonResponse({ mensaje: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  if (!email) {
    return jsonResponse({ mensaje: 'El correo electrónico es obligatorio.' }, 400);
  }

  const env = leerEmailEnv(request.url);
  if (!env) {
    console.error('[reset-password-email] Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o RESEND_API_KEY).');
    return jsonResponse({ mensaje: 'El servicio de correo no está configurado.' }, 500);
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${env.siteUrl}/reset-password` },
  });

  if (error || !data?.properties?.action_link) {
    // No devolvemos el error real: evita confirmar si el email existe o no.
    console.warn('[reset-password-email] No se pudo generar el link de recuperación:', error?.message);
    return jsonResponse({ mensaje: MENSAJE_GENERICO }, 200);
  }

  const html = resetPasswordEmail({
    logoUrl: env.logoUrl,
    greetingName: email,
    ctaUrl: data.properties.action_link,
  });

  const envio = await enviarCorreo({
    apiKey: env.resendApiKey,
    from: env.remitente,
    to: email,
    subject: 'Restablece tu contraseña de FinSightAI',
    html,
  });

  if (!envio.ok) {
    console.error('[reset-password-email] Resend rechazó el envío:', envio.detalle);
    return jsonResponse({ mensaje: 'No se pudo enviar el correo. Intenta nuevamente más tarde.' }, 502);
  }

  return jsonResponse({ mensaje: MENSAJE_GENERICO }, 200);
}
