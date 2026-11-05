/**
 * Module discovery. Every `src/features/<key>/config/module.tsx` is picked up
 * here, so creating the folder registers the module — there is no list to edit.
 *
 * Eager: a manifest is a few strings and an icon, needed on first paint for
 * the sidebar and router. Pages and widgets stay behind `load()`.
 */
import type { ModuleManifest } from "@/shared/modules/types";

const found = import.meta.glob<{ default: ModuleManifest }>("./*/config/module.tsx", { eager: true });

export const discovered: Array<{ folder: string; manifest: ModuleManifest }> = Object.entries(found).map(
  ([path, mod]) => ({ folder: path.split("/")[1] ?? "", manifest: mod.default }),
);
