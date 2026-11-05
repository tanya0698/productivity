import { useEffect } from "react";
import { AppState } from "react-native";
import { useSyncRuntime } from "@productivity/sync-engine/react";

/** Syncs straight away when the app comes back to the foreground. */
export function SyncTriggers() {
  const runtime = useSyncRuntime();

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void runtime.syncNow();
    });
    return () => sub.remove();
  }, [runtime]);

  return null;
}
