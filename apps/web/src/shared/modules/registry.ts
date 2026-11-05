import { discovered } from "@/features/registry";
import type { ModuleManifest } from "./types";

/**
 * Lookups over the discovered modules. Lives in `@/shared` and reads
 * `src/features/registry.ts`, so shared code never imports a specific feature.
 */

const byOrder = (a: ModuleManifest, b: ModuleManifest) =>
  (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name);

/**
 * Problems that would otherwise fail quietly: a key that doesn't match its
 * folder (mobile and API derive their names from the key), or two modules on
 * one route. Exported for the test suite; logged in development.
 */
export function registryProblems(list = discovered): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  const paths = new Set<string>();
  for (const { folder, manifest: m } of list) {
    if (m.key !== folder) problems.push(`Module in folder "${folder}" has key "${m.key}"; they must match.`);
    if (!m.basePath.startsWith("/")) problems.push(`Module "${m.key}" basePath must start with "/".`);
    if (keys.has(m.key)) problems.push(`Duplicate module key "${m.key}".`);
    if (paths.has(m.basePath)) problems.push(`Duplicate basePath "${m.basePath}".`);
    keys.add(m.key);
    paths.add(m.basePath);
  }
  return problems;
}

if (import.meta.env.DEV) {
  const problems = registryProblems();
  if (problems.length) console.error(`[modules]\n  ${problems.join("\n  ")}`);
}

const modules: ModuleManifest[] = discovered.map((d) => d.manifest).sort(byOrder);

export const getModules = (): ModuleManifest[] => modules;
export const getLiveModules = (): ModuleManifest[] => modules.filter((m) => m.status !== "soon");
export const getModule = (key: string): ModuleManifest | undefined => modules.find((m) => m.key === key);

/** The module owning a path; "/tasks/today" → tasks, but "/tasksheet" → none. */
export function findModuleByPath(pathname: string): ModuleManifest | undefined {
  return modules
    .filter((m) => pathname === m.basePath || pathname.startsWith(`${m.basePath}/`))
    .sort((a, b) => b.basePath.length - a.basePath.length)[0];
}
