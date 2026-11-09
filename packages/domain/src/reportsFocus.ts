import type { LocalFocusSession } from "./focus.ts";
import { localDate } from "./tasks.ts";

/** Focus totals for a report: minutes per day and per task, focus sessions only. */
export function focusStatsInRange(
  sessions: readonly LocalFocusSession[],
  range: { from: string; to: string },
  days: readonly string[],
  taskTitle: (id: string) => string | null,
) {
  const perDay = new Map(days.map((d) => [d, 0]));
  const perTask = new Map<string, number>();
  let seconds = 0;
  let count = 0;
  let completedSessions = 0;
  for (const s of sessions) {
    if (s.kind !== "focus") continue;
    const d = localDate(new Date(s.startedAt));
    if (d < range.from || d >= range.to) continue;
    seconds += s.durationSeconds;
    count++;
    if (s.completed) completedSessions++;
    perDay.set(d, (perDay.get(d) ?? 0) + s.durationSeconds);
    const title = (s.taskId && taskTitle(s.taskId)) || "No task";
    perTask.set(title, (perTask.get(title) ?? 0) + s.durationSeconds);
  }
  return {
    minutes: Math.round(seconds / 60),
    sessions: count,
    completedSessions,
    minutesByDay: days.map((d) => ({ date: d, value: Math.round((perDay.get(d) ?? 0) / 60) })),
    byTask: [...perTask]
      .map(([title, s]) => ({ title, minutes: Math.round(s / 60) }))
      .filter((t) => t.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8),
  };
}
