import { describe, expect, it } from "vitest";
import { newReminder } from "./reminders.ts";
import { planTaskReminder, taskReminderChoice, taskReminderChoices, taskReminderTime } from "./taskReminders.ts";
import { groupTasks, localDate, newTask, taskDay } from "./tasks.ts";

const now = new Date("2026-11-09T08:00:00Z");
const ctx = { now, timezone: "UTC", newId: () => crypto.randomUUID() };
const timedTask = { ...newTask(crypto.randomUUID(), now, { title: "Dentist" }), dueAt: "2026-11-12T14:30:00.000Z" };
const dayTask = newTask(crypto.randomUUID(), now, { title: "Pay rent", dueDate: "2026-11-30" });

describe("task reminders", () => {
  it("offers choices that fit the due date or time", () => {
    expect(taskReminderChoices(timedTask).map((c) => c.value)).toEqual(["none", "at", "10m", "1h", "1d"]);
    expect(taskReminderChoices(dayTask).map((c) => c.value)).toEqual(["none", "day9", "prev9"]);
    expect(taskReminderChoices(newTask(crypto.randomUUID(), now, { title: "Someday" })).map((c) => c.value)).toEqual(["none"]);
  });

  it("works out the reminder time", () => {
    expect(taskReminderTime(timedTask, "1h")?.toISOString()).toBe("2026-11-12T13:30:00.000Z");
    const morning = taskReminderTime(dayTask, "prev9")!;
    expect([morning.getDate(), morning.getHours()]).toEqual([29, 9]);
  });

  it("recognises an existing reminder's choice, or calls it custom", () => {
    const at10 = newReminder("r", now, { remindAt: new Date("2026-11-12T14:20:00Z"), timezone: "UTC", taskId: timedTask.id });
    expect(taskReminderChoice(timedTask, at10)).toBe("10m");
    expect(taskReminderChoice(timedTask, { ...at10, remindAt: "2026-11-12T11:11:00.000Z" })).toBe("custom");
    expect(taskReminderChoice(timedTask, undefined)).toBe("none");
  });

  it("creates, moves, keeps or removes the task's reminder", () => {
    const created = planTaskReminder(timedTask, "at", [], ctx);
    expect(created.put).toHaveLength(1);
    expect(created.put[0]).toMatchObject({ taskId: timedTask.id, remindAt: "2026-11-12T14:30:00.000Z" });

    const existing = created.put[0]!;
    expect(planTaskReminder(timedTask, "at", [existing], ctx)).toEqual({ put: [], remove: [] });
    const moved = planTaskReminder(timedTask, "1d", [existing], ctx);
    expect(moved.put[0]).toMatchObject({ id: existing.id, remindAt: "2026-11-11T14:30:00.000Z" });
    expect(planTaskReminder(timedTask, "none", [existing], ctx).remove).toEqual([existing]);
    expect(planTaskReminder(timedTask, "custom", [existing], ctx)).toEqual({ put: [], remove: [] });
  });
});

describe("timed tasks", () => {
  it("fall on their local day, in time order before untimed ones", () => {
    const today = localDate(now);
    const later = { ...newTask("b", now, { title: "Later" }), dueAt: new Date(now.getTime() + 3 * 3600_000).toISOString() };
    const sooner = { ...newTask("a", now, { title: "Sooner" }), dueAt: new Date(now.getTime() + 3600_000).toISOString() };
    const allDay = newTask("c", now, { title: "Any time", dueDate: today });
    expect(taskDay(sooner)).toBe(localDate(new Date(sooner.dueAt)));
    const groups = groupTasks([allDay, later, sooner], now, today);
    const sameDay = [...groups.today, ...groups.upcoming].filter((t) => taskDay(t) === today).map((t) => t.title);
    expect(sameDay.indexOf("Sooner")).toBeLessThan(sameDay.indexOf("Later"));
  });
});
