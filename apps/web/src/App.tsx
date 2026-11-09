import { useCallback, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Flex, Result, Spin, Typography } from "antd";
import { SyncProvider } from "@productivity/sync-engine/react";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AppRoutes } from "@/routes";
import { AuthProvider, useAuth } from "@/shared/auth/AuthProvider";
import { landedFromEmailConfirmation, supabase } from "@/shared/auth/supabase";
import { openRuntime } from "@/shared/data/openRuntime";
import { SyncTriggers } from "@/shared/data/SyncTriggers";
import SignInPage from "@/pages/auth/SignInPage";
import MfaChallengePage from "@/pages/auth/MfaChallengePage";
import SetNewPasswordPage from "@/pages/auth/SetNewPasswordPage";

/**
 * Signed out → sign-in. Back from a reset link → choose a new password. Owes a
 * second factor → the code screen. Only then that account's data and sync.
 */
function SignedIn({ children }: { children: ReactNode }) {
  const { ready, session, needsMfa, recovering, getAccessToken } = useAuth();
  const userId = session?.user.id;
  const open = useCallback(() => openRuntime(userId!, getAccessToken), [userId, getAccessToken]);

  if (!ready) return <Spin fullscreen />;
  if (!userId) return <SignInPage />;
  if (recovering) return <SetNewPasswordPage />;
  if (needsMfa) return <MfaChallengePage />;
  return (
    // key: switching accounts tears down one account's runtime before opening the next.
    <SyncProvider
      key={userId}
      open={open}
      loading={<Spin fullscreen />}
      failed={() => (
        <Result
          status="error"
          title="This browser can't store your data"
          subTitle="The app keeps your notes and tasks in this browser's storage. Private windows and some browser settings block it. Try a normal window."
        />
      )}
    >
      <SyncTriggers />
      {children}
    </SyncProvider>
  );
}

function NotConfigured() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: "100vh", padding: 16 }}>
      <Result
        status="warning"
        title="Sign-in isn't set up yet"
        subTitle={
          <Typography.Text type="secondary">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
            <code>apps/web/.env.local</code> (see <code>.env.example</code>), then restart <code>npm run dev:web</code>.
          </Typography.Text>
        }
      />
    </Flex>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {supabase ? (
        <AuthProvider client={supabase} fromEmailConfirmation={landedFromEmailConfirmation}>
          <SignedIn>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SignedIn>
        </AuthProvider>
      ) : (
        <NotConfigured />
      )}
    </ThemeProvider>
  );
}
