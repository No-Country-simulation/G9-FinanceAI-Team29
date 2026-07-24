import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // No rompemos la app, pero avisamos: sin estas variables el login no funciona.
  console.warn(
    '[FinanceAI] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el .env del frontend.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '');
