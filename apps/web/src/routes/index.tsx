import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Skeleton } from "antd";
import { getLiveModules } from "@/shared/modules/registry";
import { AppShell } from "@/components/layout/AppShell";
import TodayPage from "@/pages/home/TodayPage";
import NotFoundPage from "@/pages/NotFoundPage";

/** One lazy route per live module, generated from the registry. */
const moduleRoutes = getLiveModules().map((m) => ({ path: `${m.basePath}/*`, key: m.key, Component: lazy(m.load) }));

export function AppRoutes() {
  return (
    <AppShell>
      <Suspense fallback={<Skeleton active />}>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          {moduleRoutes.map(({ path, key, Component }) => (
            <Route key={key} path={path} element={<Component />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
