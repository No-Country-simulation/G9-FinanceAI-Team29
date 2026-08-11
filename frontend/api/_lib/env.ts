export interface SupabaseEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
}

/** Igual que leerEmailEnv pero sin exigir RESEND_API_KEY, para endpoints que
 * solo necesitan hablar con Supabase (token del calendario, push, etc). */
export function leerSupabaseEnv(): SupabaseEnv | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return { supabaseUrl, serviceRoleKey };
}

export interface EmailEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  resendApiKey: string;
  remitente: string;
  siteUrl: string;
  logoUrl: string;
}

export function leerEmailEnv(requestUrl: string): EmailEnv | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return null;
  }

  const siteUrl = process.env.SITE_URL ?? new URL(requestUrl).origin;

  return {
    supabaseUrl,
    serviceRoleKey,
    resendApiKey,
    remitente: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
    siteUrl,
    logoUrl: process.env.EMAIL_LOGO_URL ?? 'https://i.postimg.cc/zvCfsXbw/logo-white.png',
  };
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
