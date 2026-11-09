import type { Habit, HabitLog } from "@productivity/contracts";
import { formatYmd, parseYmd, shiftYmd } from "./time.ts";

/**
 * Habit rules (plan Phase 5): which days a habit is due, whether a day or week
 * met its target, and streaks. Dates are the user's local YYYY-MM-DD days.
 *
 * Logs are append-only: ticking adds a log, unticking removes the latest one.
 * Two devices ticking offline both count, which is what happened.
 */

export type LocalHabit = Omit<Habit, "userId"> & { userId?: string };
export type LocalHabitLog = Omit<HabitLog, "userId"> & { userId?: string };

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const { year, month, day } = parseYmd(date);
  const d = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return d === 0 ? 7 : d;
}

export const addDaysTo = (date: string, days: number) => formatYmd(shiftYmd(parseYmd(date), days));

/** The Monday of `date`'s week. */
export const weekOf = (date: string) => addDaysTo(date, 1 - isoWeekday(date));

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function scheduleLabel(h: Pick<LocalHabit, "cadence" | "daysOfWeek" | "targetCount">): string {
  const times = h.targetCount > 1 ? `${h.targetCount}× ` : "";
  if (h.cadence === "weekly") return `${h.targetCount}× a week`;
  const days = h.daysOfWeek ? [...h.daysOfWeek].sort((a, b) => a - b) : null;
  if (!days || days.length === 7) return `${times}every day`;
  if (days.join() === "1,2,3,4,5") return `${times}on weekdays`;
  if (days.join() === "6,7") return `${times}at weekends`;
  return `${times}on ${days.map((d) => WEEKDAY_NAMES[d - 1]).join(", ")}`;
}

export interface HabitFields {
  title: string;
  description?: string | null;
  cadence?: "daily" | "weekly";
  daysOfWeek?: number[] | null;
  targetCount?: number;
  goalId?: string | null;
}

/** Normalise the schedule: weekly habits have no days; "every day" is stored as null. */
function schedule(f: Pick<HabitFields, "cadence" | "daysOfWeek">) {
  if (f.cadence === "weekly") return { cadence: "weekly" as const, daysOfWeek: null };
  const days = f.daysOfWeek ? [...new Set(f.daysOfWeek)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b) : null;
  return { cadence: "daily" as const, daysOfWeek: days && days.length && days.length < 7 ? days : null };
}

export function newHabit(id: string, now: Date, f: HabitFields): LocalHabit {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    goalId: f.goalId ?? null,
    title: f.title.trim(),
    description: f.description?.trim() || null,
    ...schedule(f),
    targetCount: Math.max(1, Math.round(f.targetCount ?? 1)),
    archivedAt: null,
  };
}

export function editHabit<T extends LocalHabit>(h: T, f: Partial<HabitFields>, now: Date): T {
  const cadence = f.cadence ?? h.cadence;
  return {
    ...h,
    title: f.title === undefined ? h.title : f.title.trim() || h.title,
    description: f.description === undefined ? h.description : f.description?.trim() || null,
    goalId: f.goalId === undefined ? h.goalId : f.goalId,
    targetCount: f.targetCount === undefined ? h.targetCount : Math.max(1, Math.round(f.targetCount)),
    ...schedule({ cadence, daysOfWeek: f.daysOfWeek === undefined ? h.daysOfWeek : f.daysOfWeek }),
    updatedAt: now.toISOString(),
  };
}

export function newHabitLog(id: string, now: Date, habitId: string, date: string, count = 1): LocalHabitLog {
  const at = now.toISOString();
  return { id, createdAt: at, updatedAt: at, version: 0, deletedAt: null, habitId, date, count };
}

/** Counts per habit per date, from live logs. */
export type LogIndex = Map<string, Map<string, number>>;

export function indexLogs(logs: readonly LocalHabitLog[]): LogIndex {
  const index: LogIndex = new Map();
  for (const l of logs) {
    if (l.deletedAt) continue;
    let byDate = index.get(l.habitId);
    if (!byDate) index.set(l.habitId, (byDate = new Map()));
    byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.count);
  }
  return index;
}

export const countOn = (index: LogIndex, habitId: string, date: string) => index.get(habitId)?.get(date) ?? 0;

export function countInWeek(index: LogIndex, habitId: string, monday: string): number {
  let n = 0;
  for (let i = 0; i < 7; i++) n += countOn(index, habitId, addDaysTo(monday, i));
  return n;
}

/** Whether a daily habit is due on `date` (weekly habits can be done any day). */
export const isScheduled = (h: Pick<LocalHabit, "cadence" | "daysOfWeek">, date: string) =>
  h.cadence === "weekly" || !h.daysOfWeek || h.daysOfWeek.includes(isoWeekday(date));

/** Today's (daily) or this week's (weekly) count against the target. */
export function habitProgress(h: LocalHabit, index: LogIndex, today: string) {
  const count = h.cadence === "weekly" ? countInWeek(index, h.id, weekOf(today)) : countOn(index, h.id, today);
  return { count, target: h.targetCount, done: count >= h.targetCount, scheduled: isScheduled(h, today) };
}

/**
 * Consecutive days (daily) or weeks (weekly) that met the target, up to today.
 * Today or this week only counts once it's done; until then, an unfinished
 * today doesn't break the streak. Days a habit isn't scheduled are skipped.
 */
export function streak(h: LocalHabit, index: LogIndex, today: string): number {
  let n = 0;
  if (h.cadence === "weekly") {
    let monday = weekOf(today);
    if (countInWeek(index, h.id, monday) < h.targetCount) monday = addDaysTo(monday, -7);
    for (let i = 0; i < 520 && countInWeek(index, h.id, monday) >= h.targetCount; i++, monday = addDaysTo(monday, -7)) n++;
    return n;
  }
  let date = today;
  if (countOn(index, h.id, date) < h.targetCount) date = addDaysTo(date, -1);
  // Ends at the first scheduled day that missed its target. Not at the
  // habit's creation date: ticks can predate it (synced from another device).
  for (let i = 0; i < 3650; i++, date = addDaysTo(date, -1)) {
    if (!isScheduled(h, date)) continue;
    if (countOn(index, h.id, date) < h.targetCount) break;
    n++;
  }
  return n;
}

/**
 * done: met the day's target (or, weekly, any completion that day) ·
 * partial: some, not enough · missed: due, none, and the day is over ·
 * pending: today, not done yet · off: not due, or before the habit existed.
 */
export type DayMark = "done" | "partial" | "missed" | "pending" | "off";

/** The last `n` days ending today, as marks for a habit's strip. */
export function recentDays(h: LocalHabit, index: LogIndex, today: string, n = 7): { date: string; mark: DayMark; count: number }[] {
  const created = h.createdAt.slice(0, 10);
  return Array.from({ length: n }, (_, i) => {
    const date = addDaysTo(today, i - n + 1);
    const count = countOn(index, h.id, date);
    const due = h.cadence === "daily" && isScheduled(h, date) && date >= created;
    let mark: DayMark;
    if (h.cadence === "weekly") mark = count > 0 ? "done" : "off";
    else if (count >= h.targetCount) mark = "done";
    else if (count > 0) mark = "partial";
    else if (!due) mark = "off";
    else mark = date === today ? "pending" : "missed";
    return { date, mark, count };
  });
}

/** The log to remove when unticking: the most recent one on that date. */
export function logToUndo<T extends LocalHabitLog>(logs: readonly T[], habitId: string, date: string): T | undefined {
  return logs
    .filter((l) => !l.deletedAt && l.habitId === habitId && l.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
