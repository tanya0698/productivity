import { describe, expect, it } from "vitest";
import { buildBackup, backupCounts, parseBackup, planImport, type BackupEntity } from "./backup.ts";
import { newGoal, newMilestone } from "./goals.ts";
import { newHabit, newHabitLog } from "./habits.ts";
import { newProject } from "./projects.ts";
import { newTask } from "./tasks.ts";
import { newReminder } from "./reminders.ts";

const now = new Date("2026-11-09T09:00:00Z");
const id = () => crypto.randomUUID();
let n = 0;
const freshId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function sample() {
  const g = newGoal(id(), now, { title: "Get fit" });
  const p = { ...newProject(id(), now, { title: "Training plan" }), goalId: g.id, userId: id() };
  const t = newTask(id(), now, { title: "Buy shoes", projectId: p.id });
  const h = { ...newHabit(id(), now, { title: "Run" }), goalId: g.id };
  const log = newHabitLog(id(), now, h.id, "2026-11-08");
  const ms = newMilestone(id(), now, g.id, "Run 5 km", 0);
  const r = newReminder(id(), now, { remindAt: new Date("2026-11-10T08:00:00Z"), timezone: "UTC", taskId: t.id });
  const deleted = { ...newTask(id(), now, { title: "Gone" }), deletedAt: now.toISOString() };
  return { g, p, t, h, log, ms, r, deleted };
}

describe("backups", () => {
  it("holds live records by type, without the owner", () => {
    const s = sample();
    const b = buildBackup({ goal: [s.g], project: [s.p], task: [s.t, s.deleted] }, now);
    expect(b.data.task!.map((x) => x.title)).toEqual(["Buy shoes"]);
    expect(b.data.project![0]).not.toHaveProperty("userId");
    expect(backupCounts(b)).toEqual([
      { entity: "goal", count: 1 },
      { entity: "project", count: 1 },
      { entity: "task", count: 1 },
    ]);
  });

  it("reads back what it wrote, and refuses other files plainly", () => {
    const b = buildBackup({}, now);
    expect(parseBackup(JSON.stringify(b))).toMatchObject({ ok: true });
    expect(parseBackup("not json")).toEqual({ ok: false, error: "This file isn't valid JSON." });
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({ ok: false, error: expect.stringContaining("isn't a Creedence backup") });
    expect(parseBackup(JSON.stringify({ ...b, version: 99 }))).toMatchObject({ ok: false, error: expect.stringContaining("newer version") });
  });

  it("imports into an empty account with fresh ids and links rewritten", () => {
    const s = sample();
    const b = buildBackup({ goal: [s.g], project: [s.p], task: [s.t], habit: [s.h], habit_log: [s.log], goal_milestone: [s.ms], reminder: [s.r] }, now);
    const plan = planImport(b, () => false, freshId, now);
    const by = (e: BackupEntity) => plan.writes.filter((w) => w.entity === e).map((w) => w.record);
    const [goal] = by("goal");
    const [proj] = by("project");
    const [task] = by("task");
    const [habit] = by("habit");
    expect(goal!.id).not.toBe(s.g.id);
    expect(proj).toMatchObject({ goalId: goal!.id, version: 0 });
    expect(task).toMatchObject({ projectId: proj!.id });
    expect(habit).toMatchObject({ goalId: goal!.id });
    expect(by("habit_log")[0]).toMatchObject({ habitId: habit!.id, date: "2026-11-08" });
    expect(by("goal_milestone")[0]).toMatchObject({ goalId: goal!.id });
    expect(by("reminder")[0]).toMatchObject({ taskId: task!.id });
    // Parents are written before their children.
    expect(plan.writes.map((w) => w.entity).indexOf("goal")).toBeLessThan(plan.writes.map((w) => w.entity).indexOf("habit_log"));
    expect(plan.summary.every((r) => r.existing === 0 && r.invalid === 0)).toBe(true);
  });

  it("skips what's already here, and links new records to it", () => {
    const s = sample();
    const b = buildBackup({ goal: [s.g], project: [s.p], task: [s.t] }, now);
    const plan = planImport(b, (e, i) => e === "goal" && i === s.g.id, freshId, now);
    expect(plan.writes.map((w) => w.entity)).toEqual(["project", "task"]);
    expect(plan.writes[0]!.record).toMatchObject({ goalId: s.g.id });
    expect(plan.summary.find((r) => r.entity === "goal")).toMatchObject({ existing: 1, added: 0 });
  });

  it("drops optional links to missing records, and skips children without their parent", () => {
    const s = sample();
    const b = buildBackup({ task: [s.t], habit_log: [s.log], reminder: [s.r] }, now);
    const plan = planImport(b, () => false, freshId, now);
    expect(plan.writes.find((w) => w.entity === "task")!.record).toMatchObject({ projectId: null });
    expect(plan.summary.find((r) => r.entity === "habit_log")).toMatchObject({ orphaned: 1, added: 0 });
  });

  it("counts records that don't fit the contracts as invalid", () => {
    const b = buildBackup({}, now);
    b.data.task = [{ id: id(), title: "" }, { nope: true } as never];
    const plan = planImport(b, () => false, freshId, now);
    expect(plan.writes).toHaveLength(0);
    expect(plan.summary).toEqual([{ entity: "task", added: 0, existing: 0, invalid: 2, orphaned: 0 }]);
  });
});
