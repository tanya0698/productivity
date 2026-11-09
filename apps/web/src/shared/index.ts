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
export { useLocalRecords, useSyncRuntime, useSyncStatus } from "@productivity/sync-engine/react";
export { useTheme } from "@/contexts/ThemeProvider";
export { useProjects, type Project } from "./projects/useProjects";
export { ProjectSelect, ProjectTag } from "./projects/ProjectSelect";
export { TaskRow, DueBadge, PriorityLabel, type Task } from "./tasks/TaskRow";
export { TaskEditor } from "./tasks/TaskEditor";
export { QuickAdd } from "./tasks/QuickAdd";
export { formatDue } from "./tasks/formatDue";
export { priorityOptions } from "./tasks/priorityOptions";
