import { Suspense, lazy } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/Skeletons";
import { getLiveModules } from "@/shared/modules/registry";
import { AppShell } from "@/components/layout/AppShell";
import TodayPage from "@/pages/home/TodayPage";
import NotFoundPage from "@/pages/NotFoundPage";

/** One lazy route per live module, generated from the registry. */
const moduleRoutes = getLiveModules().map((m) => ({ path: `${m.basePath}/*`, key: m.key, Component: lazy(m.load) }));
const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const SyncPage = lazy(() => import("@/pages/sync/SyncPage"));

/** The first path segment: moving within a page (?query, sub-routes) doesn't replay the entrance. */
const section = (pathname: string) => pathname.split("/")[1] ?? "";

export function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        {/* Keyed by section, so each page fades and rises in when you arrive (global.css .pp-page). */}
        <div className="pp-page" key={section(pathname)}>
          <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/sync" element={<SyncPage />} />
          {moduleRoutes.map(({ path, key, Component }) => (
            <Route key={key} path={path} element={<Component />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </Suspense>
    </AppShell>
  );
}
