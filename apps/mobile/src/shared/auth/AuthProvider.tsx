import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { unregisterDevicePush } from "../reminders/devicePush";
import { clearAllNotifications } from "../reminders/notifications";

export interface AuthState {
  /** False while the stored session (and its two-factor level) is being read. */
  ready: boolean;
  session: Session | null;
  client: SupabaseClient;
  /** Signed in with a password but not yet with the second factor the account requires. */
  needsMfa: boolean;
  refreshAssurance: () => Promise<void>;
  /** The current access token, refreshed by supabase-js when it is close to expiring. */
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** The promise, or a rejection after `ms` milliseconds, whichever comes first. */
function withinMs<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timed out")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/** Holds the Supabase session, and whether a second factor is still owed. Same rules as the web app. */
export function AuthProvider({ client, children }: { client: SupabaseClient; children: React.ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [assuranceFor, setAssuranceFor] = useState<string | null>(null);

  const refreshAssurance = useCallback(async () => {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    setNeedsMfa(data?.nextLevel === "aal2" && data.currentLevel !== "aal2");
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      setNeedsMfa(false);
      setAssuranceFor(null);
      return;
    }
    let cancelled = false;
    void refreshAssurance().finally(() => {
      if (!cancelled) setAssuranceFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshAssurance]);

  const ready = sessionReady && (!userId || assuranceFor === userId);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      client,
      needsMfa,
      refreshAssurance,
      getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      signOut: async () => {
        // This account's reminders shouldn't keep alerting on the phone after it leaves:
        // stop the server pushing here (while still signed in), then clear what's scheduled.
        // Each step is capped: a slow network (or a sleeping server) must never leave
        // the person stuck, unable to sign out.
        await withinMs(unregisterDevicePush(async () => (await client.auth.getSession()).data.session?.access_token ?? null), 5000).catch(() => undefined);
        await withinMs(clearAllNotifications(), 3000).catch(() => undefined);
        // Signing out everywhere needs Supabase. If it can't be reached, sign out on this
        // phone anyway; the server-side session simply expires.
        const global = await withinMs(client.auth.signOut(), 8000).catch((e: unknown) => ({ error: e }));
        if (global.error) await client.auth.signOut({ scope: "local" });
      },
    }),
    [ready, session, client, needsMfa, refreshAssurance],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
