import { Route, Routes } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";

/** The module's own routes, mounted under its basePath by the shell. */
export default function CalendarFeature() {
  return (
    <Routes>
      <Route index element={<CalendarPage />} />
    </Routes>
  );
}
