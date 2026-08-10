import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { enviarCorreo } from './_lib/resend';
import { buildEmailHtml } from '../src/emails/shell';

// Job diario disparado por Vercel Cron (ver `crons` en vercel.json). Corre en
// runtime Node.js (no edge) porque `web-push` necesita el módulo `crypto` de
// Node para firmar VAPID y cifrar el payload — eso no está disponible en Edge.
// Busca metas y eventos de calendario que vencen en DIAS_ANTICIPACION días y
// le manda un correo (Resend) y un push (si el usuario está suscrito) a cada
// usuario con un resumen de lo que se le viene.
const DIAS_ANTICIPACION = 3;

interface ItemRecordatorio {
  titulo: string;
  fecha: string;
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ mensaje: 'No autorizado.' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const remitente = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
  const logoUrl = process.env.EMAIL_LOGO_URL ?? 'https://i.postimg.cc/zvCfsXbw/logo-white.png';
  const siteUrl = process.env.SITE_URL ?? 'https://finsightai.vercel.app';
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:soporte@finsightai.com';

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ mensaje: 'Faltan variables de entorno de Supabase.' });
    return;
  }

  const pushHabilitado = Boolean(vapidPublicKey && vapidPrivateKey);
  if (pushHabilitado) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey as string, vapidPrivateKey as string);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const objetivo = new Date();
  objetivo.setDate(objetivo.getDate() + DIAS_ANTICIPACION);
  const fechaObjetivo = objetivo.toISOString().split('T')[0];

  const [{ data: metas, error: errorMetas }, { data: eventos, error: errorEventos }] = await Promise.all([
    admin
      .from('metas')
      .select('id, nombre, fecha_objetivo, usuario_id, usuarios(email, nombre)')
      .eq('estado', 'ACTIVA')
      .eq('fecha_objetivo', fechaObjetivo),
    admin
      .from('eventos_calendario')
      .select('id, titulo, fecha_inicio, usuario_id, usuarios(email, nombre)')
      .eq('fecha_inicio', fechaObjetivo),
  ]);

  if (errorMetas || errorEventos) {
    console.error('[enviar-recordatorios] Error consultando Supabase:', errorMetas?.message, errorEventos?.message);
    res.status(500).json({ mensaje: 'No se pudieron consultar los eventos próximos.' });
    return;
  }

  const porUsuario = new Map<string, { email: string; nombre: string; items: ItemRecordatorio[] }>();

  (metas ?? []).forEach((m: any) => {
    if (!m.usuarios?.email) return;
    const entry = porUsuario.get(m.usuario_id) ?? { email: m.usuarios.email, nombre: m.usuarios.nombre ?? '', items: [] };
    entry.items.push({ titulo: `Meta: ${m.nombre}`, fecha: m.fecha_objetivo });
    porUsuario.set(m.usuario_id, entry);
  });

  (eventos ?? []).forEach((e: any) => {
    if (!e.usuarios?.email) return;
    const entry = porUsuario.get(e.usuario_id) ?? { email: e.usuarios.email, nombre: e.usuarios.nombre ?? '', items: [] };
    entry.items.push({ titulo: e.titulo, fecha: e.fecha_inicio });
    porUsuario.set(e.usuario_id, entry);
  });

  let correosEnviados = 0;
  let pushEnviados = 0;

  for (const [usuarioId, info] of porUsuario) {
    if (resendApiKey) {
      const listaHtml = info.items
        .map((item) => `<li>${item.titulo} — ${formatearFecha(item.fecha)}</li>`)
        .join('');
      const html = buildEmailHtml({
        logoUrl,
        preheader: `Tienes ${info.items.length} evento(s) financiero(s) en ${DIAS_ANTICIPACION} días.`,
        title: 'Recordatorio financiero',
        greetingName: info.nombre || info.email,
        bodyParagraphs: [
          `En ${DIAS_ANTICIPACION} días tienes lo siguiente en tu calendario financiero:`,
          `<ul style="margin:0 0 16px;padding-left:20px;">${listaHtml}</ul>`,
        ],
        ctaText: 'Ver mi calendario',
        ctaUrl: `${siteUrl}/calendario-financiero`,
        footerNote: 'Puedes desactivar estos recordatorios desde el calendario financiero.',
      });

      const envio = await enviarCorreo({
        apiKey: resendApiKey,
        from: remitente,
        to: info.email,
        subject: `Recordatorio: ${info.items.length} evento(s) financiero(s) próximos`,
        html,
      });
      if (envio.ok) correosEnviados += 1;
      else console.error('[enviar-recordatorios] Resend rechazó el envío para', info.email, envio.detalle);
    }

    if (pushHabilitado) {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('usuario_id', usuarioId);

      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: 'Recordatorio financiero',
              body: `Tienes ${info.items.length} evento(s) en ${DIAS_ANTICIPACION} días.`,
              url: '/calendario-financiero',
            }),
          );
          pushEnviados += 1;
        } catch (error: any) {
          if (error?.statusCode === 410 || error?.statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('[enviar-recordatorios] Error enviando push:', error?.message ?? error);
          }
        }
      }
    }
  }

  res.status(200).json({ usuarios: porUsuario.size, correosEnviados, pushEnviados });
}
