import { useMemo } from "react";
import { indexLogs, localDate, logToUndo, newHabitLog, type LocalHabit, type LocalHabitLog } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@/shared";

export type Habit = LocalHabit & { deletedAt: string | null };
export type HabitLog = LocalHabitLog & { deletedAt: string | null };

/** Habits (live, not archived, oldest first), their logs indexed by day, and tick / untick. */
export function useHabits() {
  const runtime = useSyncRuntime();
  const { records: habits, loading } = useLocalRecords<Habit>("habit");
  const { records: logs } = useLocalRecords<HabitLog>("habit_log");

  const active = useMemo(
    () => habits.filter((h) => !h.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [habits],
  );
  const index = useMemo(() => indexLogs(logs), [logs]);

  /** Log one completion (append-only: a new record each time). */
  const tick = (h: Habit, date = localDate(new Date())) => runtime.write("habit_log", newHabitLog(runtime.newId(), new Date(), h.id, date));
  /** Remove the latest completion on that day. */
  const untick = (h: Habit, date = localDate(new Date())) => {
    const last = logToUndo(logs, h.id, date);
    return last ? runtime.write("habit_log", last, "delete") : Promise.resolve();
  };

  return { habits: active, archived: habits.filter((h) => h.archivedAt), logs, index, loading, tick, untick };
}
