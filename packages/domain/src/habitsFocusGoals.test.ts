import { describe, expect, it } from "vitest";
import { focusSession, goal, goalMilestone, habit, habitLog } from "@productivity/contracts";
import {
  editHabit,
  habitProgress,
  indexLogs,
  isoWeekday,
  logToUndo,
  newHabit,
  newHabitLog,
  recentDays,
  scheduleLabel,
  streak,
  weekOf,
} from "./habits.ts";
import { clock, elapsedMs, focusStats, minutesText, pauseTimer, remainingMs, resumeTimer, sessionFrom, startTimer } from "./focus.ts";
import { goalProgress, markReviewed, newGoal, newMilestone, nextReview, reviewDue, sortGoals, toggleMilestone } from "./goals.ts";

const id = () => crypto.randomUUID();
const userId = crypto.randomUUID();
// Monday 9 November 2026.
const created = new Date("2026-10-01T08:00:00Z");
const log = (habitId: string, date: string, count = 1) => newHabitLog(id(), created, habitId, date, count);

describe("habits", () => {
  it("knows weekdays and weeks", () => {
    expect(isoWeekday("2026-11-09")).toBe(1);
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(weekOf("2026-11-15")).toBe("2026-11-09");
  });

  it("makes valid habits and normalises the schedule", () => {
    const h = newHabit(id(), created, { title: " Read ", daysOfWeek: [3, 1, 1, 2, 4, 5] });
    expect(h).toMatchObject({ title: "Read", cadence: "daily", daysOfWeek: [1, 2, 3, 4, 5], targetCount: 1 });
    expect(habit.safeParse({ ...h, userId }).success).toBe(true);
    expect(newHabit(id(), created, { title: "x", daysOfWeek: [1, 2, 3, 4, 5, 6, 7] }).daysOfWeek).toBeNull();
    expect(editHabit(h, { cadence: "weekly", targetCount: 3 }, created)).toMatchObject({ cadence: "weekly", daysOfWeek: null, targetCount: 3 });
    expect(habitLog.safeParse({ ...log(h.id, "2026-11-09"), userId }).success).toBe(true);
  });

  it("describes schedules in words", () => {
    expect(scheduleLabel({ cadence: "daily", daysOfWeek: null, targetCount: 1 })).toBe("every day");
    expect(scheduleLabel({ cadence: "daily", daysOfWeek: [1, 2, 3, 4, 5], targetCount: 1 })).toBe("on weekdays");
    expect(scheduleLabel({ cadence: "daily", daysOfWeek: null, targetCount: 8 })).toBe("8× every day");
    expect(scheduleLabel({ cadence: "daily", daysOfWeek: [1, 3], targetCount: 1 })).toBe("on Mon, Wed");
    expect(scheduleLabel({ cadence: "weekly", daysOfWeek: null, targetCount: 3 })).toBe("3× a week");
  });

  it("counts a daily streak, skipping days off, and not breaking on an unfinished today", () => {
    const h = newHabit(id(), created, { title: "Run", daysOfWeek: [1, 2, 3, 4, 5] });
    // Wed 4 … Fri 6 done, weekend off, Mon 9 (today) not yet.
    const index = indexLogs(["2026-11-04", "2026-11-05", "2026-11-06"].map((d) => log(h.id, d)));
    expect(streak(h, index, "2026-11-09")).toBe(3);
    const withToday = indexLogs(["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"].map((d) => log(h.id, d)));
    expect(streak(h, withToday, "2026-11-09")).toBe(4);
    // A missed Thursday breaks it.
    const gap = indexLogs(["2026-11-04", "2026-11-06"].map((d) => log(h.id, d)));
    expect(streak(h, gap, "2026-11-09")).toBe(1);
  });

  it("counts ticks from before the habit was created on this device", () => {
    // Created today (Mon 9 Nov), on Mon/Wed/Fri; ticks synced from Wed 4, Fri 6 and today.
    const h = newHabit(id(), new Date("2026-11-09T07:00:00Z"), { title: "Run", daysOfWeek: [1, 3, 5] });
    const index = indexLogs(["2026-11-04", "2026-11-06", "2026-11-09"].map((d) => log(h.id, d)));
    expect(streak(h, index, "2026-11-09")).toBe(3);
  });

  it("needs the full target for a day to count", () => {
    const h = newHabit(id(), created, { title: "Water", targetCount: 3 });
    const index = indexLogs([log(h.id, "2026-11-08", 2), log(h.id, "2026-11-08"), log(h.id, "2026-11-09")]);
    expect(habitProgress(h, index, "2026-11-09")).toMatchObject({ count: 1, target: 3, done: false });
    expect(streak(h, index, "2026-11-09")).toBe(1);
    expect(recentDays(h, index, "2026-11-09", 3).map((d) => d.mark)).toEqual(["missed", "done", "partial"]);
  });

  it("counts weekly habits per week", () => {
    const h = newHabit(id(), created, { title: "Gym", cadence: "weekly", targetCount: 2 });
    const index = indexLogs([
      log(h.id, "2026-10-27"),
      log(h.id, "2026-10-29"), // week of 26 Oct: 2
      log(h.id, "2026-11-02"),
      log(h.id, "2026-11-06"), // week of 2 Nov: 2
      log(h.id, "2026-11-09"), // this week: 1 so far
    ]);
    expect(habitProgress(h, index, "2026-11-10")).toMatchObject({ count: 1, target: 2, done: false });
    expect(streak(h, index, "2026-11-10")).toBe(2);
  });

  it("undoes the latest log of the day", () => {
    const h = newHabit(id(), created, { title: "Water" });
    const first = { ...log(h.id, "2026-11-09"), createdAt: "2026-11-09T08:00:00.000Z" };
    const second = { ...log(h.id, "2026-11-09"), createdAt: "2026-11-09T12:00:00.000Z" };
    expect(logToUndo([first, second], h.id, "2026-11-09")).toBe(second);
    expect(logToUndo([first, second], h.id, "2026-11-08")).toBeUndefined();
  });
});

describe("focus timer", () => {
  const t0 = new Date("2026-11-09T09:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);

  it("counts down, pauses and resumes", () => {
    let t = startTimer("focus", 25, { taskId: null }, t0);
    expect(remainingMs(t, at(10))).toBe(15 * 60_000);
    t = pauseTimer(t, at(10));
    expect(remainingMs(t, at(30))).toBe(15 * 60_000); // paused: no change
    t = resumeTimer(t, at(30));
    expect(remainingMs(t, at(40))).toBe(5 * 60_000);
    expect(remainingMs(t, at(60))).toBe(0);
  });

  it("saves a completed session at its planned length, ending when time was up", () => {
    const t = startTimer("focus", 25, { taskId: id() }, t0);
    const s = sessionFrom(id(), t, at(27), true); // the tab noticed 2 minutes late
    expect(s).toMatchObject({ durationSeconds: 1500, completed: true, endedAt: at(25).toISOString() });
    expect(focusSession.safeParse({ ...s, userId }).success).toBe(true);
    expect(sessionFrom(id(), t, at(12), false)).toMatchObject({ durationSeconds: 720, completed: false });
    expect(elapsedMs(t, at(1))).toBe(60_000);
  });

  it("formats time", () => {
    expect(clock(25 * 60_000)).toBe("25:00");
    expect(clock(59_001)).toBe("1:00");
    expect(clock(65 * 60_000)).toBe("1:05:00");
    expect(minutesText(85 * 60)).toBe("1 h 25 min");
    expect(minutesText(40 * 60)).toBe("40 min");
  });

  it("totals today and this week, focus only", () => {
    const now = new Date(2026, 10, 11, 15, 0); // Wed 11 Nov, local
    const mk = (d: Date, minutes: number, kind: "focus" | "break" = "focus") =>
      sessionFrom(id(), startTimer(kind, minutes, {}, d), new Date(d.getTime() + minutes * 60_000), true);
    const stats = focusStats(
      [mk(new Date(2026, 10, 11, 9), 25), mk(new Date(2026, 10, 11, 10), 5, "break"), mk(new Date(2026, 10, 9, 9), 50), mk(new Date(2026, 10, 6, 9), 25)],
      now,
    );
    expect(stats).toEqual({ todaySeconds: 1500, weekSeconds: 4500, sessionsToday: 1 });
  });
});

describe("goals", () => {
  const now = new Date("2026-11-09T09:00:00Z");

  it("makes valid goals and milestones", () => {
    const g = newGoal(id(), now, { title: " Run a half marathon ", targetDate: "2027-04-01", reviewCadence: "weekly" });
    expect(goal.safeParse({ ...g, userId }).success).toBe(true);
    expect(goalMilestone.safeParse({ ...newMilestone(id(), now, g.id, "Run 10 km", 0), userId }).success).toBe(true);
  });

  it("measures progress by milestones", () => {
    const g = newGoal(id(), now, { title: "Launch" });
    const ms = [newMilestone(id(), now, g.id, "a", 0), newMilestone(id(), now, g.id, "b", 1), newMilestone(id(), now, g.id, "c", 2)];
    expect(goalProgress(ms)).toEqual({ done: 0, total: 3, percent: 0 });
    expect(goalProgress([toggleMilestone(ms[0]!, now), ...ms.slice(1)])).toEqual({ done: 1, total: 3, percent: 33 });
    expect(toggleMilestone(toggleMilestone(ms[0]!, now), now).doneAt).toBeNull();
  });

  it("is due for review a week (or month) after the last one", () => {
    const g = newGoal(id(), now, { title: "Save", reviewCadence: "weekly" });
    expect(reviewDue(g, new Date("2026-11-15T09:00:00Z"))).toBe(false);
    expect(reviewDue(g, new Date("2026-11-16T09:00:00Z"))).toBe(true);
    const reviewed = markReviewed(g, new Date("2026-11-16T10:00:00Z"));
    expect(nextReview(reviewed)?.toISOString()).toBe("2026-11-23T10:00:00.000Z");
    expect(nextReview({ ...g, reviewCadence: null })).toBeNull();
    expect(nextReview({ ...g, status: "achieved" })).toBeNull();
  });

  it("sorts active goals first, soonest target first", () => {
    const mk = (title: string, status: "active" | "achieved" | "dropped", targetDate: string | null = null) => ({ title, status, targetDate });
    expect(sortGoals([mk("Old", "achieved"), mk("Later", "active", "2027-06-01"), mk("Soon", "active", "2027-01-01"), mk("Someday", "active")]).map((g) => g.title)).toEqual([
      "Soon",
      "Later",
      "Someday",
      "Old",
    ]);
  });
});
