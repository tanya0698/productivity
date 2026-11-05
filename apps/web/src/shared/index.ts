/**
 * The module SDK — the one import a feature module needs:
 *
 *   import { defineModule, ModulePage, moduleApi } from "@/shared";
 *
 * Modules import from here, never from another module's folder.
 */
export { defineModule } from "./modules/types";
export type { ModuleManifest, ModuleWidget } from "./modules/types";
export { getModules, getLiveModules, getModule, findModuleByPath } from "./modules/registry";
export { ModulePage } from "./page/ModulePage";
export { apiRequest, moduleApi, ApiRequestError } from "./api/client";
export { useOnlineStatus } from "@/hooks/useOnlineStatus";
export { useTheme } from "@/contexts/ThemeProvider";
