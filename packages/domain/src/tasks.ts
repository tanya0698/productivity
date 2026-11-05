import type { Task, TaskStatus } from "@productivity/contracts";

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
export function setTaskStatus(task: Task, to: TaskStatus, now: Date): Task {
  if (!canTransition(task.status, to)) {
    throw new Error(`Task cannot move from "${task.status}" to "${to}".`);
  }
  return {
    ...task,
    status: to,
    completedAt: to === "done" ? (task.completedAt ?? now.toISOString()) : null,
  };
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
  if (task.status === "done" || task.status === "cancelled") return "none";
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
