import { useMemo } from "react";
import { expandEvents, isDone, localDate, type LocalEvent, type LocalEventException, type LocalTask, type Occurrence } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Event = LocalEvent & { deletedAt: string | null };
export type EventException = LocalEventException & { deletedAt: string | null };
type Task = LocalTask & { deletedAt: string | null };

/** One thing on the calendar: an event occurrence, or an open task with a due date (as on the web). */
export interface CalendarItem {
  key: string;
  kind: "event" | "task";
  title: string;
  allDay: boolean;
  start: Date;
  end: Date;
  /** All-day only: YYYY-MM-DD, end exclusive. */
  startDate?: string;
  endDate?: string;
  occurrence?: Occurrence;
  task?: Task;
}

/** YYYY-MM-DD on this phone's clock. */
export const ymd = (d: Date) => localDate(d);
/** Local midnight of a YYYY-MM-DD date. */
export const dateOf = (s: string) => {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
export const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Monday of the week containing `d` (weeks start on Monday, as on the web). */
export const weekStart = (d: Date) => plusDays(d, -((d.getDay() + 6) % 7));

/** Events, their exceptions and dated tasks between `from` and `to` (YYYY-MM-DD, `to` exclusive). */
export function useCalendarItems(from: string, to: string) {
  const { records: events, loading } = useLocalRecords<Event>("event");
  const { records: exceptions } = useLocalRecords<EventException>("event_exception");
  const { records: tasks } = useLocalRecords<Task>("task");

  const items = useMemo(() => {
    const out: CalendarItem[] = expandEvents(events, exceptions, from, to).map((o) => ({
      key: o.key,
      kind: "event",
      title: o.title,
      allDay: o.allDay,
      start: o.start,
      end: o.end,
      startDate: o.startDate,
      endDate: o.endDate,
      occurrence: o,
    }));
    for (const t of tasks) {
      if (isDone(t)) continue;
      if (t.dueDate && t.dueDate >= from && t.dueDate < to) {
        const start = dateOf(t.dueDate);
        out.push({ key: `task:${t.id}`, kind: "task", title: t.title, allDay: true, start, end: plusDays(start, 1), startDate: t.dueDate, endDate: ymd(plusDays(start, 1)), task: t });
      } else if (t.dueAt) {
        const start = new Date(t.dueAt);
        const day = ymd(start);
        if (day < from || day >= to) continue;
        out.push({ key: `task:${t.id}`, kind: "task", title: t.title, allDay: false, start, end: new Date(start.getTime() + 30 * 60_000), task: t });
      }
    }
    return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime() || a.kind.localeCompare(b.kind));
  }, [events, exceptions, tasks, from, to]);

  return { items, events, exceptions, loading };
}

/** Items on one day: all-day ones covering it, timed ones overlapping it. */
export function itemsOn(items: readonly CalendarItem[], day: string): CalendarItem[] {
  const start = dateOf(day).getTime();
  const end = plusDays(dateOf(day), 1).getTime();
  return items.filter((i) => (i.allDay ? i.startDate! <= day && day < i.endDate! : i.start.getTime() < end && i.end.getTime() > start));
}

const hm = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "09:00–10:30", "All day", "Due 14:00". */
export const timeRange = (i: Pick<CalendarItem, "allDay" | "start" | "end" | "kind">) => {
  if (i.allDay) return i.kind === "task" ? "Due" : "All day";
  return i.kind === "task" ? `Due ${hm(i.start)}` : `${hm(i.start)}–${hm(i.end)}`;
};
