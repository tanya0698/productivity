import type { FocusSession } from "@productivity/contracts";
import { localDate } from "./tasks.ts";
import { weekOf } from "./habits.ts";

/**
 * Focus timer rules (plan Phase 5). The running timer is device state; only a
 * finished (or stopped) session is saved and synced, as an append-only record.
 */

export type LocalFocusSession = Omit<FocusSession, "userId"> & { userId?: string };
export type FocusKind = FocusSession["kind"];

export const FOCUS_PRESETS = [
  { label: "25 / 5", focus: 25, rest: 5 },
  { label: "50 / 10", focus: 50, rest: 10 },
  { label: "90 / 20", focus: 90, rest: 20 },
] as const;

export interface TimerState {
  kind: FocusKind;
  plannedMinutes: number;
  taskId: string | null;
  projectId: string | null;
  /** When the session first started. */
  startedAt: string;
  /** Running since (null while paused). */
  runningSince: string | null;
  /** Time run before the latest resume. */
  elapsedBeforeMs: number;
}

export function startTimer(kind: FocusKind, plannedMinutes: number, link: { taskId?: string | null; projectId?: string | null }, now: Date): TimerState {
  const at = now.toISOString();
  return {
    kind,
    plannedMinutes,
    taskId: link.taskId ?? null,
    projectId: link.projectId ?? null,
    startedAt: at,
    runningSince: at,
    elapsedBeforeMs: 0,
  };
}

export const elapsedMs = (t: TimerState, now: Date) =>
  t.elapsedBeforeMs + (t.runningSince ? Math.max(0, now.getTime() - new Date(t.runningSince).getTime()) : 0);

export const remainingMs = (t: TimerState, now: Date) => Math.max(0, t.plannedMinutes * 60_000 - elapsedMs(t, now));

export const isFinished = (t: TimerState, now: Date) => remainingMs(t, now) === 0;

export const pauseTimer = (t: TimerState, now: Date): TimerState =>
  t.runningSince ? { ...t, elapsedBeforeMs: elapsedMs(t, now), runningSince: null } : t;

export const resumeTimer = (t: TimerState, now: Date): TimerState => (t.runningSince ? t : { ...t, runningSince: now.toISOString() });

/** The record to save when a timer ends, run out (`completed`) or stopped early. */
export function sessionFrom(id: string, t: TimerState, now: Date, completed: boolean): LocalFocusSession {
  const seconds = Math.round(Math.min(elapsedMs(t, now), t.plannedMinutes * 60_000) / 1000);
  // A session that ran out ends when its time was up, not when the tab noticed.
  const end = completed ? new Date(now.getTime() - Math.max(0, elapsedMs(t, now) - t.plannedMinutes * 60_000)) : now;
  return {
    id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: 0,
    deletedAt: null,
    taskId: t.taskId,
    projectId: t.projectId,
    kind: t.kind,
    startedAt: t.startedAt,
    endedAt: end.toISOString(),
    plannedMinutes: t.plannedMinutes,
    durationSeconds: seconds,
    completed,
  };
}

/** "24:59", or "1:05:00" past an hour. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/** "1 h 25 min", "40 min", "0 min". */
export function minutesText(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
}

/** Focus time today and this week (Monday start), on this device's calendar. */
export function focusStats(sessions: readonly LocalFocusSession[], now: Date) {
  const today = localDate(now);
  const monday = weekOf(today);
  let todaySeconds = 0;
  let weekSeconds = 0;
  let sessionsToday = 0;
  for (const s of sessions) {
    if (s.deletedAt || s.kind !== "focus") continue;
    const day = localDate(new Date(s.startedAt));
    if (day === today) {
      todaySeconds += s.durationSeconds;
      sessionsToday++;
    }
    if (day >= monday && day <= today) weekSeconds += s.durationSeconds;
  }
  return { todaySeconds, weekSeconds, sessionsToday };
}
