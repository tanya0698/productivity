import React, { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  editTask,
  isOpenProject,
  localDate,
  planTaskReminder,
  priorityLabel,
  taskReminderChoice,
  taskReminderChoices,
  type TaskReminderChoice,
} from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import Sheet from "../../../components/Sheet";
import { Button, Chips, DateTimeButton, Field, Input } from "../../../components/Field";
import { askForNotifications } from "../../../shared/reminders/notifications";
import { deviceTimezone, type Reminder } from "../../../shared/reminders/active";
import { useProjects } from "../../../shared/projects";
import { usePalette } from "../../../theme";
import type { Task } from "./TaskRow";
import { useConfirm } from "../../../components/ConfirmProvider";

const priorities = ([1, 2, 3, 4] as TaskPriority[]).map((v) => ({ value: String(v), label: priorityLabel[v] }));

/** "YYYY-MM-DD" on this phone's clock → a Date at local midnight. */
const dayDate = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** A time makes it `dueAt`; a date alone `dueDate`; never both (the same rule as the web editor). */
function dueFrom(day: Date | null, time: Date | null): { dueDate: string | null; dueAt: string | null } {
  if (!day) return { dueDate: null, dueAt: null };
  if (!time) return { dueDate: localDate(day), dueAt: null };
  const at = new Date(day);
  at.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return { dueDate: null, dueAt: at.toISOString() };
}

/**
 * Edit a task: title, notes, due date and time, reminder, priority, or delete
 * it. The task's reminder is saved here too, exactly as on the web.
 */
export default function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const runtime = useSyncRuntime();
  const { confirm } = useConfirm();
  const p = usePalette();
  const { records: reminders, loading } = useLocalRecords<Reminder>("reminder");
  const own = useMemo(() => (task ? reminders.filter((r) => r.taskId === task.id) : []), [reminders, task]);
  const live = own.filter((r) => r.status !== "dismissed" && r.status !== "done");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [remind, setRemind] = useState<TaskReminderChoice>("none");
  const [projectId, setProjectId] = useState("");
  const { projects } = useProjects();
  // Open projects, plus the task's own even when finished, so editing never drops it.
  const projectOptions = [
    { value: "", label: "None" },
    ...projects.filter((x) => isOpenProject(x) || x.id === task?.projectId).map((x) => ({ value: x.id, label: x.title })),
  ];

  const id = task?.id;
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.description ?? "");
    setDay(task.dueAt ? new Date(task.dueAt) : task.dueDate ? dayDate(task.dueDate) : null);
    setTime(task.dueAt ? new Date(task.dueAt) : null);
    setPriority(task.priority);
    setProjectId(task.projectId ?? "");
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The reminder choice waits for reminders to load: showing "No reminder"
  // early and then saving would delete the reminder the task already has.
  useEffect(() => {
    if (task && !loading) setRemind(taskReminderChoice(task, live[0]));
  }, [id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = taskReminderChoices(dueFrom(day, time));
  const options = [...choices, ...(remind === "custom" ? [{ value: "custom" as const, label: "Custom (set in Reminders)" }] : [])];
  // A choice that no longer fits (time removed, date cleared) falls back to none.
  useEffect(() => {
    if (remind !== "custom" && !choices.some((c) => c.value === remind)) setRemind("none");
  }, [remind, choices]);

  const save = () => {
    if (!task || loading) return;
    const updated = editTask(
      task,
      { title, description: notes.trim() ? notes.trim() : null, ...dueFrom(day, time), priority, projectId: projectId || null },
      new Date(),
    );
    void runtime.write("task", updated);
    const plan = planTaskReminder(updated, remind, live, { now: new Date(), timezone: deviceTimezone(), newId: () => runtime.newId() });
    for (const r of plan.put) void runtime.write("reminder", r);
    for (const r of plan.remove) void runtime.write("reminder", r, "delete");
    if (plan.put.length) void askForNotifications();
    onClose();
  };

  const remove = () =>
    task &&
    void confirm({ title: "Delete this task?", body: task.title, confirmLabel: "Delete", destructive: true }).then((ok) => {
      if (ok) void (() => {
          // Its reminders go with it, so a deleted task never alerts.
          for (const r of own) void runtime.write("reminder", r, "delete");
          void runtime.write("task", task, "delete");
          onClose();
        })();
    });

  return (
    <Sheet
      open={!!task}
      title="Task"
      onClose={onClose}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel="Delete task" hitSlop={10} onPress={remove}>
          <Ionicons name="trash-outline" size={20} color={p.errorText} />
        </Pressable>
      }
    >
      <Field label="Title">
        <Input accessibilityLabel="Title" value={title} onChangeText={setTitle} maxLength={500} />
      </Field>
      <Field label="Notes">
        <Input
          accessibilityLabel="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Details, links, anything to remember"
          multiline
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
      </Field>
      <Field label="Due">
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 3 }}>
            <DateTimeButton
              label="Due date"
              mode="date"
              value={day}
              placeholder="No date"
              onChange={setDay}
              onClear={() => {
                setDay(null);
                setTime(null);
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <DateTimeButton label="Due time" mode="time" value={time} placeholder="Any time" onChange={setTime} onClear={() => setTime(null)} disabled={!day} />
          </View>
        </View>
      </Field>
      <Field label="Reminder" hint={!day ? "Set a due date to add a reminder." : undefined}>
        {day || remind === "custom" ? <Chips value={remind} options={options} onChange={setRemind} /> : null}
      </Field>
      <Field label="Priority">
        <Chips value={String(priority)} options={priorities} onChange={(v) => setPriority(Number(v) as TaskPriority)} />
      </Field>
      {projects.length ? (
        <Field label="Project">
          <Chips value={projectId} options={projectOptions} onChange={setProjectId} />
        </Field>
      ) : null}
      <Button kind="primary" label="Save" onPress={save} disabled={loading || !title.trim()} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
