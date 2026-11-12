import { change } from "./reports.ts";
import { addDays, isDone, localDate, taskDay, type LocalTask } from "./tasks.ts";
import { goalProgress, type LocalMilestone } from "./goals.ts";
import { countOn, isScheduled, streak, type LocalHabit, type LogIndex } from "./habits.ts";
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

// ─── Trends for every card: the same figure now and a period ago ─────────────

const trendFrom = (now: number, before: number): Trend => ({ now, before, change: change(now, before) });

type TaskLike = Pick<LocalTask, "status" | "completedAt" | "createdAt" | "updatedAt" | "dueDate" | "dueAt">;

/** When a task was closed: its completion, or for a cancelled one (which keeps no date) its last change. */
const closedDay = (t: TaskLike): string | null =>
  t.completedAt ? localDate(new Date(t.completedAt)) : t.status === "cancelled" ? localDate(new Date(t.updatedAt)) : null;
/** Whether a task was still open at the end of `day`. */
const openOn = (t: TaskLike, day: string) => {
  if (localDate(new Date(t.createdAt)) > day) return false;
  const closed = closedDay(t);
  return !closed || closed > day;
};

/** Tasks due today vs due yesterday (any state: how full each day was). */
export function dueTodayTrend(tasks: readonly TaskLike[], today: string): Trend {
  const yesterday = addDays(today, -1);
  let now = 0;
  let before = 0;
  for (const t of tasks) {
    const day = taskDay(t);
    if (day === today && !isDone(t)) now++;
    else if (day === yesterday && openOn(t, addDays(yesterday, -1))) before++;
  }
  return trendFrom(now, before);
}

/** Overdue now vs overdue a week ago (open, due before that day). */
export function overdueTrend(tasks: readonly TaskLike[], today: string): Trend {
  const weekAgo = addDays(today, -7);
  let now = 0;
  let before = 0;
  for (const t of tasks) {
    const day = taskDay(t);
    if (!day) continue;
    if (day < today && !isDone(t)) now++;
    if (day < weekAgo && openOn(t, weekAgo)) before++;
  }
  return trendFrom(now, before);
}

/** Open tasks now vs a week ago. */
export function openTasksTrend(tasks: readonly TaskLike[], today: string): Trend {
  const weekAgo = addDays(today, -7);
  return trendFrom(tasks.filter((t) => !isDone(t)).length, tasks.filter((t) => openOn(t, weekAgo)).length);
}

/** Habits that met their target today vs yesterday (daily habits due that day). */
export function habitsDoneTrend(habits: readonly LocalHabit[], index: LogIndex, today: string): Trend {
  const met = (day: string) =>
    habits.filter((h) => h.cadence === "daily" && isScheduled(h, day) && countOn(index, h.id, day) >= h.targetCount).length;
  return trendFrom(met(today), met(addDays(today, -1)));
}

/** The best streak now vs a week ago. */
export function bestStreakTrend(habits: readonly LocalHabit[], index: LogIndex, today: string): Trend {
  const best = (day: string) => habits.reduce((m, h) => Math.max(m, streak(h, index, day)), 0);
  return trendFrom(best(today), best(addDays(today, -7)));
}

/** Habits now vs a week ago (by when each was created). */
export function habitsCountTrend(habits: readonly Pick<LocalHabit, "createdAt">[], today: string): Trend {
  const weekAgo = addDays(today, -7);
  return trendFrom(habits.length, habits.filter((h) => localDate(new Date(h.createdAt)) <= weekAgo).length);
}

/** A rate (0–100) now vs before, as a change in points rather than percent. */
export const pointsTrend = (now: number, before: number): Trend => ({ now, before, change: now - before });

/** Time used towards a target date, now vs a week ago, in points. */
export function timeUsedTrend(from: string, to: string | null, now: Date): Trend {
  return pointsTrend(timeUsed(from, to, now), timeUsed(from, to, new Date(now.getTime() - 7 * 86_400_000)));
}

/** A goal's milestone progress now vs 30 days ago, in points. */
export function goalProgressTrend(milestones: readonly Pick<LocalMilestone, "doneAt">[], today: string): Trend {
  const monthAgo = addDays(today, -30);
  const total = milestones.length;
  const doneBy = milestones.filter((m) => m.doneAt && localDate(new Date(m.doneAt)) <= monthAgo).length;
  return pointsTrend(goalProgress(milestones).percent, total ? Math.floor((doneBy / total) * 100) : 0);
}
