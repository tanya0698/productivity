import { useEffect, useMemo, useState } from "react";
import { isDone, noteDisplayTitle, scheduledReminders, type LocalEvent, type LocalNote, type ReminderAt } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import type { Task } from "../tasks/TaskRow";
import { useReminders, type Reminder } from "./useReminders";

type Note = LocalNote & { deletedAt: string | null };
type Event = LocalEvent & { deletedAt: string | null };

export interface ActiveReminder extends ReminderAt<Reminder> {
  /** What it's about: the task's or note's title, or its own. */
  title: string;
  task?: Task;
  note?: Note;
  event?: Event;
}

/** The current time, ticking every `ms` (and when the tab comes back into view). */
export function useNow(ms = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, ms);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
  return now;
}

/**
 * Live reminders with their next alert time and what they're about, soonest
 * first. A reminder on a task that's done or deleted, or a note or event that's gone,
 * is left out: it shouldn't alert.
 */
export function useActiveReminders(now: Date): { items: ActiveReminder[]; loading: boolean } {
  const { records: reminders, loading } = useReminders();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: notes } = useLocalRecords<Note>("note");
  const { records: events } = useLocalRecords<Event>("event");

  const items = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const noteById = new Map(notes.map((n) => [n.id, n]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    const out: ActiveReminder[] = [];
    for (const item of scheduledReminders(reminders, now)) {
      const { taskId, noteId, eventId, title } = item.reminder;
      if (taskId) {
        const task = taskById.get(taskId);
        if (!task || isDone(task)) continue;
        out.push({ ...item, title: task.title, task });
      } else if (noteId) {
        const note = noteById.get(noteId);
        if (!note) continue;
        out.push({ ...item, title: noteDisplayTitle(note), note });
      } else if (eventId) {
        const event = eventById.get(eventId);
        if (!event) continue;
        out.push({ ...item, title: event.title, event });
      } else {
        out.push({ ...item, title: title || "Reminder" });
      }
    }
    return out;
  }, [reminders, tasks, notes, events, now]);

  return { items, loading };
}

/** "in 5 min", "10 min ago", "at 14:30", "tomorrow 09:00", "Fri 13 Nov 09:00". */
export function whenText(at: Date, now: Date): string {
  const mins = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (Math.abs(mins) < 1) return "now";
  if (mins < 0 && mins > -60) return `${-mins} min ago`;
  if (mins > 0 && mins < 60) return `in ${mins} min`;
  const clock = at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(now)) / 86_400_000);
  if (days === 0) return `today ${clock}`;
  if (days === 1) return `tomorrow ${clock}`;
  if (days === -1) return `yesterday ${clock}`;
  return `${at.toLocaleDateString(undefined, { weekday: Math.abs(days) < 7 ? "short" : undefined, day: "numeric", month: "short" })} ${clock}`;
}
