import { useInitialSyncDone } from "@productivity/sync-engine/react";

/**
 * True once local data has loaded and an empty result can be trusted: the
 * phone has synced before (or can't right now). Until then, show a skeleton,
 * so an empty screen never pretends there's nothing. Same rule as the web.
 *
 *   const ready = useDataReady(loading);
 */
export function useDataReady(...loading: boolean[]): boolean {
  const synced = useInitialSyncDone();
  return synced && !loading.some(Boolean);
}
