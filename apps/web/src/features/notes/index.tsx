import { Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";

/** The module's own routes, mounted under its basePath by the shell. */
export default function NotesFeature() {
  return (
    <Routes>
      <Route index element={<HomePage />} />
    </Routes>
  );
}