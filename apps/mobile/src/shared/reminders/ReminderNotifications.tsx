import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { useAuth } from "../auth/AuthProvider";
import { onDevicePushTokenChange, registerDevicePush } from "./devicePush";
import { useActiveReminders, useNow } from "./active";
import { askForNotifications, handleResponse, reconcile, setUpNotifications } from "./notifications";

/**
 * Keeps the phone's notifications in step with the signed-in account's
 * reminders, and acts on taps and buttons (including the one that opened the
 * app). Renders nothing; mounted once inside the sync provider.
 */
export function ReminderNotifications() {
  const runtime = useSyncRuntime();
  const { getAccessToken } = useAuth();
  const now = useNow(60_000);
  const { items, loading } = useActiveReminders(now);
  // Bumped when permission may have changed or the app comes back, to reschedule.
  const [pass, setPass] = useState(0);

  // On launch, like park-check: the channel first, then ask for permission
  // (Android 13+ shows its prompt once). Without permission nothing can reach
  // the notification bar, so this can't wait for the Reminders screen.
  useEffect(() => {
    void (async () => {
      await setUpNotifications().catch(() => undefined);
      const allowed = await askForNotifications().catch(() => false);
      setPass((n) => n + 1);
      // Then let the server push reminders here too (FCM), the reliable path with the app closed.
      if (allowed) await registerDevicePush(getAccessToken).catch(() => undefined);
    })();
    const tokens = onDevicePushTokenChange(getAccessToken);
    // Back in the app: permission may have been granted in Settings, or Android
    // may have dropped alarms (force stop, app update). Schedule again.
    const sub = AppState.addEventListener("change", (state) => state === "active" && setPass((n) => n + 1));
    return () => {
      sub.remove();
      tokens.remove();
    };
  }, [getAccessToken]);

  // Changes settle for a moment (a sync applies many at once) before rescheduling.
  useEffect(() => {
    if (loading || pass === 0) return;
    const t = setTimeout(() => void reconcile(runtime, items).catch(() => undefined), 800);
    return () => clearTimeout(t);
  }, [runtime, items, loading, pass]);

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
