import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { useActiveReminders, useNow } from "./active";
import { handleResponse, reconcile } from "./notifications";

/**
 * Keeps the phone's notifications in step with the signed-in account's
 * reminders, and acts on taps and buttons (including the one that opened the
 * app). Renders nothing; mounted once inside the sync provider.
 */
export function ReminderNotifications() {
  const runtime = useSyncRuntime();
  const now = useNow(60_000);
  const { items, loading } = useActiveReminders(now);

  // Changes settle for a moment (a sync applies many at once) before rescheduling.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => void reconcile(runtime, items).catch(() => undefined), 800);
    return () => clearTimeout(t);
  }, [runtime, items, loading]);

  const handled = useRef(new Set<string>());
  useEffect(() => {
    const once = (r: Notifications.NotificationResponse) => {
      const id = `${r.notification.request.identifier}|${r.actionIdentifier}|${r.notification.date}`;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      void handleResponse(runtime, r).catch(() => undefined);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(once);
    // The tap that launched the app, if it was closed. Cleared so it isn't replayed next start.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      once(last);
      Notifications.clearLastNotificationResponse();
    }
    return () => sub.remove();
  }, [runtime]);

  return null;
}
