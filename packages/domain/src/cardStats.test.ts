import { describe, expect, it } from "vitest";
import { focusTrend, goalCardStats, notesTrend, projectCardStats, tasksDoneTrend, todayDoneShare, trendOf, windows } from "./cardStats.ts";
import { newTask, setTaskStatus } from "./tasks.ts";
import { sessionFrom, startTimer } from "./focus.ts";

const at = (d: number, h = 12) => new Date(2026, 10, d, h); // November 2026, local
const today = "2026-11-11";

describe("windows", () => {
  it("is the last seven days including today, and the seven before", () => {
    expect(windows(today)).toEqual({ current: { from: "2026-11-05", to: "2026-11-12" }, previous: { from: "2026-10-29", to: "2026-11-05" } });
  });
});

describe("trendOf", () => {
  it("counts each window and the change between them", () => {
    const t = trendOf([at(11).toISOString(), at(6).toISOString(), at(4).toISOString(), null, at(1).toISOString()], today);
    expect(t).toEqual({ now: 2, before: 2, change: 0 });
  });
  it("has no change when there's nothing earlier", () => {
    expect(trendOf([at(10).toISOString()], today).change).toBeNull();
  });
});

describe("card stats", () => {
  const done = (d: number) => setTaskStatus(newTask(crypto.randomUUID(), at(1), { title: "t" }), "done", at(d));
  const open = () => newTask(crypto.randomUUID(), at(1), { title: "o" });

  it("project: done this week vs last, and progress", () => {
    const s = projectCardStats([done(10), done(9), done(2), open()], today);
    expect(s.progress).toMatchObject({ done: 3, total: 4, percent: 75 });
    expect(s.doneThisWeek).toEqual({ now: 2, before: 1, change: 100 });
    expect(tasksDoneTrend([done(10), open()], today).now).toBe(1);
  });

  it("goal: milestones reached over 30 days", () => {
    const s = goalCardStats([{ doneAt: at(10).toISOString() }, { doneAt: null }], today);
    expect(s.progress.percent).toBe(50);
    expect(s.reached.now).toBe(1);
  });

  it("notes written this week", () => {
    expect(notesTrend([{ createdAt: at(11).toISOString() }, { createdAt: at(2).toISOString() }], today)).toEqual({ now: 1, before: 1, change: 0 });
  });

  it("focus minutes: today vs yesterday", () => {
    const session = (d: number, minutes: number) => {
      const t = startTimer("focus", minutes, {}, at(d, 9));
      return sessionFrom(crypto.randomUUID(), t, new Date(at(d, 9).getTime() + minutes * 60_000), true);
    };
    expect(focusTrend([session(11, 50), session(10, 25)], today, 1)).toEqual({ now: 50, before: 25, change: 100 });
  });

  it("today's share done", () => {
    expect(todayDoneShare([done(11), done(10)], 3, today)).toBe(25);
    expect(todayDoneShare([], 0, today)).toBeNull();
  });
});

describe("rings", () => {
  it("percentages, targets and time used", async () => {
    const { percentOf, timeUsed, onTrackShare, freshness } = await import("./cardStats.ts");
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(9, 4)).toBe(100);
    expect(onTrackShare(4, 1)).toBe(75);
    expect(onTrackShare(0, 0)).toBe(100);
    // Created the 1st at midnight, due the 10th (end of day): 10 days; on the 6th at midnight, half gone.
    expect(timeUsed(new Date(2026, 10, 1).toISOString(), "2026-11-10", new Date(2026, 10, 6))).toBe(50);
    expect(timeUsed(new Date(2026, 10, 1).toISOString(), null, new Date())).toBe(0);
    const now = new Date(2026, 10, 11, 12);
    expect(freshness(new Date(now.getTime() - 30 * 60_000), now)).toBe(50);
    expect(freshness(null, now)).toBe(0);
  });

  it("goal review cycle", async () => {
    const { newGoal, reviewCycleUsed } = await import("./goals.ts");
    const g = { ...newGoal("g", new Date(2026, 10, 1), { title: "x", reviewCadence: "weekly" }) };
    expect(reviewCycleUsed(g, new Date(2026, 10, 4, 12))).toBe(50);
    expect(reviewCycleUsed({ ...g, reviewCadence: null }, new Date())).toBe(0);
  });
});

describe("trends for every card", () => {
  it("due today, overdue and open, as they stood before", async () => {
    const { dueTodayTrend, overdueTrend, openTasksTrend } = await import("./cardStats.ts");
    const task = (due: string, created: number) => ({ ...newTask(crypto.randomUUID(), at(created), { title: "t", dueDate: due }), createdAt: at(created).toISOString() });
    const tasks = [task("2026-11-11", 1), task("2026-11-10", 1), task("2026-11-10", 1), task("2026-11-02", 1)];
    expect(dueTodayTrend(tasks, today)).toMatchObject({ now: 1, before: 2 });
    // Overdue now: the two due yesterday and the one due on the 2nd. A week ago (the 4th): only the 2nd's.
    expect(overdueTrend(tasks, today)).toMatchObject({ now: 3, before: 1, change: 200 });
    expect(openTasksTrend(tasks, today)).toMatchObject({ now: 4, before: 4, change: 0 });
  });

  it("habits done, best streak, count", async () => {
    const { habitsDoneTrend, bestStreakTrend, habitsCountTrend } = await import("./cardStats.ts");
    const { newHabit, newHabitLog, indexLogs } = await import("./habits.ts");
    const h = newHabit("h", at(1), { title: "Read" });
    const logs = ["2026-11-09", "2026-11-10", "2026-11-11"].map((d) => newHabitLog(crypto.randomUUID(), at(11), h.id, d));
    const index = indexLogs(logs);
    expect(habitsDoneTrend([h], index, today)).toMatchObject({ now: 1, before: 1 });
    expect(bestStreakTrend([h], index, today)).toMatchObject({ now: 3, before: 0 });
    expect(habitsCountTrend([h], today)).toMatchObject({ now: 1, before: 1 });
  });

  it("points for rates", async () => {
    const { pointsTrend, goalProgressTrend } = await import("./cardStats.ts");
    expect(pointsTrend(75, 50)).toEqual({ now: 75, before: 50, change: 25 });
    expect(goalProgressTrend([{ doneAt: at(10).toISOString() }, { doneAt: null }], today)).toMatchObject({ now: 50, before: 0, change: 50 });
  });
});
