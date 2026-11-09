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
