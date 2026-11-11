import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import {
  eventReminderSeries,
  isDone,
  noteDisplayTitle,
  scheduledReminders,
  type LocalEvent,
  type LocalEventException,
  type LocalNote,
  type LocalReminder,
  type LocalTask,
  type ReminderAt,
} from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";

export type Reminder = LocalReminder & { deletedAt: string | null };
type Task = LocalTask & { deletedAt: string | null };
type Note = LocalNote & { deletedAt: string | null };
type Event = LocalEvent & { deletedAt: string | null };
type Exception = LocalEventException & { deletedAt: string | null };

export interface ActiveReminder extends ReminderAt<Reminder> {
  /** What it's about: the task's, note's or event's title, or its own. */
  title: string;
  task?: Task;
  note?: Note;
  event?: Event;
}

export const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** The current time, ticking every `ms` and whenever the app comes back to the foreground. */
export function useNow(ms = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, ms);
    const sub = AppState.addEventListener("change", (s) => s === "active" && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [ms]);
  return now;
}

/**
 * Live reminders with their next alert time and what they're about, soonest
 * first: the same rules as the web app. A reminder on a task that's done or
 * deleted, or a note or event that's gone, is left out. One on a repeating
 * event follows the event's real occurrences, and carries that `series`.
 */
export function useActiveReminders(now: Date): { items: ActiveReminder[]; reminders: Reminder[]; loading: boolean } {
  const { records: reminders, loading } = useLocalRecords<Reminder>("reminder");
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: notes } = useLocalRecords<Note>("note");
  const { records: events } = useLocalRecords<Event>("event");
  const { records: exceptions } = useLocalRecords<Exception>("event_exception");

  const items = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const noteById = new Map(notes.map((n) => [n.id, n]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    const seriesOf = (r: Reminder) => {
      const event = r.eventId && r.recurrenceRule ? eventById.get(r.eventId) : undefined;
      return event ? eventReminderSeries(r, event, exceptions) : undefined;
    };
    const out: ActiveReminder[] = [];
    for (const item of scheduledReminders(reminders, now, seriesOf)) {
      const { taskId, noteId, eventId, title } = item.reminder;
      if (taskId) {
        const task = taskById.get(taskId);
        if (task && !isDone(task)) out.push({ ...item, title: task.title, task });
      } else if (noteId) {
        const note = noteById.get(noteId);
        if (note) out.push({ ...item, title: noteDisplayTitle(note), note });
      } else if (eventId) {
        const event = eventById.get(eventId);
        if (event) out.push({ ...item, title: event.title, event });
      } else {
        out.push({ ...item, title: title || "Reminder" });
      }
    }
    return out;
  }, [reminders, tasks, notes, events, exceptions, now]);

  return { items, reminders, loading };
}

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** "in 5 min", "10 min ago", "today 14:30", "tomorrow 09:00", "Fri 13 Nov 09:00". */
export function whenText(at: Date, now: Date): string {
  const mins = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (Math.abs(mins) < 1) return "now";
  if (mins < 0 && mins > -60) return `${-mins} min ago`;
  if (mins > 0 && mins < 60) return `in ${mins} min`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days === 0) return `today ${clock(at)}`;
  if (days === 1) return `tomorrow ${clock(at)}`;
  if (days === -1) return `yesterday ${clock(at)}`;
  return `${at.toLocaleDateString(undefined, { weekday: Math.abs(days) < 7 ? "short" : undefined, day: "numeric", month: "short" })} ${clock(at)}`;
}

export { clock };
