import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  expandEvents,
  isDone,
  type LocalEvent,
  type LocalEventException,
  type Occurrence,
} from "@productivity/domain";
import { useLocalRecords, type Task } from "@/shared";

export type Event = LocalEvent & { deletedAt: string | null };
export type EventException = LocalEventException & { deletedAt: string | null };

/** One thing on the calendar: an event occurrence, or an open task with a due date. */
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

export const ymd = (d: Dayjs | Date) => dayjs(d).format("YYYY-MM-DD");

/** Monday of the week containing `date` (weeks start on Monday). */
export const weekStart = (date: Dayjs) => date.subtract((date.day() + 6) % 7, "day").startOf("day");

/** The YYYY-MM-DD dates from `from` for `count` days. */
export const daysFrom = (from: Dayjs, count: number) => Array.from({ length: count }, (_, i) => ymd(from.add(i, "day")));

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
        const start = dayjs(t.dueDate);
        out.push({
          key: `task:${t.id}`,
          kind: "task",
          title: t.title,
          allDay: true,
          start: start.toDate(),
          end: start.add(1, "day").toDate(),
          startDate: t.dueDate,
          endDate: ymd(start.add(1, "day")),
          task: t,
        });
      } else if (t.dueAt) {
        const start = new Date(t.dueAt);
        const day = ymd(start);
        if (day < from || day >= to) continue;
        out.push({ key: `task:${t.id}`, kind: "task", title: t.title, allDay: false, start, end: new Date(start.getTime() + 30 * 60_000), task: t });
      }
    }
    return out.sort(
      (a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime() || a.kind.localeCompare(b.kind),
    );
  }, [events, exceptions, tasks, from, to]);

  return { items, events, exceptions, loading };
}

/** Items on one day: all-day ones covering it, timed ones overlapping it. */
export function itemsOn(items: readonly CalendarItem[], day: string): CalendarItem[] {
  const start = dayjs(day).toDate().getTime();
  const end = dayjs(day).add(1, "day").toDate().getTime();
  return items.filter((i) =>
    i.allDay ? i.startDate! <= day && day < i.endDate! : i.start.getTime() < end && i.end.getTime() > start,
  );
}

/** "09:00–10:30", or "All day". */
export const timeRange = (i: Pick<CalendarItem, "allDay" | "start" | "end" | "kind">) => {
  if (i.allDay) return i.kind === "task" ? "Due" : "All day";
  const t = (d: Date) => dayjs(d).format("HH:mm");
  return i.kind === "task" ? `Due ${t(i.start)}` : `${t(i.start)}–${t(i.end)}`;
};
