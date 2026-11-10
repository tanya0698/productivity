import { useMemo } from "react";
import { Link } from "react-router-dom";
import { localDate, toggleDone, upNext } from "@productivity/domain";
import { TaskRow, useLocalRecords, useSyncRuntime, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton } from "@/components/ui/Skeletons";

/** Today's "Up next": overdue first, then today, then the soonest upcoming. Tick them off here. */
export default function SummaryWidget() {
  const runtime = useSyncRuntime();
  const { records } = useLocalRecords<Task>("task");
  const ready = useDataReady();
  const now = new Date();
  const today = localDate(now);
  const next = useMemo(() => upNext(records, new Date(), localDate(new Date()), 6), [records]);

  if (!next.length) {
    return ready || records.length ? <EmptyState compact text="Nothing due. Tasks with a date will line up here." /> : <RowsSkeleton rows={3} check={false} />;
  }
  return (
    <div style={{ margin: "-8px -12px" }}>
      {next.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          now={now}
          today={today}
          onToggle={(t) => void runtime.write("task", toggleDone(t, new Date()))}
        />
      ))}
      <div style={{ padding: "8px 12px 4px" }}>
        <Link to="/tasks">All tasks</Link>
      </div>
    </div>
  );
}
