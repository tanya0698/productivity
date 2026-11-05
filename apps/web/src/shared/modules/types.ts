import type { ComponentType, ReactNode } from "react";
import type { EntityType } from "@productivity/contracts";

/**
 * What a module declares about itself, in `src/features/<key>/config/module.tsx`.
 * Creating that file registers the module (see src/features/registry.ts): the
 * shell derives its sidebar entry, its route and its Today widgets from here.
 */
export interface ModuleManifest {
  /** Lowercase, one word, equal to the folder name — and to the mobile and API module keys. */
  key: string;
  name: string;
  description: string;
  icon: ReactNode;
  /** Route prefix, e.g. "/tasks". Mounted with a `/*` wildcard. */
  basePath: string;
  /** Sidebar order; lower first. */
  order?: number;
  /** Sidebar section heading, e.g. "Plan". */
  section?: string;
  /** Synced record types this module owns. */
  entities?: EntityType[];
  /** Panels this module contributes to the Today page. */
  widgets?: ModuleWidget[];
  /** The module's root component, lazy-loaded when its route is first opened. */
  load: () => Promise<{ default: ComponentType }>;
  /** "soon" lists it in the sidebar, disabled, with no route. */
  status?: "live" | "soon";
}

export interface ModuleWidget {
  id: string;
  title: string;
  /** Columns out of 24 on wide screens (antd grid). */
  span?: number;
  load: () => Promise<{ default: ComponentType }>;
}

/** Identity function that type-checks a manifest. */
export const defineModule = (m: ModuleManifest): ModuleManifest => m;
