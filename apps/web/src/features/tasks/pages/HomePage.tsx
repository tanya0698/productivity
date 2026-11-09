import { useMemo, useState } from "react";
import { App as AntApp, Button, Card, Collapse, DatePicker, Flex, Input, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import {
  groupTasks,
  localDate,
  newTask,
  taskGroupTitle,
  toggleDone,
  type TaskGroupKey,
} from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import { ModulePage, useLocalRecords, useSyncRuntime } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow, type Task } from "../components/TaskRow";
import { TaskEditor } from "../components/TaskEditor";
import { priorityOptions } from "../components/priorityOptions";

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
      <QuickAdd />

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
            <TaskRow key={task.id} task={task} now={now} today={today} onToggle={toggle} onOpen={setEditing} />
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

/** Type a task, optionally pick a date and priority, press Enter. */
function QuickAdd() {
  const runtime = useSyncRuntime();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Dayjs | null>(null);
  const [priority, setPriority] = useState<TaskPriority>(3);

  const add = async () => {
    if (!title.trim()) return;
    await runtime.write(
      "task",
      newTask(runtime.newId(), new Date(), { title, dueDate: due ? due.format("YYYY-MM-DD") : null, priority }),
    );
    setTitle("");
    setDue(null);
    setPriority(3);
  };

  return (
    <Flex gap={8} wrap>
      <Input
        size="large"
        prefix={<PlusOutlined />}
        placeholder="Add a task"
        aria-label="New task"
        value={title}
        maxLength={500}
        onChange={(e) => setTitle(e.target.value)}
        onPressEnter={() => void add()}
        style={{ flex: "1 1 320px" }}
      />
      <DatePicker
        size="large"
        value={due}
        onChange={setDue}
        placeholder="Due date"
        format="ddd D MMM"
        aria-label="Due date"
        style={{ width: 160 }}
      />
      <Select size="large" value={priority} onChange={setPriority} options={priorityOptions} aria-label="Priority" style={{ width: 140 }} />
      <Button size="large" type="primary" onClick={() => void add()} disabled={!title.trim()}>
        Add
      </Button>
    </Flex>
  );
}
