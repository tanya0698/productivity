import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import GoalPage from "./pages/GoalPage";

/** The module's own routes, mounted under its basePath by the shell. */
export default function GoalsFeature() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path=":goalId" element={<GoalPage />} />
    </Routes>
  );
}
