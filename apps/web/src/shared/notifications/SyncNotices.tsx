import { useEffect, useRef } from "react";
import { useSyncStatus } from "@productivity/sync-engine/react";
import { useNotifications } from "./store";

const text = {
  conflict: { title: "Something was edited on two devices", body: "Choose which version to keep." },
  auth: { title: "Sign in again to keep syncing", body: "Your changes are safe on this device meanwhile." },
  error: { title: "Sync stopped", body: "Your changes are safe on this device. Open sync for details." },
} as const;

/**
 * Adds a notification when sync starts needing attention (a conflict, an
 * expired session, an error), once per occurrence rather than on every retry.
 * Renders nothing.
 */
export function SyncNotices() {
  const status = useSyncStatus();
  const { store } = useNotifications();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const reason = status.state === "needs_attention" ? status.reason : null;
    if (reason && reason !== last.current) {
      // One entry per distinct problem per hour, so a flapping connection doesn't flood the list.
      const hour = new Date().toISOString().slice(0, 13);
      store.add({ id: `sync-${reason}-${hour}`, kind: "sync", ...text[reason], href: "/sync" });
    }
    last.current = reason;
  }, [status, store]);

  return null;
}
