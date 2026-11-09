/** A task's due date, with its time when it has one: "Today", "Tomorrow 14:30", "Wed 12 Nov". */
export function formatTaskDue(task: { dueDate: string | null; dueAt: string | null }, today: string): string | null {
  if (task.dueDate) return formatDue(task.dueDate, today);
  if (!task.dueAt) return null;
  const at = new Date(task.dueAt);
  const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return `${formatDue(day, today)} ${formatClock(at)}`;
}

/** 14:30, or 2:30 PM, as the device prefers. */
export const formatClock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "Today", "Tomorrow", "Wed 12 Nov", or a full date further out. */
export function formatDue(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const due = new Date(y, m - 1, d);
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const days = Math.round((due.getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  const sameYear = y === ty;
  return due.toLocaleDateString(undefined, {
    weekday: Math.abs(days) < 7 ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}
