import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ProjectPage from "./pages/ProjectPage";

/** The module's own routes, mounted under its basePath by the shell. */
export default function ProjectsFeature() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
      <Route path=":projectId" element={<ProjectPage />} />
    </Routes>
  );
}
