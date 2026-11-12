import { change } from "./reports.ts";
import { addDays, isDone, localDate, type LocalTask } from "./tasks.ts";
import { goalProgress, type LocalMilestone } from "./goals.ts";
import { projectProgress } from "./projects.ts";
import type { LocalFocusSession } from "./focus.ts";
import type { LocalNote } from "./notes.ts";

/**
 * The numbers on the apps' stat cards (the entity card: a value, a trend
 * against the period before, and a ring), computed here so web and Android
 * show the same figures. "This week" is the last seven days including today,
 * and "last week" the seven before it, on this device's calendar: a rolling
 * window, so Monday mornings don't reset every trend to zero.
 */

export interface Trend {
  /** In the current period. */
  now: number;
  /** In the period before. */
  before: number;
  /** Percentage change, or null when there's nothing earlier to compare with. */
  change: number | null;
}

/** Days `[from, to)` as YYYY-MM-DD: the last `days` ending today, and the same span before. */
export function windows(today: string, days = 7) {
  const end = addDays(today, 1);
  const from = addDays(end, -days);
  return { current: { from, to: end }, previous: { from: addDays(from, -days), to: from } };
}

const inWindow = (day: string, w: { from: string; to: string }) => day >= w.from && day < w.to;

/** How many timestamps fall in the current window vs the one before. Nulls are ignored. */
export function trendOf(timestamps: readonly (string | null | undefined)[], today: string, days = 7): Trend {
  const { current, previous } = windows(today, days);
  let now = 0;
  let before = 0;
  for (const t of timestamps) {
    if (!t) continue;
    const day = localDate(new Date(t));
    if (inWindow(day, current)) now++;
    else if (inWindow(day, previous)) before++;
  }
  return { now, before, change: change(now, before) };
}

/** A project's card: tasks finished this week (vs last) and how far along it is. */
export function projectCardStats(tasks: readonly Pick<LocalTask, "status" | "completedAt">[], today: string) {
  const progress = projectProgress(tasks);
  const finished = tasks.filter((t) => isDone(t) && t.completedAt).map((t) => t.completedAt);
  return { progress, doneThisWeek: trendOf(finished, today) };
}

/** A goal's card: milestones reached in the last 30 days (vs the 30 before) and its progress. */
export function goalCardStats(milestones: readonly Pick<LocalMilestone, "doneAt">[], today: string) {
  return { progress: goalProgress(milestones), reached: trendOf(milestones.map((m) => m.doneAt), today, 30) };
}

/** Tasks finished, this week vs last. */
export const tasksDoneTrend = (tasks: readonly Pick<LocalTask, "status" | "completedAt">[], today: string) =>
  trendOf(tasks.filter((t) => isDone(t)).map((t) => t.completedAt), today);

/** Notes written, this week vs last. */
export const notesTrend = (notes: readonly Pick<LocalNote, "createdAt">[], today: string) => trendOf(notes.map((n) => n.createdAt), today);

/** Focus minutes over a window vs the one before (today vs yesterday with days = 1). */
export function focusTrend(sessions: readonly LocalFocusSession[], today: string, days = 7): Trend {
  const { current, previous } = windows(today, days);
  let now = 0;
  let before = 0;
  for (const s of sessions) {
    if (s.deletedAt || s.kind !== "focus") continue;
    const day = localDate(new Date(s.startedAt));
    if (inWindow(day, current)) now += s.durationSeconds;
    else if (inWindow(day, previous)) before += s.durationSeconds;
  }
  const minutes = { now: Math.round(now / 60), before: Math.round(before / 60) };
  return { ...minutes, change: change(minutes.now, minutes.before) };
}

/** Share of today's tasks already done: finished today out of finished today plus still due today. */
export function todayDoneShare(tasks: readonly Pick<LocalTask, "status" | "completedAt">[], dueToday: number, today: string): number | null {
  const doneToday = tasks.filter((t) => isDone(t) && t.completedAt && localDate(new Date(t.completedAt)) === today).length;
  const all = doneToday + dueToday;
  return all ? Math.round((doneToday / all) * 100) : null;
}

// ─── Rings: every stat card shows one, so each figure gets a percentage ──────

/** `part` of `whole` as a whole percentage (0–100); 0 when there's nothing to measure. */
export function percentOf(part: number, whole: number): number {
  if (!whole || whole < 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

/** Daily and weekly focus targets the Focus rings measure against: two hours a day, ten a week. */
export const FOCUS_DAY_TARGET_MIN = 120;
export const FOCUS_WEEK_TARGET_MIN = 600;
/** The streak a "Best streak" ring fills towards. */
export const STREAK_TARGET = 30;

/** How much of the time from `from` (an ISO time) to `to` (YYYY-MM-DD, end of that day) has passed; 0 with no `to`. */
export function timeUsed(from: string, to: string | null, now: Date): number {
  if (!to) return 0;
  const start = new Date(from).getTime();
  const [y, m, d] = to.split("-").map(Number) as [number, number, number];
  const end = new Date(y, m - 1, d + 1).getTime();
  if (end <= start) return 100;
  return percentOf(now.getTime() - start, end - start);
}

/** Open tasks that aren't overdue, as a share of the open ones; 100 when nothing is open. */
export const onTrackShare = (open: number, overdue: number) => (open ? 100 - percentOf(overdue, open) : 100);

/** How recent a sync is: 100 just now, falling to 0 over an hour. */
export function freshness(lastSyncedAt: Date | null, now: Date): number {
  if (!lastSyncedAt) return 0;
  const minutes = (now.getTime() - lastSyncedAt.getTime()) / 60_000;
  return Math.max(0, Math.min(100, Math.round(100 - (minutes / 60) * 100)));
}
