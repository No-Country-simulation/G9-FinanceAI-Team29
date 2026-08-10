import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cliente con la service role key: bypassa RLS, solo debe usarse en funciones
// serverless (nunca en el navegador). Un único lugar para no repetir la config.
export function crearClienteAdmin(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
