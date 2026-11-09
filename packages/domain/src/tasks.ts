import type { Task, TaskPriority, TaskStatus } from "@productivity/contracts";

/**
 * A task as stored on a device. `userId` is absent until the server has seen
 * it; the server sets the owner from the signed-in user, never from the client.
 */
export type LocalTask = Omit<Task, "userId"> & { userId?: string };

/** Which status changes are allowed. `done` and `cancelled` can be reopened. */
const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  inbox: ["todo", "in_progress", "done", "cancelled"],
  todo: ["inbox", "in_progress", "done", "cancelled"],
  in_progress: ["todo", "done", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || transitions[from].includes(to);
}

/**
 * Apply a status change, keeping `completedAt` consistent with it.
 * Throws on a transition the rules don't allow, so callers can't write one.
 */
export function setTaskStatus<T extends Pick<Task, "status" | "completedAt">>(task: T, to: TaskStatus, now: Date): T {
  if (!canTransition(task.status, to)) {
    throw new Error(`Task cannot move from "${task.status}" to "${to}".`);
  }
  return {
    ...task,
    status: to,
    completedAt: to === "done" ? (task.completedAt ?? now.toISOString()) : null,
  };
}

export const isDone = (task: Pick<Task, "status">) => task.status === "done" || task.status === "cancelled";

/** Tick or untick: done ↔ to do. */
export function toggleDone<T extends Pick<Task, "status" | "completedAt" | "updatedAt">>(task: T, now: Date): T {
  return { ...setTaskStatus(task, isDone(task) ? "todo" : "done", now), updatedAt: now.toISOString() };
}

export type DueState = "overdue" | "due_soon" | "upcoming" | "none";

/**
 * How a task's due date should be shown (plan §4.4: red overdue, amber due soon).
 *
 * `today` is the user's local calendar date (YYYY-MM-DD), passed in rather than
 * derived here, because "today" depends on the user's timezone, not the server's.
 */
export function dueState(
  task: Pick<Task, "status" | "dueDate" | "dueAt">,
  now: Date,
  today: string,
  soonMs = 24 * 60 * 60 * 1000,
): DueState {
  if (isDone(task)) return "none";
  if (task.dueAt) {
    const delta = new Date(task.dueAt).getTime() - now.getTime();
    if (delta < 0) return "overdue";
    return delta <= soonMs ? "due_soon" : "upcoming";
  }
  if (task.dueDate) {
    if (task.dueDate < today) return "overdue";
    return task.dueDate === today ? "due_soon" : "upcoming";
  }
  return "none";
}

/** The user's local calendar date as YYYY-MM-DD: what "today" means for date-only due dates. */
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** `localDate` shifted by whole days, e.g. tomorrow = addDays(today, 1). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d + days));
}

export interface NewTaskFields {
  title: string;
  dueDate?: string | null;
  priority?: TaskPriority;
  description?: string | null;
  projectId?: string | null;
}

export function newTask(id: string, now: Date, fields: NewTaskFields): LocalTask {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    projectId: fields.projectId ?? null,
    parentTaskId: null,
    title: fields.title.trim(),
    description: fields.description ?? null,
    status: "todo",
    priority: fields.priority ?? 3,
    dueDate: fields.dueDate ?? null,
    dueAt: null,
    startDate: null,
    completedAt: null,
    recurrenceRule: null,
    recurrenceTimezone: null,
  };
}

export function editTask<T extends LocalTask>(
  task: T,
  changes: Partial<Pick<LocalTask, "title" | "description" | "dueDate" | "priority" | "projectId">>,
  now: Date,
): T {
  return {
    ...task,
    ...changes,
    title: (changes.title ?? task.title).trim() || task.title,
    updatedAt: now.toISOString(),
  };
}

/** Priority as words, for the label shown beside its icon (never colour alone, plan §4.4). */
export const priorityLabel: Record<TaskPriority, string> = { 1: "Urgent", 2: "High", 3: "Normal", 4: "Low" };

export type TaskGroupKey = "overdue" | "today" | "upcoming" | "someday" | "done";

export const taskGroupTitle: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  someday: "No date",
  done: "Done",
};

function compareOpen(a: LocalTask, b: LocalTask): number {
  const ad = a.dueDate ?? a.dueAt?.slice(0, 10) ?? "9999-12-31";
  const bd = b.dueDate ?? b.dueAt?.slice(0, 10) ?? "9999-12-31";
  return ad.localeCompare(bd) || a.priority - b.priority || a.createdAt.localeCompare(b.createdAt);
}

/**
 * Tasks in the groups the Tasks page and Today show, each sorted: open tasks by
 * due date, then priority, then age; done tasks most recently finished first.
 */
export function groupTasks<T extends LocalTask>(tasks: readonly T[], now: Date, today: string): Record<TaskGroupKey, T[]> {
  const groups: Record<TaskGroupKey, T[]> = { overdue: [], today: [], upcoming: [], someday: [], done: [] };
  for (const t of tasks) {
    if (isDone(t)) {
      groups.done.push(t);
      continue;
    }
    const state = dueState(t, now, today);
    if (state === "overdue") groups.overdue.push(t);
    else if (state === "due_soon" && (t.dueDate === today || t.dueAt?.slice(0, 10) === today)) groups.today.push(t);
    else if (state === "none") groups.someday.push(t);
    else groups.upcoming.push(t);
  }
  for (const key of ["overdue", "today", "upcoming", "someday"] as const) groups[key].sort(compareOpen);
  groups.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return groups;
}

/** What Today's "Up next" shows: overdue first, then today, then the soonest upcoming. */
export function upNext<T extends LocalTask>(tasks: readonly T[], now: Date, today: string, limit = 5): T[] {
  const g = groupTasks(tasks, now, today);
  return [...g.overdue, ...g.today, ...g.upcoming].slice(0, limit);
}
