import { BrowserRouter } from "react-router-dom";
import { Result, Spin } from "antd";
import { SyncProvider } from "@productivity/sync-engine/react";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AppRoutes } from "@/routes";
import { openRuntime } from "@/shared/data/openRuntime";
import { SyncTriggers } from "@/shared/data/SyncTriggers";

/**
 * No sign-in yet: auth is ADR 0003 (Supabase Auth is the leading option).
 * Until then the API runs every request as DEV_USER_ID in development.
 */
export default function App() {
  return (
    <ThemeProvider>
      <SyncProvider
        open={openRuntime}
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
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SyncProvider>
    </ThemeProvider>
  );
}
