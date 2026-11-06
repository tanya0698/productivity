import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase, for sign-in only (ADR 0003). Data never goes through this client:
 * synced records travel through the API's /api/sync (ADR 0002), which is why
 * nothing here queries tables.
 *
 * Both values are public by design (they ship in every browser), and come from
 * apps/web/.env.local. Missing values leave `supabase` null, and the app shows
 * how to set them instead of failing obscurely.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "productivity-auth" },
      })
    : null;
