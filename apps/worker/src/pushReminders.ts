import type { PrismaClient } from "@prisma/client";
import {
  alertKey,
  eventReminderSeries,
  fireTime,
  isDone,
  type LocalEvent,
  type LocalEventException,
  type LocalReminder,
} from "@productivity/domain";
import type { ReminderRepeat, ReminderStatus, TaskStatus } from "@productivity/contracts";
import type { DevicePush, DeviceResult } from "@productivity/push";

/**
 * Sends due reminders as web push (plan §8.1) and to the Android app through
 * Firebase Cloud Messaging, with the same rules the apps
 * use to decide when a reminder is due (@productivity/domain), including
 * reminders on repeating events that follow moved and cancelled occurrences.
 *
 * Each alert is recorded in push_deliveries *before* it's sent, keyed by the
 * domain's alertKey, so a crash or a second worker never sends it twice; a
 * snooze makes a new key, so a snoozed reminder alerts again.
 */

/** Alerts older than this aren't pushed: turning push on shouldn't replay last week. */
export const PUSH_WINDOW_MS = 2 * 60 * 60_000;
/** How long sent-alert records are kept. */
const KEEP_DELIVERIES_MS = 30 * 24 * 60 * 60_000;

export interface PushPayload {
  title: string;
  body: string;
  /** Same alert, same tag: the OS replaces rather than stacks it. */
  tag: string;
  /** Where clicking it goes, inside the app. */
  url: string;
}

export interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one push. "gone" means the browser unsubscribed: the row is removed. */
export type Deliver = (sub: Subscription, payload: PushPayload) => Promise<"ok" | "gone" | "failed">;

/** Sends one push to a phone's FCM token. "gone": the app was removed; the row is removed. */
export type DeliverToDevice = (token: string, push: DevicePush) => Promise<DeviceResult>;

/** Where alerts can go: browsers (web push) and phones (FCM). Either may be off. */
export interface Channels {
  web?: Deliver | null;
  device?: DeliverToDevice | null;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const wall = (d: Date | null) => (d ? d.toISOString().slice(0, 19) : null);
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type Db = Pick<
  PrismaClient,
  "pushSubscription" | "devicePushToken" | "reminder" | "task" | "note" | "calendarEvent" | "calendarEventException" | "pushDelivery"
>;

/** What the phone opens on a tap, matching its own notifications (see the app's handleResponse). */
const categoryFor = (row: { taskId: string | null }) => (row.taskId ? "task-reminder" : "reminder");

export async function pushDueReminders(db: Db, now: Date, channels: Channels | Deliver): Promise<{ sent: number; alerts: number }> {
  const { web, device } = typeof channels === "function" ? { web: channels, device: null } : channels;
  const subs = web ? await db.pushSubscription.findMany() : [];
  const devices = device ? await db.devicePushToken.findMany() : [];
  if (!subs.length && !devices.length) return { sent: 0, alerts: 0 };
  const subsByUser = new Map<string, Subscription[]>();
  for (const s of subs) subsByUser.set(s.userId, [...(subsByUser.get(s.userId) ?? []), s]);
  const devicesByUser = new Map<string, { id: string; token: string }[]>();
  for (const d of devices) devicesByUser.set(d.userId, [...(devicesByUser.get(d.userId) ?? []), d]);
  const users = new Set([...subsByUser.keys(), ...devicesByUser.keys()]);

  // Only what could be due: repeating ones, or one-offs and snoozes already past.
  const rows = await db.reminder.findMany({
    where: {
      userId: { in: [...users] },
      deletedAt: null,
      status: { in: ["scheduled", "snoozed"] },
      OR: [{ recurrenceRule: { not: null } }, { remindAt: { lte: now } }, { snoozedUntil: { lte: now } }],
    },
  });
  if (!rows.length) return { sent: 0, alerts: 0 };

  const ids = (pick: (r: (typeof rows)[number]) => string | null) => [...new Set(rows.map(pick).filter((v): v is string => !!v))];
  const [tasks, notes, events, exceptions] = await Promise.all([
    db.task.findMany({ where: { id: { in: ids((r) => r.taskId) } }, select: { id: true, title: true, status: true, deletedAt: true } }),
    db.note.findMany({ where: { id: { in: ids((r) => r.noteId) } }, select: { id: true, title: true, deletedAt: true } }),
    db.calendarEvent.findMany({ where: { id: { in: ids((r) => r.eventId) } } }),
    db.calendarEventException.findMany({ where: { eventId: { in: ids((r) => r.eventId) }, deletedAt: null } }),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const exceptionRecords: LocalEventException[] = exceptions.map((x) => ({
    id: x.id,
    eventId: x.eventId,
    originalOccurrence: wall(x.originalOccurrence)!,
    cancelled: x.cancelled,
    overrideLocalStart: wall(x.overrideLocalStart),
    overrideLocalEnd: wall(x.overrideLocalEnd),
    overrideTitle: x.overrideTitle,
    createdAt: x.createdAt.toISOString(),
    updatedAt: x.updatedAt.toISOString(),
    deletedAt: null,
    version: Number(x.version),
  }));

  let sent = 0;
  let alerts = 0;
  for (const row of rows) {
    const reminder: LocalReminder = {
      id: row.id,
      taskId: row.taskId,
      noteId: row.noteId,
      eventId: row.eventId,
      title: row.title,
      remindAt: row.remindAt.toISOString(),
      timezone: row.timezone,
      recurrenceRule: row.recurrenceRule as ReminderRepeat | null,
      status: row.status as ReminderStatus,
      snoozedUntil: iso(row.snoozedUntil),
      lastHandledAt: iso(row.lastHandledAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: null,
      version: Number(row.version),
    };

    // What it's about, and whether that still wants an alert.
    let title = row.title || "Reminder";
    let kind = "Reminder";
    let url = "/reminders";
    let event: LocalEvent | undefined;
    if (row.taskId) {
      const task = taskById.get(row.taskId);
      if (!task || task.deletedAt || isDone({ status: task.status as TaskStatus })) continue;
      title = task.title;
      kind = "Task";
      url = `/tasks?task=${task.id}`;
    } else if (row.noteId) {
      const note = noteById.get(row.noteId);
      if (!note || note.deletedAt) continue;
      title = note.title.trim() || "Note";
      kind = "Note";
      url = `/notes?note=${note.id}`;
    } else if (row.eventId) {
      const e = eventById.get(row.eventId);
      if (!e || e.deletedAt) continue;
      event = {
        id: e.id,
        projectId: e.projectId,
        taskId: e.taskId,
        title: e.title,
        description: e.description,
        allDay: e.allDay,
        localStart: wall(e.localStart),
        localEnd: wall(e.localEnd),
        timezone: e.timezone,
        startsAt: iso(e.startsAt),
        endsAt: iso(e.endsAt),
        startDate: day(e.startDate),
        endDate: day(e.endDate),
        recurrenceRule: e.recurrenceRule as ReminderRepeat | null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        deletedAt: null,
        version: Number(e.version),
      };
      title = e.title;
      kind = "Event";
      url = `/calendar?event=${e.id}`;
    }

    const series = event && reminder.recurrenceRule ? eventReminderSeries(reminder, event, exceptionRecords) : undefined;
    const at = fireTime(reminder, now, series);
    if (!at || at.getTime() > now.getTime() || now.getTime() - at.getTime() > PUSH_WINDOW_MS) continue;
    const key = alertKey(reminder, now, series);
    if (!key) continue;

    // Claim the alert first; a unique-key clash means it was already sent.
    try {
      await db.pushDelivery.create({ data: { alertKey: key, userId: row.userId, reminderId: row.id } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
    alerts++;

    const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: row.timezone }).format(at);
    const payload: PushPayload = { title, body: `${kind} · ${reminder.status === "snoozed" ? "snoozed, " : ""}${time}`, tag: key, url };
    for (const sub of web ? (subsByUser.get(row.userId) ?? []) : []) {
      const result = await web!(sub, payload);
      if (result === "ok") {
        sent++;
        await db.pushSubscription.update({ where: { id: sub.id }, data: { lastUsedAt: now } }).catch(() => {});
      } else if (result === "gone") {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
    // The phone: same alert key as the alarm the app scheduled itself, so the two replace each other.
    for (const d of device ? (devicesByUser.get(row.userId) ?? []) : []) {
      const result = await device!(d.token, {
        title: payload.title,
        body: payload.body,
        tag: key,
        data: { reminderId: row.id, url },
        channelId: "reminders",
        categoryId: categoryFor(row),
        ttlSeconds: 60 * 60,
      });
      if (result === "ok") {
        sent++;
        await db.devicePushToken.update({ where: { id: d.id }, data: { lastUsedAt: now } }).catch(() => {});
      } else if (result === "gone") {
        await db.devicePushToken.delete({ where: { id: d.id } }).catch(() => {});
      }
    }
  }

  await db.pushDelivery.deleteMany({ where: { sentAt: { lt: new Date(now.getTime() - KEEP_DELIVERIES_MS) } } });
  return { sent, alerts };
}
