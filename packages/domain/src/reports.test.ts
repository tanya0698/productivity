import { describe, expect, it } from "vitest";
import { buildReport, change, previousRange, rangeDays, reportToCsv, type ReportInput } from "./reports.ts";
import { newTask, setTaskStatus } from "./tasks.ts";
import { newHabit, newHabitLog } from "./habits.ts";
import { sessionFrom, startTimer } from "./focus.ts";
import { newGoal, newMilestone, toggleMilestone } from "./goals.ts";
import { newProject } from "./projects.ts";
import { newEvent } from "./calendar.ts";

const at = (d: number, h = 12) => new Date(2026, 10, d, h); // November 2026, local
const id = () => crypto.randomUUID();
const empty: ReportInput = { tasks: [], notes: [], projects: [], sessions: [], habits: [], habitLogs: [], goals: [], milestones: [], events: [], eventExceptions: [] };
const week = { from: "2026-11-02", to: "2026-11-09" }; // Mon 2 – Sun 8

describe("report ranges", () => {
  it("lists days and the period before", () => {
    expect(rangeDays(week)).toHaveLength(7);
    expect(previousRange(week)).toEqual({ from: "2026-10-26", to: "2026-11-02" });
    expect(change(12, 10)).toBe(20);
    expect(change(5, 0)).toBeNull();
  });
});

describe("buildReport", () => {
  it("counts tasks completed per day, on time, and overdue", () => {
    const p = newProject(id(), at(1), { title: "Kitchen" });
    const done = (title: string, completed: Date, due: string | null, projectId: string | null = null) =>
      setTaskStatus({ ...newTask(id(), at(1), { title, dueDate: due, projectId }), createdAt: at(1).toISOString() }, "done", completed);
    const tasks = [
      done("a", at(3), "2026-11-03", p.id), // on time
      done("b", at(5), "2026-11-04"), // late
      done("c", at(5), null, p.id),
      done("outside", at(12), null),
      newTask(id(), at(4), { title: "late and open", dueDate: "2026-11-06" }),
    ];
    const r = buildReport({ ...empty, tasks, projects: [p] }, week, "2026-11-09");
    expect(r.tasks.completed).toBe(3);
    expect(r.tasks.completedByDay.find((d) => d.date === "2026-11-05")?.value).toBe(2);
    expect(r.tasks.onTimeRate).toBe(33); // a on time; b late; the open one late
    expect(r.tasks.overdue).toBe(1);
    expect(r.tasks.created).toBe(1);
    expect(r.projects[0]).toMatchObject({ title: "Kitchen", completedInRange: 2, open: 0, total: 2 });
  });

  it("totals focus per day and per task", () => {
    const t = newTask(id(), at(1), { title: "Write report" });
    const s = (day: number, minutes: number, taskId: string | null = null) =>
      sessionFrom(id(), startTimer("focus", minutes, { taskId }, at(day, 9)), new Date(at(day, 9).getTime() + minutes * 60_000), true);
    const r = buildReport({ ...empty, tasks: [t], sessions: [s(3, 25, t.id), s(3, 50, t.id), s(4, 25)] }, week, "2026-11-09");
    expect(r.focus).toMatchObject({ minutes: 100, sessions: 3 });
    expect(r.focus.minutesByDay.find((d) => d.date === "2026-11-03")?.value).toBe(75);
    expect(r.focus.byTask).toEqual([
      { title: "Write report", minutes: 75 },
      { title: "No task", minutes: 25 },
    ]);
  });

  it("measures habit consistency on due days only", () => {
    const h = newHabit(id(), at(1), { title: "Run", daysOfWeek: [1, 3, 5] }); // Mon, Wed, Fri
    const logs = ["2026-11-02", "2026-11-06"].map((d) => newHabitLog(id(), at(9), h.id, d));
    const r = buildReport({ ...empty, habits: [h], habitLogs: logs }, week, "2026-11-09");
    expect(r.habits.rows[0]).toMatchObject({ due: 3, met: 2, rate: 67 });
    expect(r.habits.consistency).toBe(67);
  });

  it("counts calendar hours and goal milestones done in the range", () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ev = newEvent(id(), at(1), { title: "Stand-up", recurrenceRule: "FREQ=DAILY" }, { allDay: false, start: at(2, 9), end: new Date(at(2, 9).getTime() + 30 * 60_000), timezone: tz });
    const g = newGoal(id(), at(1), { title: "Fit" });
    const m1 = toggleMilestone(newMilestone(id(), at(1), g.id, "5 km", 0), at(4));
    const m2 = newMilestone(id(), at(1), g.id, "10 km", 1);
    const r = buildReport({ ...empty, events: [ev], goals: [g], milestones: [m1, m2] }, week, "2026-11-09");
    expect(r.calendar).toEqual({ events: 7, hours: 3.5 });
    expect(r.goals[0]).toMatchObject({ milestonesDone: 1, milestonesTotal: 2, doneInRange: 1, percent: 50 });
  });

  it("exports a CSV that spreadsheets read safely", () => {
    const t = setTaskStatus(newTask(id(), at(1), { title: "x" }), "done", at(3));
    const g = newGoal(id(), at(1), { title: '=HYPERLINK("evil"), "quoted"' });
    const csv = reportToCsv(buildReport({ ...empty, tasks: [t], goals: [g] }, week, "2026-11-09"), "Creedence");
    expect(csv.startsWith("Creedence report,2026-11-02 to 2026-11-08\r\n")).toBe(true);
    expect(csv).toContain("Tasks completed,1");
    expect(csv).toContain("2026-11-03,1,0");
    expect(csv).toContain(`"'=HYPERLINK(""evil""), ""quoted"""`);
  });
});
