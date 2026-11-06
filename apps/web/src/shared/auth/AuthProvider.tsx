import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export interface AuthState {
  /** False while the stored session (and its two-factor level) is being read. */
  ready: boolean;
  session: Session | null;
  client: SupabaseClient;
  /**
   * Signed in with a password but not yet with the second factor the account
   * requires. The app shows the code screen instead of any data.
   */
  needsMfa: boolean;
  /** Arrived from a password-reset link: the app asks for a new password first. */
  recovering: boolean;
  /** Re-read the two-factor level, after verifying a code or changing factors. */
  refreshAssurance: () => Promise<void>;
  finishRecovery: () => void;
  /** The current access token, refreshed by supabase-js when it is close to expiring. */
  getAccessToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Holds the Supabase session and keeps it current across refreshes, sign-ins
 * and sign-outs (in any tab), plus the two things that must happen before the
 * app opens: a second factor if the account has one, and a new password after
 * a reset link.
 */
export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  // Tagged with the user it was read for, so a stale answer never applies to someone else.
  const [assurance, setAssurance] = useState<{ userId: string; needsMfa: boolean } | null>(null);
  const [recovering, setRecovering] = useState(false);

  const refreshAssurance = useCallback(async () => {
    const [{ data: level }, { data: current }] = await Promise.all([
      client.auth.mfa.getAuthenticatorAssuranceLevel(),
      client.auth.getSession(),
    ]);
    const forUser = current.session?.user.id;
    if (!forUser) return;
    setAssurance({ userId: forUser, needsMfa: level?.nextLevel === "aal2" && level.currentLevel !== "aal2" });
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      setSession(next);
      setSessionReady(true);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [client]);

  // Whenever the signed-in user changes, find out whether they still owe a second factor.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void client.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!cancelled) setAssurance({ userId, needsMfa: data?.nextLevel === "aal2" && data.currentLevel !== "aal2" });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  const known = !!userId && assurance?.userId === userId;
  const needsMfa = known && assurance.needsMfa;
  const ready = sessionReady && (!userId || known);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      session,
      client,
      needsMfa,
      recovering,
      refreshAssurance,
      finishRecovery: () => setRecovering(false),
      getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      signOut: async () => {
        await client.auth.signOut();
      },
    }),
    [ready, session, client, needsMfa, recovering, refreshAssurance],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
