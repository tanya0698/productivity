import type { Reminder, ReminderRepeat } from "@productivity/contracts";
import { repeatDates, zonedParts, zonedTime } from "./time.ts";

/**
 * Reminder rules (plan §8.2), shared by every client and later the worker, so
 * all of them agree on when a reminder fires and what counts as one occurrence.
 *
 *  - `remindAt` is the first occurrence. A repeating reminder keeps that
 *    wall-clock time in its `timezone`, so "every day at 09:00" stays at 09:00
 *    across daylight-saving changes.
 *  - Monthly on the 31st falls on the last day of shorter months; yearly on
 *    29 February falls on the 28th in other years.
 *  - If several occurrences were missed (app closed for a week), only the most
 *    recent one is due: one alert, not seven.
 *  - Dismissing a repeating reminder moves `lastHandledAt` to that occurrence;
 *    the series carries on. Dismissing a one-off ends it.
 *  - A reminder on a repeating calendar event follows the event's actual
 *    occurrences instead of its own rule (moved ones move, cancelled ones never
 *    fire): pass that `Series` (eventReminders.ts) to the functions below.
 */

export type LocalReminder = Omit<Reminder, "userId"> & { userId?: string };

export const repeatLabel: Record<ReminderRepeat, string> = {
  "FREQ=DAILY": "Every day",
  "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR": "Every weekday",
  "FREQ=WEEKLY": "Every week",
  "FREQ=MONTHLY": "Every month",
  "FREQ=YEARLY": "Every year",
};

/** Alert times in order, from the first onwards. Called afresh each time it's needed. */
export type Series = () => Iterable<Date>;

/** Occurrences from the first one onwards, in order, at the first one's wall-clock time. */
export function* occurrences(r: Pick<LocalReminder, "remindAt" | "timezone" | "recurrenceRule">): Generator<Date> {
  const first = new Date(r.remindAt);
  if (!r.recurrenceRule) {
    yield first;
    return;
  }
  const a = zonedParts(first, r.timezone);
  for (const d of repeatDates(a, r.recurrenceRule)) {
    yield zonedTime({ ...d, hour: a.hour, minute: a.minute, second: a.second }, r.timezone);
  }
}

const isFinished = (r: Pick<LocalReminder, "status" | "recurrenceRule">) =>
  r.status === "done" || (r.status === "dismissed" && !r.recurrenceRule);

/**
 * The occurrence this reminder is about right now: the latest one already
 * past that hasn't been dismissed, or else the next one coming. Null once it's
 * finished.
 */
export function currentOccurrence(r: LocalReminder, now: Date, series?: Series): Date | null {
  if (isFinished(r)) return null;
  const handled = r.lastHandledAt ? new Date(r.lastHandledAt).getTime() : -Infinity;
  let latestPast: Date | null = null;
  for (const at of series ? series() : occurrences(r)) {
    if (at.getTime() <= handled) continue;
    if (at.getTime() > now.getTime()) return latestPast ?? at;
    latestPast = at;
  }
  return latestPast;
}

/** When this reminder should alert: its snooze if snoozed, otherwise its current occurrence. */
export function fireTime(r: LocalReminder, now: Date, series?: Series): Date | null {
  const occurrence = currentOccurrence(r, now, series);
  if (!occurrence) return null;
  if (r.status === "snoozed" && r.snoozedUntil) return new Date(r.snoozedUntil);
  return occurrence;
}

export const isDue = (r: LocalReminder, now: Date, series?: Series) => {
  const at = fireTime(r, now, series);
  return !!at && at.getTime() <= now.getTime();
};

/**
 * Identifies one alert: the occurrence, plus the snooze if any, so a snoozed
 * reminder alerts again but the same alert never shows twice (plan §8.2 dedupe).
 */
export function alertKey(r: LocalReminder, now: Date, series?: Series): string | null {
  const occurrence = currentOccurrence(r, now, series);
  if (!occurrence) return null;
  const snooze = r.status === "snoozed" && r.snoozedUntil ? `+${r.snoozedUntil}` : "";
  return `${r.id}@${occurrence.toISOString()}${snooze}`;
}

// ─── Changes ──────────────────────────────────────────────────────────────────

export interface ReminderFields {
  remindAt: Date;
  timezone: string;
  title?: string | null;
  taskId?: string | null;
  noteId?: string | null;
  eventId?: string | null;
  recurrenceRule?: ReminderRepeat | null;
}

export function newReminder(id: string, now: Date, f: ReminderFields): LocalReminder {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    // One link at most: a task wins over a note, a note over an event.
    taskId: f.taskId ?? null,
    noteId: f.taskId ? null : (f.noteId ?? null),
    eventId: f.taskId || f.noteId ? null : (f.eventId ?? null),
    title: f.title?.trim() || null,
    remindAt: f.remindAt.toISOString(),
    timezone: f.timezone,
    recurrenceRule: f.recurrenceRule ?? null,
    status: "scheduled",
    snoozedUntil: null,
    lastHandledAt: null,
  };
}

/** Change when or how often: starts the reminder afresh (no snooze, nothing handled). */
export function rescheduleReminder<T extends LocalReminder>(
  r: T,
  changes: { remindAt?: Date; recurrenceRule?: ReminderRepeat | null; title?: string | null; timezone?: string },
  now: Date,
): T {
  return {
    ...r,
    remindAt: (changes.remindAt ?? new Date(r.remindAt)).toISOString(),
    recurrenceRule: changes.recurrenceRule === undefined ? r.recurrenceRule : changes.recurrenceRule,
    title: changes.title === undefined ? r.title : changes.title?.trim() || null,
    timezone: changes.timezone ?? r.timezone,
    status: "scheduled",
    snoozedUntil: null,
    lastHandledAt: null,
    updatedAt: now.toISOString(),
  };
}

export function snoozeReminder<T extends LocalReminder>(r: T, until: Date, now: Date): T {
  return { ...r, status: "snoozed", snoozedUntil: until.toISOString(), updatedAt: now.toISOString() };
}

/** Dismiss the current occurrence. A one-off is finished; a repeating one moves on to the next. */
export function dismissReminder<T extends LocalReminder>(r: T, now: Date, series?: Series): T {
  const occurrence = currentOccurrence(r, now, series);
  const base = { ...r, snoozedUntil: null, updatedAt: now.toISOString() };
  if (!occurrence) return base;
  return r.recurrenceRule
    ? { ...base, status: "scheduled", lastHandledAt: occurrence.toISOString() }
    : { ...base, status: "dismissed", lastHandledAt: occurrence.toISOString() };
}

/** Stop a repeating reminder for good (or finish a one-off). */
export const endReminder = <T extends LocalReminder>(r: T, now: Date): T => ({
  ...r,
  status: "done",
  snoozedUntil: null,
  updatedAt: now.toISOString(),
});

// ─── Lists ────────────────────────────────────────────────────────────────────

export interface ReminderAt<T extends LocalReminder = LocalReminder> {
  reminder: T;
  at: Date;
  /** Set when the times come from a repeating event rather than the reminder's own rule. */
  series?: Series;
}

/** Live reminders with their next alert time, soonest first; due ones (at ≤ now) lead. */
export function scheduledReminders<T extends LocalReminder>(
  reminders: readonly T[],
  now: Date,
  seriesOf?: (r: T) => Series | undefined,
): ReminderAt<T>[] {
  const out: ReminderAt<T>[] = [];
  for (const reminder of reminders) {
    if (reminder.deletedAt) continue;
    const series = seriesOf?.(reminder);
    const at = fireTime(reminder, now, series);
    if (at) out.push(series ? { reminder, at, series } : { reminder, at });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Snooze choices relative to `now`, in the device's own time: 10 minutes, 1 hour, tomorrow 09:00. */
export function snoozeChoices(now: Date): { label: string; until: Date }[] {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: "10 minutes", until: new Date(now.getTime() + 10 * 60_000) },
    { label: "1 hour", until: new Date(now.getTime() + 60 * 60_000) },
    { label: "Tomorrow 9:00", until: tomorrow },
  ];
}
