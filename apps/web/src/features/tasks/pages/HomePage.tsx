import { useMemo, useState } from "react";
import { App as AntApp, Card, Collapse } from "antd";
import { groupTasks, localDate, taskGroupTitle, toggleDone, type TaskGroupKey } from "@productivity/domain";
import { ModulePage, QuickAdd, TaskEditor, TaskRow, useLocalRecords, useProjects, useSyncRuntime, type Task } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";

const OPEN_GROUPS: TaskGroupKey[] = ["overdue", "today", "upcoming", "someday"];

/**
 * Tasks, saved on this device first and synced in the background. Quick add
 * on top; then Overdue, Today, Upcoming and No date; finished tasks folded away
 * at the bottom.
 */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const { records, loading } = useLocalRecords<Task>("task");
  const [editing, setEditing] = useState<Task | null>(null);
  const { projects, byId } = useProjects();
  const projectName = (t: Task) => (t.projectId ? byId.get(t.projectId)?.title : undefined);

  const now = new Date();
  const today = localDate(now);
  const groups = useMemo(() => groupTasks(records, new Date(), localDate(new Date())), [records]);
  const openCount = OPEN_GROUPS.reduce((n, k) => n + groups[k].length, 0);

  const toggle = (task: Task) => void runtime.write("task", toggleDone(task, new Date()));

  return (
    <ModulePage
      eyebrow="Plan"
      title="Tasks"
      description={openCount ? `${openCount} to do. Saved on this device first, then synced.` : "Everything you need to do, by due date."}
    >
      <QuickAdd projects={projects} />

      {!loading && !records.length ? (
        <Card className="pp-card">
          <EmptyState text="No tasks yet. Add one above: type it, pick a date if it has one, press Enter." />
        </Card>
      ) : null}

      {OPEN_GROUPS.filter((k) => groups[k].length).map((key) => (
        <Card
          key={key}
          className="pp-card"
          title={taskGroupTitle[key]}
          extra={<span className="pp-label pp-num">{groups[key].length}</span>}
          styles={{ body: { padding: 6 } }}
        >
          {groups[key].map((task) => (
            <TaskRow key={task.id} task={task} now={now} today={today} onToggle={toggle} onOpen={setEditing} project={projectName(task)} />
          ))}
        </Card>
      ))}

      {groups.done.length ? (
        <Collapse
          ghost
          items={[
            {
              key: "done",
              label: <span className="pp-label">Done · {groups.done.length}</span>,
              children: groups.done.slice(0, 50).map((task) => (
                <TaskRow key={task.id} task={task} now={now} today={today} onToggle={toggle} onOpen={setEditing} />
              )),
            },
          ]}
        />
      ) : null}

      <TaskEditor
        task={editing}
        projects={projects}
        onClose={() => setEditing(null)}
        onSave={(task) => {
          void runtime.write("task", task);
          setEditing(null);
          void message.success("Task saved");
        }}
        onDelete={(task) => {
          void runtime.write("task", task, "delete");
          setEditing(null);
          void message.success("Task deleted");
        }}
      />
    </ModulePage>
  );
}

