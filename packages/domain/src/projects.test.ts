import { describe, expect, it } from "vitest";
import { project } from "@productivity/contracts";
import { byProject, editProject, newProject, projectProgress, sortProjects, unfile } from "./projects.ts";
import { newTask } from "./tasks.ts";

const now = new Date("2026-11-09T09:00:00.000Z");
const id = () => crypto.randomUUID();

describe("projects", () => {
  it("creates a valid, active project", () => {
    const p = newProject(id(), now, { title: "  Kitchen renovation ", description: "  " });
    expect(p).toMatchObject({ title: "Kitchen renovation", description: null, status: "active", version: 0 });
    expect(project.omit({ userId: true }).safeParse(p).success).toBe(true);
  });

  it("edits without losing the title to whitespace", () => {
    const p = newProject(id(), now, { title: "Kitchen" });
    const later = new Date("2026-11-10T09:00:00.000Z");
    expect(editProject(p, { title: "   ", status: "paused" }, later)).toMatchObject({
      title: "Kitchen",
      status: "paused",
      updatedAt: later.toISOString(),
    });
    expect(editProject(p, { description: " Tiles first " }, later).description).toBe("Tiles first");
  });

  it("counts progress, with cancelled as finished", () => {
    const t = (status: "todo" | "done" | "cancelled") => ({ status });
    expect(projectProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
    expect(projectProgress([t("todo"), t("done"), t("cancelled")])).toEqual({ done: 2, total: 3, percent: 66 });
    expect(projectProgress([t("done")]).percent).toBe(100);
  });

  it("sorts active first, then by due date and name", () => {
    const mk = (title: string, status: "active" | "paused" | "done" | "archived", dueDate: string | null = null) => ({
      title,
      status,
      dueDate,
    });
    const sorted = sortProjects([
      mk("Old", "archived"),
      mk("beta", "active"),
      mk("Alpha", "active"),
      mk("Soon", "active", "2026-11-20"),
      mk("Waiting", "paused", "2026-11-01"),
      mk("Shipped", "done"),
    ]);
    expect(sorted.map((p) => p.title)).toEqual(["Soon", "Alpha", "beta", "Waiting", "Shipped", "Old"]);
  });

  it("groups tasks by project, treating unknown projects as unfiled", () => {
    const p = newProject(id(), now, { title: "Kitchen" });
    const inside = newTask(id(), now, { title: "Pick tiles", projectId: p.id });
    const loose = newTask(id(), now, { title: "Call mum" });
    const orphan = newTask(id(), now, { title: "From a deleted project", projectId: id() });
    const groups = byProject([inside, loose, orphan], [p]);
    expect(groups.get(p.id)).toEqual([inside]);
    expect(groups.get(null)).toEqual([loose, orphan]);
  });

  it("unfiles a task", () => {
    const task = newTask(id(), now, { title: "Pick tiles", projectId: id() });
    const later = new Date("2026-11-10T09:00:00.000Z");
    expect(unfile(task, later)).toMatchObject({ projectId: null, updatedAt: later.toISOString() });
  });
});
