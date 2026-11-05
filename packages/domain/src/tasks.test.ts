import { describe, expect, it } from "vitest";
import type { Task } from "@productivity/contracts";
import { canTransition, dueState, setTaskStatus } from "./tasks.ts";

const base: Task = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  createdAt: "2026-10-20T08:00:00.000Z",
  updatedAt: "2026-10-20T08:00:00.000Z",
  version: 1,
  deletedAt: null,
  projectId: null,
  parentTaskId: null,
  title: "Renew vehicle licence",
  description: null,
  status: "todo",
  priority: 1,
  dueDate: null,
  dueAt: null,
  startDate: null,
  completedAt: null,
  recurrenceRule: null,
  recurrenceTimezone: null,
};

const now = new Date("2026-10-21T10:42:00.000Z");

describe("task status", () => {
  it("sets completedAt when done and clears it when reopened", () => {
    const done = setTaskStatus(base, "done", now);
    expect(done.completedAt).toBe(now.toISOString());
    expect(setTaskStatus(done, "todo", now).completedAt).toBeNull();
  });

  it("refuses transitions the rules don't allow", () => {
    expect(canTransition("done", "in_progress")).toBe(false);
    expect(() => setTaskStatus({ ...base, status: "done" }, "in_progress", now)).toThrow();
  });
});

describe("dueState", () => {
  it("compares date-only due dates against the user's local today", () => {
    expect(dueState({ ...base, dueDate: "2026-10-20" }, now, "2026-10-21")).toBe("overdue");
    expect(dueState({ ...base, dueDate: "2026-10-21" }, now, "2026-10-21")).toBe("due_soon");
    expect(dueState({ ...base, dueDate: "2026-10-25" }, now, "2026-10-21")).toBe("upcoming");
  });

  it("uses the instant for timed due dates", () => {
    expect(dueState({ ...base, dueAt: "2026-10-21T17:00:00.000Z" }, now, "2026-10-21")).toBe("due_soon");
    expect(dueState({ ...base, dueAt: "2026-10-21T09:00:00.000Z" }, now, "2026-10-21")).toBe("overdue");
  });

  it("never flags finished tasks", () => {
    expect(dueState({ ...base, status: "done", dueDate: "2026-10-01" }, now, "2026-10-21")).toBe("none");
  });
});
