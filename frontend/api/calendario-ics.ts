import { crearClienteAdmin } from './_lib/supabaseAdmin';
import { leerSupabaseEnv } from './_lib/env';

// Edge Function de Vercel: feed .ics en vivo para suscribir desde Google/Apple/
// Outlook Calendar (webcal://). Es pública a propósito (los calendarios no
// pueden mandar un Authorization header): la protege el token en la URL, no
// una sesión. Solo incluye metas activas y eventos manuales; los pagos/ingresos
// recurrentes proyectados quedan afuera del feed en vivo por ahora.
export const config = { runtime: 'edge' };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function aFechaICS(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function escaparTexto(valor: string): string {
  return valor.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Falta el token de suscripción.', { status: 400 });
  }

  const env = leerSupabaseEnv();
  if (!env) {
    return new Response('El servicio no está configurado.', { status: 500 });
  }

  const admin = crearClienteAdmin(env.supabaseUrl, env.serviceRoleKey);

  const { data: usuario } = await admin
    .from('usuarios')
    .select('id')
    .eq('ics_token', token)
    .maybeSingle();

  if (!usuario) {
    return new Response('Token inválido.', { status: 404 });
  }

  const [{ data: metas }, { data: eventos }] = await Promise.all([
    admin
      .from('metas')
      .select('id, nombre, fecha_objetivo')
      .eq('usuario_id', usuario.id)
      .eq('estado', 'ACTIVA')
      .not('fecha_objetivo', 'is', null),
    admin
      .from('eventos_calendario')
      .select('id, titulo, fecha_inicio')
      .eq('usuario_id', usuario.id),
  ]);

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinSightAI//Calendario Financiero//ES',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Calendario Financiero FinSightAI',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  (metas ?? []).forEach((m) => {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:meta-${m.id}@finsightai`,
      `DTSTART;VALUE=DATE:${aFechaICS(m.fecha_objetivo as string)}`,
      `SUMMARY:${escaparTexto(`Meta: ${m.nombre}`)}`,
      'END:VEVENT',
    );
  });

  (eventos ?? []).forEach((e) => {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:evento-${e.id}@finsightai`,
      `DTSTART;VALUE=DATE:${aFechaICS(e.fecha_inicio as string)}`,
      `SUMMARY:${escaparTexto(e.titulo as string)}`,
      'END:VEVENT',
    );
  });

  lineas.push('END:VCALENDAR');

  return new Response(lineas.join('\r\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendario-financiero.ics"',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}
