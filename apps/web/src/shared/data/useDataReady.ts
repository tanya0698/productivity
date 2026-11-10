import { useInitialSyncDone } from "@productivity/sync-engine/react";

/**
 * True once local data has loaded and an empty result can be trusted: the
 * device has synced before (or can't right now). Until then, show a skeleton.
 *
 *   const ready = useDataReady(loading);
 *   if (!ready) return <RowsSkeleton />;
 */
export function useDataReady(...loading: boolean[]): boolean {
  const synced = useInitialSyncDone();
  return synced && !loading.some(Boolean);
}
