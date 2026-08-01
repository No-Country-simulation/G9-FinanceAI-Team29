import { createClient } from '@supabase/supabase-js';
import { confirmSignupEmail } from '../src/emails/templates';
import { enviarCorreo } from './_lib/resend';
import { jsonResponse, leerEmailEnv } from './_lib/env';

// Edge Function de Vercel: corre en un servidor, nunca en el navegador.
// Reemplaza el supabase.auth.signUp() que hacía el frontend directo: acá
// creamos el usuario vía Admin API y mandamos nosotros el correo de
// confirmación con Resend, con nuestra plantilla y el nombre real.
export const config = { runtime: 'edge' };

interface RegistroBody {
  nombre?: unknown;
  apellido?: unknown;
  email?: unknown;
  password?: unknown;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ mensaje: 'Método no permitido.' }, 405);
  }

  let body: RegistroBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ mensaje: 'Cuerpo de la solicitud inválido.' }, 400);
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const apellido = typeof body.apellido === 'string' ? body.apellido.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!nombre || !apellido || !email || !password) {
    return jsonResponse({ mensaje: 'Nombre, apellido, correo y contraseña son obligatorios.' }, 400);
  }

  const env = leerEmailEnv(request.url);
  if (!env) {
    console.error('[register] Faltan variables de entorno (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o RESEND_API_KEY).');
    return jsonResponse({ mensaje: 'El servicio de registro no está configurado.' }, 500);
  }

  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const displayName = `${nombre} ${apellido}`.trim();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      data: { nombre, apellido, display_name: displayName },
      redirectTo: `${env.siteUrl}/signin`,
    },
  });

  if (error) {
    const mensajeError = error.message ?? '';
    console.error('[register] Error al crear usuario en Supabase:', mensajeError);

    if (/already.*registered|already exists|email_exists/i.test(mensajeError)) {
      return jsonResponse({ mensaje: 'Ese correo ya está registrado. Intenta iniciar sesión.' }, 409);
    }
    if (/password/i.test(mensajeError)) {
      return jsonResponse({ mensaje: 'La contraseña es muy corta. Debe tener al menos 6 caracteres.' }, 400);
    }

    return jsonResponse({ mensaje: 'No se pudo crear la cuenta. Intenta nuevamente.' }, 400);
  }

  // Resguardo: si el usuario ya existía y estaba confirmado, no seguimos —
  // evita que este endpoint sirva para "re-registrar" y así pisarle la
  // contraseña a una cuenta ajena.
  if (!data?.user?.id || data.user.email_confirmed_at) {
    console.warn('[register] generateLink devolvió un usuario ya confirmado; se aborta por seguridad.', data?.user?.id);
    return jsonResponse({ mensaje: 'Ese correo ya está registrado. Intenta iniciar sesión.' }, 409);
  }

  if (!data.properties?.action_link) {
    console.error('[register] Supabase no devolvió el link de confirmación.');
    return jsonResponse({ mensaje: 'No se pudo generar el enlace de confirmación.' }, 502);
  }

  const html = confirmSignupEmail({
    logoUrl: env.logoUrl,
    greetingName: displayName,
    ctaUrl: data.properties.action_link,
  });

  const envio = await enviarCorreo({
    apiKey: env.resendApiKey,
    from: env.remitente,
    to: email,
    subject: 'Confirma tu cuenta en FinSightAI',
    html,
  });

  if (!envio.ok) {
    console.error('[register] Resend rechazó el envío:', envio.detalle);
    return jsonResponse({ mensaje: 'La cuenta se creó, pero no se pudo enviar el correo de confirmación. Contacta a soporte.' }, 502);
  }

  return jsonResponse({ authUserId: data.user.id }, 201);
}
