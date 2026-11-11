import type { ComponentType } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { EntityType } from "@productivity/contracts";

/** A panel a module puts on the Today screen, like the web app's widgets. */
export interface MobileWidget {
  id: string;
  title: string;
  /** Lower first. */
  order?: number;
  component: ComponentType;
}

/**
 * What a mobile module declares about itself — the Android counterpart of the
 * web manifest in apps/web/src/shared/modules/types.ts. The `key` must equal
 * the folder name and the web module's key.
 */
export interface MobileModuleManifest {
  key: string;
  name: string;
  /** One line under the name on the More screen. */
  description?: string;
  /** Ionicons name; the outline variant is used when the tab is not focused. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Shown as a bottom tab when set; lower first. Modules without one go under More. */
  tabOrder?: number;
  /** Synced record types this module owns. */
  entities?: EntityType[];
  /** The module's root screen. */
  screen: ComponentType;
  /** Panels on the Today screen. */
  widgets?: MobileWidget[];
  status?: "live" | "soon";
}

export const defineMobileModule = (m: MobileModuleManifest) => m;
