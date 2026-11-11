import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  alertKey,
  dismissReminder,
  eventReminderSeries,
  localDate,
  setTaskStatus,
  snoozeReminder,
  type LocalEvent,
  type LocalEventException,
  type LocalTask,
  type Series,
} from "@productivity/domain";
import type { SyncRuntime } from "@productivity/sync-engine";
import { navigateWhenReady } from "../../navigation/ref";
import { clock, type ActiveReminder, type Reminder } from "./active";

/**
 * Reminders as Android notifications, scheduled on the phone so they fire with
 * no connection and the app closed (plan §8.2):
 *
 *  - Each upcoming alert is scheduled with the OS under its alert key, so the
 *    same alert is never shown twice and a snooze gets a fresh one.
 *  - An alert that came due while the phone couldn't schedule it (created on
 *    the web while the phone was off) is shown once on the next start, if it's
 *    less than two hours late. Older ones just wait on the Reminders screen.
 *  - Dismissed, snoozed or deleted anywhere: after sync its notification is
 *    cancelled, or cleared from the shade.
 *
 * Exact timing needs Settings → Apps → Creedence → Alarms & reminders; without
 * it Android may deliver late to save battery.
 */
export const CHANNEL = "reminders";
const HORIZON_MS = 30 * 86_400_000;
const MAX_SCHEDULED = 50; // Android caps alarms per app at a few hundred; 50 covers weeks.
const LATE_MS = 2 * 3_600_000;
const NOTIFIED_KEY = "reminders.notified";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let setUp: Promise<void> | null = null;
/** The channel (sound, vibration, heads-up) and the buttons on a reminder notification. */
export function setUpNotifications(): Promise<void> {
  setUp ??= (async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Reminders",
        description: "Alerts for your reminders, tasks and events",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        lightColor: "#2dd4bf",
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      });
    }
    const snooze = { identifier: "snooze", buttonTitle: "Snooze 10 min", options: { opensAppToForeground: true } };
    const dismiss = { identifier: "dismiss", buttonTitle: "Dismiss", options: { opensAppToForeground: true } };
    await Notifications.setNotificationCategoryAsync("reminder", [snooze, dismiss]);
    await Notifications.setNotificationCategoryAsync("task-reminder", [
      snooze,
      { identifier: "done", buttonTitle: "Done", options: { opensAppToForeground: true } },
      dismiss,
    ]);
  })().catch((e) => {
    setUp = null;
    throw e;
  });
  return setUp;
}

export async function notificationsAllowed(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks once (Android 13+ shows the system prompt). True if allowed. */
export async function askForNotifications(): Promise<boolean> {
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function content(item: ActiveReminder): Notifications.NotificationContentInput {
  const kind = item.task ? "Task" : item.note ? "Note" : item.event ? "Event" : "Reminder";
  const snoozed = item.reminder.status === "snoozed" ? "snoozed, " : "";
  return {
    title: item.title,
    body: `${kind} · ${snoozed}${clock(item.at)}`,
    data: { reminderId: item.reminder.id },
    categoryIdentifier: item.task ? "task-reminder" : "reminder",
    sound: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  };
}

/** The one scheduled alert for the end of a running focus timer (see shared/focus). */
export const FOCUS_NOTIFICATION = "focus-timer";

/**
 * Bring the phone's scheduled and shown notifications in line with the
 * reminders. Safe to call often; calls are queued, never overlapping.
 */
let queue: Promise<void> = Promise.resolve();
export function reconcile(runtime: SyncRuntime, items: ActiveReminder[]): Promise<void> {
  const run = queue.then(() => reconcileNow(runtime, items));
  queue = run.catch(() => undefined);
  return run;
}

async function reconcileNow(runtime: SyncRuntime, items: ActiveReminder[]) {
  if (!(await notificationsAllowed())) return;
  await setUpNotifications();
  const now = Date.now();
  const notified = new Set<string>(JSON.parse((await runtime.db.getMeta(NOTIFIED_KEY)) ?? "[]"));

  const ahead = new Map<string, ActiveReminder>();
  const live = new Set<string>();
  for (const item of items) {
    const key = alertKey(item.reminder, new Date(now), item.series);
    if (!key) continue;
    live.add(key);
    const at = item.at.getTime();
    if (at > now) {
      if (at - now < HORIZON_MS && ahead.size < MAX_SCHEDULED) ahead.set(key, item);
    } else if (now - at < LATE_MS && !notified.has(key)) {
      await Notifications.scheduleNotificationAsync({ identifier: key, content: content(item), trigger: { channelId: CHANNEL } });
      notified.add(key);
    }
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const have = new Set(scheduled.map((s) => s.identifier));
  for (const s of scheduled) {
    // The focus timer's alert isn't a reminder; it's managed by the focus timer.
    if (!ahead.has(s.identifier) && s.identifier !== FOCUS_NOTIFICATION) await Notifications.cancelScheduledNotificationAsync(s.identifier);
  }
  for (const [key, item] of ahead) {
    if (have.has(key)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: key,
      content: content(item),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL },
    });
    notified.add(key);
  }

  // Shown but no longer current (dismissed or snoozed here or on the web): clear it.
  for (const n of await Notifications.getPresentedNotificationsAsync()) {
    if (n.request.content.data?.reminderId && !live.has(n.request.identifier)) {
      await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  }

  await runtime.db.setMeta(NOTIFIED_KEY, JSON.stringify([...notified].slice(-300)));
}

/** Forget this account's alerts on the phone (signing out). */
export async function clearAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

async function seriesFor(runtime: SyncRuntime, r: Reminder): Promise<Series | undefined> {
  if (!r.eventId || !r.recurrenceRule) return undefined;
  const event = (await runtime.db.get("event", r.eventId)) as LocalEvent | undefined;
  if (!event) return undefined;
  const exceptions = (await runtime.db.list("event_exception")) as unknown as LocalEventException[];
  return eventReminderSeries(r, event, exceptions);
}

/** A tap on a reminder notification, or one of its buttons. */
export async function handleResponse(runtime: SyncRuntime, response: Notifications.NotificationResponse) {
  if (response.notification.request.identifier === FOCUS_NOTIFICATION) {
    await Notifications.dismissNotificationAsync(FOCUS_NOTIFICATION).catch(() => undefined);
    return navigateWhenReady("focus");
  }
  const id = response.notification.request.content.data?.reminderId;
  if (typeof id !== "string") return;
  const reminder = (await runtime.db.get("reminder", id)) as Reminder | undefined;
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
  if (!reminder || reminder.deletedAt) return navigateWhenReady("reminders");

  const now = new Date();
  switch (response.actionIdentifier) {
    case "snooze":
      await runtime.write("reminder", snoozeReminder(reminder, new Date(now.getTime() + 10 * 60_000), now));
      break;
    case "dismiss":
      await runtime.write("reminder", dismissReminder(reminder, now, await seriesFor(runtime, reminder)));
      break;
    case "done": {
      const task = reminder.taskId ? ((await runtime.db.get("task", reminder.taskId)) as LocalTask | undefined) : undefined;
      if (task) await runtime.write("task", { ...setTaskStatus(task, "done", now), updatedAt: now.toISOString() });
      await runtime.write("reminder", dismissReminder(reminder, now, await seriesFor(runtime, reminder)));
      break;
    }
    default:
      if (reminder.taskId) navigateWhenReady("tasks", { task: reminder.taskId });
      else if (reminder.eventId) navigateWhenReady("calendar", { date: localDate(new Date(response.notification.date)) });
      else navigateWhenReady("reminders");
  }
}
