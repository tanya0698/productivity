import { useSyncExternalStore } from "react";

/**
 * Whether the browser believes it is online. Drives the sync pill until the
 * sync engine reports real status (Phase 1).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
