import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase, for sign-in only (ADR 0003): data goes through the API's /api/sync
 * (ADR 0002), so nothing here queries tables.
 *
 * The session is kept in the phone's secure storage (plan §10). SecureStore
 * items are limited to about 2 KB and a Supabase session is larger, so values
 * are split into numbered chunks.
 */
const CHUNK = 1800;

const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}_n`);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}_${i}`);
      if (part === null) return null; // half-written: treat as signed out rather than a corrupt session
      parts.push(part);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    await chunkedSecureStore.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}_n`, String(count));
  },
  async removeItem(key: string): Promise<void> {
    const count = Number((await SecureStore.getItemAsync(`${key}_n`)) ?? 0);
    await SecureStore.deleteItemAsync(`${key}_n`);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}_${i}`);
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: chunkedSecureStore,
          storageKey: "productivity-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

// Refresh tokens only while the app is in the foreground, as Supabase recommends for React Native.
if (supabase) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
