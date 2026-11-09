import { Route, Routes } from "react-router-dom";
import ReportsPage from "./pages/ReportsPage";

/** The module's own routes, mounted under its basePath by the shell. */
export default function ReportsFeature() {
  return (
    <Routes>
      <Route index element={<ReportsPage />} />
    </Routes>
  );
}
