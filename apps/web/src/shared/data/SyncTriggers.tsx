import { useEffect } from "react";
import { useSyncRuntime } from "@productivity/sync-engine/react";

/** Syncs straight away when the network returns or the tab comes back into view. */
export function SyncTriggers() {
  const runtime = useSyncRuntime();

  useEffect(() => {
    const syncNow = () => void runtime.syncNow();
    const onVisible = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    window.addEventListener("online", syncNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", syncNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runtime]);

  return null;
}
