import { useMemo } from "react";
import { Link } from "react-router-dom";
import { localDate, toggleDone, upNext } from "@productivity/domain";
import { TaskRow, useLocalRecords, useSyncRuntime, type Task } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";

/** Today's "Up next": overdue first, then today, then the soonest upcoming. Tick them off here. */
export default function SummaryWidget() {
  const runtime = useSyncRuntime();
  const { records } = useLocalRecords<Task>("task");
  const now = new Date();
  const today = localDate(now);
  const next = useMemo(() => upNext(records, new Date(), localDate(new Date()), 6), [records]);

  if (!next.length) {
    return <EmptyState compact text="Nothing due. Tasks with a date will line up here." />;
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
