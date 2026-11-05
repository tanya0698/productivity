import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AppRoutes } from "@/routes";

/**
 * No sign-in yet: auth is ADR 0003 (Supabase Auth is the leading option).
 * Until then the API runs every request as DEV_USER_ID in development.
 */
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
