import { useMemo } from "react";
import { sortProjects, type LocalProject } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Project = LocalProject & { deletedAt: string | null };

/** The user's projects from the phone's store, sorted (active first), with a lookup by id. */
export function useProjects() {
  const { records, loading } = useLocalRecords<Project>("project");
  return useMemo(() => {
    const projects = sortProjects(records);
    return { projects, byId: new Map(projects.map((p) => [p.id, p])), loading };
  }, [records, loading]);
}

/** "Today", "Tomorrow", "Wed 12 Nov", or a full date further out (as on the web). */
export function formatDue(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const due = new Date(y, m - 1, d);
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const days = Math.round((due.getTime() - new Date(ty, tm - 1, td).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return due.toLocaleDateString(undefined, {
    weekday: Math.abs(days) < 7 ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: y === ty ? undefined : "numeric",
  });
}
