import { useMemo } from "react";
import { sortProjects, type LocalProject } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Project = LocalProject & { deletedAt: string | null };

/** The user's projects from local storage, sorted, with a lookup by id. */
export function useProjects() {
  const { records, loading } = useLocalRecords<Project>("project");
  return useMemo(() => {
    const projects = sortProjects(records);
    return { projects, byId: new Map(projects.map((p) => [p.id, p])), loading };
  }, [records, loading]);
}
