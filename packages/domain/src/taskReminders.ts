import type { LocalTask } from "./tasks.ts";
import { newReminder, rescheduleReminder, type LocalReminder } from "./reminders.ts";

/**
 * A task's (or a one-off event's) reminder, chosen relative to when it's due. A task with a due time
 * offers "at the time / 10 min / 1 hour / 1 day before"; one due on a day
 * offers "that morning / the morning before". A reminder set some other way
 * (on the Reminders page) shows as "custom" and is left alone.
 */
export type TaskReminderChoice = "none" | "at" | "10m" | "1h" | "1d" | "day9" | "prev9" | "custom";

type Due = Pick<LocalTask, "dueDate" | "dueAt">;

const MINUTE = 60_000;
const timed: { key: TaskReminderChoice; label: string; before: number }[] = [
  { key: "at", label: "At the due time", before: 0 },
  { key: "10m", label: "10 minutes before", before: 10 * MINUTE },
  { key: "1h", label: "1 hour before", before: 60 * MINUTE },
  { key: "1d", label: "1 day before", before: 24 * 60 * MINUTE },
];

/** 09:00 on a YYYY-MM-DD date, `shift` days away, on this device's clock. */
const morningOf = (date: string, shift = 0) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d + shift, 9, 0, 0, 0);
};

/** The options that make sense for this task's due date or time. */
export function taskReminderChoices(task: Due): { value: TaskReminderChoice; label: string }[] {
  const none = { value: "none" as const, label: "No reminder" };
  if (task.dueAt) return [none, ...timed.map((t) => ({ value: t.key, label: t.label }))];
  if (task.dueDate) {
    return [none, { value: "day9", label: "That morning at 9:00" }, { value: "prev9", label: "The morning before at 9:00" }];
  }
  return [none];
}

/** When the reminder for `choice` fires, or null for none/custom/no due date. */
export function taskReminderTime(task: Due, choice: TaskReminderChoice): Date | null {
  if (task.dueAt) {
    const t = timed.find((x) => x.key === choice);
    return t ? new Date(new Date(task.dueAt).getTime() - t.before) : null;
  }
  if (task.dueDate) {
    if (choice === "day9") return morningOf(task.dueDate);
    if (choice === "prev9") return morningOf(task.dueDate, -1);
  }
  return null;
}

/** Which option an existing reminder matches, so the editor can show it. */
export function taskReminderChoice(task: Due, reminder: Pick<LocalReminder, "remindAt" | "recurrenceRule"> | undefined): TaskReminderChoice {
  if (!reminder) return "none";
  if (reminder.recurrenceRule) return "custom";
  const at = new Date(reminder.remindAt).getTime();
  const match = taskReminderChoices(task).find((c) => c.value !== "none" && taskReminderTime(task, c.value)?.getTime() === at);
  return match?.value ?? "custom";
}

/**
 * The reminder writes that make a task's reminders match `choice`: reuse the
 * first existing one (so its id and history stay), delete any extras.
 */
export function planTaskReminder(
  task: Due & { id: string; title: string },
  choice: TaskReminderChoice,
  existing: readonly LocalReminder[],
  ctx: { now: Date; timezone: string; newId: () => string },
  /** What a new reminder links to: the task by default, or a calendar event. */
  link: { taskId: string } | { eventId: string } = { taskId: task.id },
): { put: LocalReminder[]; remove: LocalReminder[] } {
  const live = existing.filter((r) => !r.deletedAt);
  if (choice === "custom") return { put: [], remove: [] };
  const at = taskReminderTime(task, choice);
  if (!at) return { put: [], remove: live };
  const [keep, ...extra] = live;
  const put = keep
    ? rescheduleReminder(keep, { remindAt: at, recurrenceRule: null, timezone: ctx.timezone }, ctx.now)
    : newReminder(ctx.newId(), ctx.now, { remindAt: at, timezone: ctx.timezone, ...link });
  // Unchanged: nothing to write.
  if (keep && keep.remindAt === put.remindAt && keep.status === "scheduled" && !keep.lastHandledAt && !keep.recurrenceRule) {
    return { put: [], remove: extra };
  }
  return { put: [put], remove: extra };
}
