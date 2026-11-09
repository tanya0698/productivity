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

const REMEMBER_KEY = "productivity-remember";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback; // storage blocked (private window, strict settings)
  }
};

/** "Keep me signed in". On by default; off means the session ends when the browser closes. */
export const getRememberMe = () => safe(() => localStorage.getItem(REMEMBER_KEY) !== "false", true);
export const setRememberMe = (remember: boolean) =>
  safe(() => localStorage.setItem(REMEMBER_KEY, String(remember)), undefined);

/**
 * Where the session lives: localStorage when remembered, sessionStorage
 * otherwise. Reads check both, so switching the setting never strands a session.
 */
const sessionStorageAdapter = {
  getItem: (k: string) => safe(() => localStorage.getItem(k) ?? sessionStorage.getItem(k), null),
  setItem: (k: string, v: string) =>
    safe(() => {
      const [keep, drop] = getRememberMe() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      keep.setItem(k, v);
      drop.removeItem(k);
    }, undefined),
  removeItem: (k: string) =>
    safe(() => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }, undefined),
};

/**
 * Opened from an email-confirmation link? Supabase puts `type=signup` in the
 * URL fragment and signs the user in from it. Confirming an email proves the
 * address; it shouldn't also be a sign-in, so the app ends that session and
 * asks for the password (AuthProvider). Read here, before createClient: the
 * client consumes and strips the fragment as it starts.
 */
export const landedFromEmailConfirmation: boolean = safe(
  () => new URLSearchParams(window.location.hash.slice(1)).get("type") === "signup",
  false,
);

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "productivity-auth",
          storage: sessionStorageAdapter,
        },
      })
    : null;
