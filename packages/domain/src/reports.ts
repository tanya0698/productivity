import { expandEvents, type LocalEvent, type LocalEventException } from "./calendar.ts";
import { focusStatsInRange } from "./reportsFocus.ts";
import { countOn, indexLogs, isScheduled, streak, weekOf, type LocalHabit, type LocalHabitLog } from "./habits.ts";
import { goalProgress, type LocalGoal, type LocalMilestone } from "./goals.ts";
import type { LocalNote } from "./notes.ts";
import type { LocalProject } from "./projects.ts";
import { formatYmd, parseYmd, shiftYmd } from "./time.ts";
import { isDone, localDate, type LocalTask } from "./tasks.ts";
import type { LocalFocusSession } from "./focus.ts";

/**
 * Reports: what happened over a date range, from the records on the device.
 * Every number is computed here, so web and Android agree, and the export
 * matches the screen. Dates are the user's local days; `to` is exclusive.
 */

export interface ReportRange {
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, exclusive. */
  to: string;
}

export interface ReportInput {
  tasks: readonly LocalTask[];
  notes: readonly LocalNote[];
  projects: readonly LocalProject[];
  sessions: readonly LocalFocusSession[];
  habits: readonly LocalHabit[];
  habitLogs: readonly LocalHabitLog[];
  goals: readonly LocalGoal[];
  milestones: readonly LocalMilestone[];
  events: readonly LocalEvent[];
  eventExceptions: readonly LocalEventException[];
}

export interface DayValue {
  date: string;
  value: number;
}

export interface Report {
  range: ReportRange;
  days: number;
  tasks: {
    completed: number;
    created: number;
    /** Open now and due before the end of the range. */
    overdue: number;
    /** Of the tasks due in the range, the share finished (0–100), or null if none were due. */
    onTimeRate: number | null;
    completedByDay: DayValue[];
  };
  focus: { minutes: number; sessions: number; completedSessions: number; minutesByDay: DayValue[]; byTask: { title: string; minutes: number }[] };
  habits: {
    /** Met / due across all habits (0–100), or null if nothing was due. */
    consistency: number | null;
    rows: { title: string; schedule: "daily" | "weekly"; due: number; met: number; rate: number | null; streak: number }[];
  };
  projects: { title: string; completedInRange: number; open: number; total: number }[];
  goals: { title: string; status: LocalGoal["status"]; milestonesDone: number; milestonesTotal: number; doneInRange: number; percent: number }[];
  calendar: { events: number; hours: number };
  notes: { created: number };
}

const live = <T extends { deletedAt?: string | null }>(xs: readonly T[]) => xs.filter((x) => !x.deletedAt);
const dayOf = (iso: string) => localDate(new Date(iso));
const inRange = (day: string, r: ReportRange) => day >= r.from && day < r.to;

/** The days of a range, in order. */
export function rangeDays(r: ReportRange): string[] {
  const out: string[] = [];
  for (let d = r.from; d < r.to; d = formatYmd(shiftYmd(parseYmd(d), 1))) out.push(d);
  return out;
}

/** The same length of time just before `r`, for "vs previous period". */
export function previousRange(r: ReportRange): ReportRange {
  const n = rangeDays(r).length;
  return { from: formatYmd(shiftYmd(parseYmd(r.from), -n)), to: r.from };
}

/** Percentage change from `before` to `now`; null when there's nothing to compare against. */
export const change = (now: number, before: number): number | null => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

export function buildReport(input: ReportInput, range: ReportRange, today: string): Report {
  const days = rangeDays(range);
  const perDay = () => new Map(days.map((d) => [d, 0]));

  // Tasks.
  const tasks = live(input.tasks);
  const completedByDay = perDay();
  let completed = 0;
  for (const t of tasks) {
    if (!isDone(t) || t.status === "cancelled" || !t.completedAt) continue;
    const d = dayOf(t.completedAt);
    if (!inRange(d, range)) continue;
    completed++;
    completedByDay.set(d, (completedByDay.get(d) ?? 0) + 1);
  }
  const created = tasks.filter((t) => inRange(dayOf(t.createdAt), range)).length;
  const end = range.to <= today ? range.to : today;
  const dueOf = (t: LocalTask) => t.dueDate ?? (t.dueAt ? dayOf(t.dueAt) : null);
  const overdue = tasks.filter((t) => !isDone(t) && (dueOf(t) ?? "9999") < end).length;
  const dueInRange = tasks.filter((t) => {
    const due = dueOf(t);
    return due && inRange(due, range) && due < today && t.status !== "cancelled";
  });
  const onTime = dueInRange.filter((t) => t.completedAt && dayOf(t.completedAt) <= dueOf(t)!).length;

  // Focus.
  const focus = focusStatsInRange(live(input.sessions), range, days, (id) => tasks.find((t) => t.id === id)?.title ?? null);

  // Habits: due days (or weeks) inside the range and since the habit existed, up to today.
  const index = indexLogs(live(input.habitLogs));
  const lastDay = days.filter((d) => d <= today);
  const habitRows = live(input.habits)
    .filter((h) => !h.archivedAt)
    .map((h) => {
      const since = h.createdAt.slice(0, 10);
      let due = 0;
      let met = 0;
      if (h.cadence === "daily") {
        for (const d of lastDay) {
          if (!isScheduled(h, d)) continue;
          const count = countOn(index, h.id, d);
          // A day before the habit existed counts only if it was ticked (e.g. imported history).
          if (d < since && count === 0) continue;
          due++;
          if (count >= h.targetCount) met++;
        }
      } else {
        const weeks = new Map<string, number>();
        for (const d of lastDay) {
          const monday = weekOf(d);
          weeks.set(monday, (weeks.get(monday) ?? 0) + countOn(index, h.id, d));
        }
        for (const [, count] of weeks) {
          due++;
          if (count >= h.targetCount) met++;
        }
      }
      return { title: h.title, schedule: h.cadence, due, met, rate: due ? Math.round((met / due) * 100) : null, streak: streak(h, index, today) };
    });
  const habitDue = habitRows.reduce((n, r) => n + r.due, 0);
  const habitMet = habitRows.reduce((n, r) => n + r.met, 0);

  // Projects: activity in the range, then where they stand now.
  const projects = live(input.projects)
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const own = tasks.filter((t) => t.projectId === p.id);
      return {
        title: p.title,
        completedInRange: own.filter((t) => t.completedAt && t.status === "done" && inRange(dayOf(t.completedAt), range)).length,
        open: own.filter((t) => !isDone(t)).length,
        total: own.length,
      };
    })
    .sort((a, b) => b.completedInRange - a.completedInRange || b.open - a.open || a.title.localeCompare(b.title));

  // Goals.
  const milestones = live(input.milestones);
  const goals = live(input.goals).map((g) => {
    const own = milestones.filter((m) => m.goalId === g.id);
    const p = goalProgress(own);
    return {
      title: g.title,
      status: g.status,
      milestonesDone: p.done,
      milestonesTotal: p.total,
      doneInRange: own.filter((m) => m.doneAt && inRange(dayOf(m.doneAt), range)).length,
      percent: p.percent,
    };
  });

  // Calendar: occurrences in the range; hours from timed ones.
  const occ = expandEvents(live(input.events), live(input.eventExceptions), range.from, range.to);
  const hours = occ.filter((o) => !o.allDay).reduce((n, o) => n + (o.end.getTime() - o.start.getTime()) / 3_600_000, 0);

  return {
    range,
    days: days.length,
    tasks: {
      completed,
      created,
      overdue,
      onTimeRate: dueInRange.length ? Math.round((onTime / dueInRange.length) * 100) : null,
      completedByDay: days.map((d) => ({ date: d, value: completedByDay.get(d) ?? 0 })),
    },
    focus,
    habits: { consistency: habitDue ? Math.round((habitMet / habitDue) * 100) : null, rows: habitRows },
    projects,
    goals,
    calendar: { events: occ.length, hours: Math.round(hours * 10) / 10 },
    notes: { created: live(input.notes).filter((n) => inRange(dayOf(n.createdAt), range)).length },
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote anything with a comma, quote or newline; neutralise spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const row = (...cells: unknown[]) => cells.map(cell).join(",");

/** The whole report as one CSV: a summary, then a section per area, ready for a spreadsheet. */
export function reportToCsv(r: Report, appName: string): string {
  const lines: string[] = [
    row(`${appName} report`, `${r.range.from} to ${rangeDays(r.range).at(-1) ?? r.range.from}`),
    "",
    row("Summary", "Value"),
    row("Tasks completed", r.tasks.completed),
    row("Tasks created", r.tasks.created),
    row("Overdue (open)", r.tasks.overdue),
    row("Done on time (%)", r.tasks.onTimeRate),
    row("Focus minutes", r.focus.minutes),
    row("Focus sessions", r.focus.sessions),
    row("Habit consistency (%)", r.habits.consistency),
    row("Calendar events", r.calendar.events),
    row("Hours in events", r.calendar.hours),
    row("Notes created", r.notes.created),
    "",
    row("Date", "Tasks completed", "Focus minutes"),
    ...r.tasks.completedByDay.map((d, i) => row(d.date, d.value, r.focus.minutesByDay[i]?.value ?? 0)),
    "",
    row("Habit", "Schedule", "Due", "Met", "Rate (%)", "Current streak"),
    ...r.habits.rows.map((h) => row(h.title, h.schedule, h.due, h.met, h.rate, h.streak)),
    "",
    row("Project", "Completed in period", "Open", "Total tasks"),
    ...r.projects.map((p) => row(p.title, p.completedInRange, p.open, p.total)),
    "",
    row("Goal", "Status", "Milestones done", "Milestones", "Done in period", "Progress (%)"),
    ...r.goals.map((g) => row(g.title, g.status, g.milestonesDone, g.milestonesTotal, g.doneInRange, g.percent)),
    "",
    row("Focus by task", "Minutes"),
    ...r.focus.byTask.map((t) => row(t.title, t.minutes)),
  ];
  return lines.join("\r\n") + "\r\n";
}
