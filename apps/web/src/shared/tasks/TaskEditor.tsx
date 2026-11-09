import { useEffect } from "react";
import { Button, DatePicker, Drawer, Flex, Form, Input, Popconfirm, Select, TimePicker } from "antd";
import { BellOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import {
  editTask,
  planTaskReminder,
  taskReminderChoice,
  taskReminderChoices,
  type TaskReminderChoice,
} from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import type { Task } from "./TaskRow";
import { priorityOptions } from "./priorityOptions";
import { ProjectSelect } from "../projects/ProjectSelect";
import type { Project } from "../projects/useProjects";
import { deviceTimezone, useReminders } from "../reminders/useReminders";
import { IconButton } from "@/components/ui/IconButton";

interface Values {
  title: string;
  description?: string;
  due?: Dayjs | null;
  time?: Dayjs | null;
  remind: TaskReminderChoice;
  priority: TaskPriority;
  projectId?: string | null;
}

/** The task's due fields from the form: a time makes it `dueAt`, otherwise `dueDate` (never both). */
function dueFrom(v: Pick<Values, "due" | "time">): { dueDate: string | null; dueAt: string | null } {
  if (!v.due) return { dueDate: null, dueAt: null };
  if (!v.time) return { dueDate: v.due.format("YYYY-MM-DD"), dueAt: null };
  const at = v.due.hour(v.time.hour()).minute(v.time.minute()).second(0).millisecond(0);
  return { dueDate: null, dueAt: at.toDate().toISOString() };
}

/**
 * Edit a task in a side panel: title, notes, due date and time, reminder,
 * priority, project, or delete it. The task's reminder is saved here too.
 */
export function TaskEditor({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  projects: readonly Project[];
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [form] = Form.useForm<Values>();
  const runtime = useSyncRuntime();
  const { records: reminders, loading: remindersLoading } = useReminders();
  const own = task ? reminders.filter((r) => r.taskId === task.id) : [];
  const live = own.filter((r) => r.status !== "dismissed" && r.status !== "done");

  // Re-reading the form only when a different task opens, not on every sync.
  const taskId = task?.id;
  useEffect(() => {
    if (!task) return;
    const due = task.dueAt ? dayjs(task.dueAt) : task.dueDate ? dayjs(task.dueDate) : null;
    form.setFieldsValue({
      title: task.title,
      description: task.description ?? "",
      due,
      time: task.dueAt ? dayjs(task.dueAt) : null,
      priority: task.priority,
      projectId: task.projectId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, form]);

  // The reminder choice waits for reminders to load: showing "No reminder"
  // early and then saving would delete the reminder the task already has.
  useEffect(() => {
    if (!task || remindersLoading) return;
    form.setFieldValue("remind", taskReminderChoice(task, live[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, remindersLoading, form]);

  const due = Form.useWatch("due", form);
  const time = Form.useWatch("time", form);
  const remind = Form.useWatch("remind", form);
  const choices = taskReminderChoices(dueFrom({ due, time }));
  const options = [
    ...choices,
    ...(remind === "custom" ? [{ value: "custom" as const, label: "Custom (set on the Reminders page)" }] : []),
  ];

  // A choice that no longer fits (time removed, date cleared) falls back to none.
  useEffect(() => {
    if (remind && remind !== "custom" && !choices.some((c) => c.value === remind)) form.setFieldValue("remind", "none");
  }, [remind, choices, form]);

  const save = (v: Values) => {
    if (!task || remindersLoading) return;
    const updated = editTask(
      task,
      {
        title: v.title,
        description: v.description?.trim() ? v.description.trim() : null,
        ...dueFrom(v),
        priority: v.priority,
        projectId: v.projectId ?? null,
      },
      new Date(),
    );
    onSave(updated);
    const plan = planTaskReminder(updated, v.remind ?? "none", live, {
      now: new Date(),
      timezone: deviceTimezone(),
      newId: () => runtime.newId(),
    });
    for (const r of plan.put) void runtime.write("reminder", r);
    for (const r of plan.remove) void runtime.write("reminder", r, "delete");
  };

  const remove = (t: Task) => {
    // Its reminders go with it, so a deleted task never alerts.
    for (const r of own) void runtime.write("reminder", r, "delete");
    onDelete(t);
  };

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      title={<span className="pp-label">Task</span>}
      size={440}
      destroyOnHidden
      extra={
        task ? (
          <Popconfirm title="Delete this task?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(task)}>
            <IconButton danger icon={<DeleteOutlined />} tip="Delete task" />
          </Popconfirm>
        ) : null
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save} initialValues={{ remind: "none" }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: "Give the task a title." }]}>
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item name="description" label="Notes">
          <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Details, links, anything to remember" />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item name="due" label="Due" style={{ flex: 3 }}>
            <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" placeholder="No date" />
          </Form.Item>
          <Form.Item name="time" label="Time" style={{ flex: 2 }}>
            <TimePicker
              style={{ width: "100%" }}
              format="HH:mm"
              minuteStep={5}
              needConfirm={false}
              placeholder="Any time"
              disabled={!due}
            />
          </Form.Item>
        </Flex>
        <Form.Item name="remind" label="Reminder" extra={!due ? "Set a due date to add a reminder." : undefined}>
          <Select options={options} suffixIcon={<BellOutlined />} disabled={!due && remind !== "custom"} aria-label="Reminder" />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
            <Select options={priorityOptions} />
          </Form.Item>
          <Form.Item name="projectId" label="Project" style={{ flex: 1 }}>
            <ProjectSelect projects={projects} />
          </Form.Item>
        </Flex>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={remindersLoading}>
            Save
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
