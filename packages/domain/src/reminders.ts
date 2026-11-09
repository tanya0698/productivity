import type { Reminder, ReminderRepeat } from "@productivity/contracts";

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
 */

export type LocalReminder = Omit<Reminder, "userId"> & { userId?: string };

export const repeatLabel: Record<ReminderRepeat, string> = {
  "FREQ=DAILY": "Every day",
  "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR": "Every weekday",
  "FREQ=WEEKLY": "Every week",
  "FREQ=MONTHLY": "Every month",
  "FREQ=YEARLY": "Every year",
};

// ─── Wall-clock time in a zone, without a library ─────────────────────────────

interface Parts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock reading of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): Parts {
  const p: Record<string, string> = {};
  for (const { type, value } of formatter(timeZone).formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
  };
}

const offsetAt = (t: number, timeZone: string) => {
  const p = zonedParts(new Date(t), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
};

/**
 * The instant when the clock in `timeZone` reads this wall-clock time. In a
 * spring-forward gap (02:30 that never happens) it lands just after the jump.
 */
export function zonedTime(
  { year, month, day, hour, minute, second = 0 }: Omit<Parts, "weekday" | "second"> & { second?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - offsetAt(guess, timeZone);
  const second2 = guess - offsetAt(first, timeZone);
  return new Date(second2);
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Occurrences from the first one onwards, in order. */
export function* occurrences(r: Pick<LocalReminder, "remindAt" | "timezone" | "recurrenceRule">): Generator<Date> {
  const first = new Date(r.remindAt);
  if (!r.recurrenceRule) {
    yield first;
    return;
  }
  const a = zonedParts(first, r.timezone);
  const at = (year: number, month: number, day: number) =>
    zonedTime({ year, month, day, hour: a.hour, minute: a.minute, second: a.second }, r.timezone);

  for (let k = 0; k < 100_000; k++) {
    switch (r.recurrenceRule) {
      case "FREQ=DAILY":
      case "FREQ=WEEKLY":
      case "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR": {
        const step = r.recurrenceRule === "FREQ=WEEKLY" ? 7 : 1;
        // Date.UTC normalises day overflow into the next month/year.
        const d = new Date(Date.UTC(a.year, a.month - 1, a.day + k * step));
        if (r.recurrenceRule.includes("BYDAY") && (d.getUTCDay() === 0 || d.getUTCDay() === 6)) continue;
        yield at(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        break;
      }
      case "FREQ=MONTHLY": {
        const total = a.month - 1 + k;
        const year = a.year + Math.floor(total / 12);
        const month = (total % 12) + 1;
        yield at(year, month, Math.min(a.day, daysIn(year, month)));
        break;
      }
      case "FREQ=YEARLY": {
        const year = a.year + k;
        yield at(year, a.month, Math.min(a.day, daysIn(year, a.month)));
        break;
      }
    }
  }
}

const isFinished = (r: Pick<LocalReminder, "status" | "recurrenceRule">) =>
  r.status === "done" || (r.status === "dismissed" && !r.recurrenceRule);

/**
 * The occurrence this reminder is about right now: the latest one already
 * past that hasn't been dismissed, or else the next one coming. Null once it's
 * finished.
 */
export function currentOccurrence(r: LocalReminder, now: Date): Date | null {
  if (isFinished(r)) return null;
  const handled = r.lastHandledAt ? new Date(r.lastHandledAt).getTime() : -Infinity;
  let latestPast: Date | null = null;
  for (const at of occurrences(r)) {
    if (at.getTime() <= handled) continue;
    if (at.getTime() > now.getTime()) return latestPast ?? at;
    latestPast = at;
  }
  return latestPast;
}

/** When this reminder should alert: its snooze if snoozed, otherwise its current occurrence. */
export function fireTime(r: LocalReminder, now: Date): Date | null {
  const occurrence = currentOccurrence(r, now);
  if (!occurrence) return null;
  if (r.status === "snoozed" && r.snoozedUntil) return new Date(r.snoozedUntil);
  return occurrence;
}

export const isDue = (r: LocalReminder, now: Date) => {
  const at = fireTime(r, now);
  return !!at && at.getTime() <= now.getTime();
};

/**
 * Identifies one alert: the occurrence, plus the snooze if any, so a snoozed
 * reminder alerts again but the same alert never shows twice (plan §8.2 dedupe).
 */
export function alertKey(r: LocalReminder, now: Date): string | null {
  const occurrence = currentOccurrence(r, now);
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
    taskId: f.taskId ?? null,
    noteId: f.taskId ? null : (f.noteId ?? null),
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
export function dismissReminder<T extends LocalReminder>(r: T, now: Date): T {
  const occurrence = currentOccurrence(r, now);
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
}

/** Live reminders with their next alert time, soonest first; due ones (at ≤ now) lead. */
export function scheduledReminders<T extends LocalReminder>(reminders: readonly T[], now: Date): ReminderAt<T>[] {
  const out: ReminderAt<T>[] = [];
  for (const reminder of reminders) {
    if (reminder.deletedAt) continue;
    const at = fireTime(reminder, now);
    if (at) out.push({ reminder, at });
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
