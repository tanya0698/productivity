import React from "react";
import { groupTasks, localDate } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import TaskRow, { type Task } from "../components/TaskRow";
import { go } from "../../../navigation/ref";

/** Overdue and today's tasks, tickable from the Today screen. */
export default function TodayWidget() {  const { records } = useLocalRecords<Task>("task");
  const now = new Date();
  const today = localDate(now);
  const groups = groupTasks(records, now, today);
  const due = [...groups.overdue, ...groups.today];
  return (
    <>
      {due.length ? (
        due.slice(0, 6).map((t, i) => <TaskRow key={t.id} task={t} now={now} today={today} first={i === 0} onPress={() => go("tasks", { task: t.id })} />)
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          {records.length ? "Nothing due today." : "No tasks yet. Capture one above."}
        </Text>
      )}
      <FootLink label={due.length > 6 ? `All tasks · ${due.length - 6} more due` : "All tasks"} onPress={() => go("tasks")} />
    </>
  );
}
