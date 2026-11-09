import { describe, expect, it } from "vitest";
import { task as taskSchema } from "@productivity/contracts";
import {
  addDays,
  editTask,
  groupTasks,
  localDate,
  newTask,
  toggleDone,
  upNext,
  type LocalTask,
} from "./tasks.ts";

const now = new Date(2026, 10, 9, 10, 0); // 9 Nov 2026, 10:00 local
const today = localDate(now);
let n = 0;
const make = (title: string, fields: Partial<LocalTask> = {}): LocalTask => ({
  ...newTask(`00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, now, { title }),
  ...fields,
});

describe("dates", () => {
  it("formats the local calendar date and moves by days across month ends", () => {
    expect(today).toBe("2026-11-09");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("newTask / editTask", () => {
  it("creates a task the server's schema accepts", () => {
    const t = newTask("00000000-0000-4000-8000-0000000000aa", now, { title: "  Renew licence  ", dueDate: today, priority: 1 });
    const editable = taskSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });
    expect(editable.safeParse(t).success).toBe(true);
    expect(t).toMatchObject({ title: "Renew licence", status: "todo", priority: 1, dueDate: today, version: 0 });
  });

  it("keeps the old title rather than saving a blank one", () => {
    const t = make("Groceries");
    expect(editTask(t, { title: "   " }, now).title).toBe("Groceries");
    expect(editTask(t, { title: " Milk " }, now).title).toBe("Milk");
  });

  it("ticks and unticks, keeping completedAt in step", () => {
    const done = toggleDone(make("Call bank"), now);
    expect(done).toMatchObject({ status: "done", completedAt: now.toISOString() });
    expect(toggleDone(done, now)).toMatchObject({ status: "todo", completedAt: null });
  });
});

describe("groupTasks", () => {
  it("puts each task in one group, sorted by due date then priority", () => {
    const late = make("Late", { dueDate: addDays(today, -2) });
    const todayLow = make("Today, low", { dueDate: today, priority: 4 });
    const todayUrgent = make("Today, urgent", { dueDate: today, priority: 1 });
    const later = make("Later", { dueDate: addDays(today, 5) });
    const soon = make("Tomorrow", { dueDate: addDays(today, 1) });
    const undated = make("Someday");
    const finished = toggleDone(make("Finished", { dueDate: addDays(today, -1) }), now);

    const g = groupTasks([late, todayLow, todayUrgent, later, soon, undated, finished], now, today);
    expect(g.overdue.map((t) => t.title)).toEqual(["Late"]);
    expect(g.today.map((t) => t.title)).toEqual(["Today, urgent", "Today, low"]);
    expect(g.upcoming.map((t) => t.title)).toEqual(["Tomorrow", "Later"]);
    expect(g.someday.map((t) => t.title)).toEqual(["Someday"]);
    expect(g.done.map((t) => t.title)).toEqual(["Finished"]);
  });

  it("never calls a finished task overdue", () => {
    const g = groupTasks([toggleDone(make("Old", { dueDate: "2026-01-01" }), now)], now, today);
    expect(g.overdue).toHaveLength(0);
    expect(g.done).toHaveLength(1);
  });
});

describe("upNext", () => {
  it("shows overdue, then today, then upcoming, never undated or done", () => {
    const tasks = [
      make("Upcoming", { dueDate: addDays(today, 3) }),
      make("Undated"),
      make("Today", { dueDate: today }),
      make("Overdue", { dueDate: addDays(today, -1) }),
      toggleDone(make("Done", { dueDate: today }), now),
    ];
    expect(upNext(tasks, now, today).map((t) => t.title)).toEqual(["Overdue", "Today", "Upcoming"]);
    expect(upNext(tasks, now, today, 1)).toHaveLength(1);
  });
});
