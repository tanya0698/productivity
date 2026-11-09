import type { Project } from "@productivity/contracts";
import { isDone, type LocalTask } from "./tasks.ts";

/** A project as stored on a device; `userId` arrives once the server has it. */
export type LocalProject = Omit<Project, "userId"> & { userId?: string };
export type ProjectStatus = Project["status"];

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "On hold",
  done: "Done",
  archived: "Archived",
};

export interface ProjectFields {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  goalId?: string | null;
}

export function newProject(id: string, now: Date, fields: ProjectFields): LocalProject {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    title: fields.title.trim(),
    description: fields.description?.trim() || null,
    status: "active",
    startDate: null,
    dueDate: fields.dueDate ?? null,
    goalId: fields.goalId ?? null,
  };
}

export function editProject<T extends LocalProject>(
  project: T,
  changes: Partial<Pick<LocalProject, "title" | "description" | "dueDate" | "status" | "goalId">>,
  now: Date,
): T {
  return {
    ...project,
    ...changes,
    title: (changes.title ?? project.title).trim() || project.title,
    description: changes.description === undefined ? project.description : changes.description?.trim() || null,
    updatedAt: now.toISOString(),
  };
}

export interface ProjectProgress {
  done: number;
  total: number;
  /** 0–100, rounded down so a project shows 100% only when everything is done. */
  percent: number;
}

/** Done vs all tasks in the project. Cancelled tasks count as finished. */
export function projectProgress(tasks: readonly Pick<LocalTask, "status">[]): ProjectProgress {
  const done = tasks.filter(isDone).length;
  return { done, total: tasks.length, percent: tasks.length ? Math.floor((done / tasks.length) * 100) : 0 };
}

const STATUS_ORDER: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2, archived: 3 };

/** Active first, then on hold, done, archived; within each, soonest due, then by name. */
export function sortProjects<T extends Pick<LocalProject, "status" | "dueDate" | "title">>(projects: readonly T[]): T[] {
  return [...projects].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );
}

/** Whether a project is offered when filing a task or note: not finished or archived. */
export const isOpenProject = (p: Pick<LocalProject, "status">) => p.status === "active" || p.status === "paused";

/** Group records by project id; records whose project isn't in `projects` count as unfiled (key null). */
export function byProject<T extends { projectId: string | null }>(
  items: readonly T[],
  projects: readonly Pick<LocalProject, "id">[],
): Map<string | null, T[]> {
  const known = new Set(projects.map((p) => p.id));
  const map = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.projectId && known.has(item.projectId) ? item.projectId : null;
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

/** The same task or note, no longer in any project (used when a project is deleted). */
export const unfile = <T extends { projectId: string | null; updatedAt: string }>(item: T, now: Date): T => ({
  ...item,
  projectId: null,
  updatedAt: now.toISOString(),
});
