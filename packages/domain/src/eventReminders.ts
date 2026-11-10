import type { LocalEvent, LocalEventException } from "./calendar.ts";
import { formatWall, parseWall } from "./calendar.ts";
import { newReminder, rescheduleReminder, type LocalReminder, type Series } from "./reminders.ts";
import { planTaskReminder, taskReminderChoices, taskReminderTime, type TaskReminderChoice } from "./taskReminders.ts";
import { daysBetween, formatYmd, parseYmd, repeatDates, shiftYmd, zonedParts, zonedTime } from "./time.ts";

/**
 * Reminders on calendar events (plan §7.2, §8.2).
 *
 * A reminder on a repeating event is still one reminder record: it carries
 * the event's repeat rule, its `remindAt` is the alert for the first
 * occurrence, and the gap between the two (say 10 minutes, or "the morning
 * before at 9:00") is what every occurrence gets. Its actual alert times come
 * from the event, not from the rule, so:
 *
 *  - an occurrence moved on its own ("just this one") alerts at its new time;
 *  - a cancelled occurrence never alerts;
 *  - changing the whole series (new time, new rule) rewrites the reminder.
 *
 * One-off events keep a plain one-off reminder, as before.
 */

/** When an event is "due", for the reminder choices: its first start, or its first day. */
export const eventDue = (event: Pick<LocalEvent, "allDay" | "startDate" | "startsAt">) =>
  event.allDay ? { dueDate: event.startDate, dueAt: null } : { dueDate: null, dueAt: event.startsAt };

/** How many occurrences ahead to look so that ones moved past their neighbours still come out in order. */
const LOOKAHEAD = 8;

/** Yields `source` in time order, assuming nothing moved more than LOOKAHEAD places. */
function* inOrder(source: Iterable<Date>): Generator<Date> {
  const buffer: Date[] = [];
  for (const d of source) {
    buffer.push(d);
    if (buffer.length > LOOKAHEAD) {
      buffer.sort((a, b) => a.getTime() - b.getTime());
      yield buffer.shift()!;
    }
  }
  buffer.sort((a, b) => a.getTime() - b.getTime());
  yield* buffer;
}

/**
 * The alert times of a reminder on a repeating event, following the event's
 * exceptions. Undefined when the event doesn't repeat (the reminder's own time
 * is then the one that counts).
 */
export function eventReminderSeries(
  reminder: Pick<LocalReminder, "remindAt" | "timezone">,
  event: LocalEvent & { deletedAt?: string | null },
  exceptions: readonly LocalEventException[],
): Series | undefined {
  if (!event.recurrenceRule || event.deletedAt) return undefined;
  const rule = event.recurrenceRule;
  const byOriginal = new Map<string, LocalEventException>();
  for (const x of exceptions) if (x.eventId === event.id && !x.deletedAt) byOriginal.set(x.originalOccurrence, x);

  if (event.allDay) {
    if (!event.startDate) return undefined;
    const anchor = parseYmd(event.startDate);
    // "That morning" / "the morning before": the same wall-clock time, the same number of days off.
    const tz = reminder.timezone;
    const alert = zonedParts(new Date(reminder.remindAt), tz);
    const shift = daysBetween(anchor, alert);
    return () =>
      inOrder(
        (function* () {
          for (const d of repeatDates(anchor, rule)) {
            const x = byOriginal.get(`${formatYmd(d)}T00:00:00`);
            if (x?.cancelled) continue;
            const day = shiftYmd(x?.overrideLocalStart ? parseWall(x.overrideLocalStart) : d, shift);
            yield zonedTime({ year: day.year, month: day.month, day: day.day, hour: alert.hour, minute: alert.minute, second: alert.second }, tz);
          }
        })(),
      );
  }

  if (!event.localStart || !event.timezone || !event.startsAt) return undefined;
  const tz = event.timezone;
  const anchor = parseWall(event.localStart);
  // "10 minutes before": the same gap before every occurrence.
  const lead = new Date(event.startsAt).getTime() - new Date(reminder.remindAt).getTime();
  return () =>
    inOrder(
      (function* () {
        for (const d of repeatDates(anchor, rule)) {
          const original = formatWall({ ...d, hour: anchor.hour, minute: anchor.minute, second: anchor.second });
          const x = byOriginal.get(original);
          if (x?.cancelled) continue;
          const start = zonedTime(parseWall(x?.overrideLocalStart ?? original), tz);
          yield new Date(start.getTime() - lead);
        }
      })(),
    );
}

/** Which option an event's reminder matches, so the editor can show it (repeating events too). */
export function eventReminderChoice(
  event: Pick<LocalEvent, "allDay" | "startDate" | "startsAt">,
  reminder: Pick<LocalReminder, "remindAt"> | undefined,
): TaskReminderChoice {
  if (!reminder) return "none";
  const due = eventDue(event);
  const at = new Date(reminder.remindAt).getTime();
  const match = taskReminderChoices(due).find((c) => c.value !== "none" && taskReminderTime(due, c.value)?.getTime() === at);
  return match?.value ?? "custom";
}

/**
 * The reminder writes that make an event's reminder match `choice`. One-off
 * events get a one-off reminder; repeating ones a reminder that repeats with
 * them. The first existing reminder is reused (its id and history stay).
 */
export function planEventReminder(
  event: LocalEvent,
  choice: TaskReminderChoice,
  existing: readonly LocalReminder[],
  ctx: { now: Date; timezone: string; newId: () => string },
): { put: LocalReminder[]; remove: LocalReminder[] } {
  const due = { id: event.id, title: event.title, ...eventDue(event) };
  if (!event.recurrenceRule) return planTaskReminder(due, choice, existing, ctx, { eventId: event.id });

  const live = existing.filter((r) => !r.deletedAt);
  if (choice === "custom") return { put: [], remove: [] };
  const at = taskReminderTime(due, choice);
  if (!at) return { put: [], remove: live };
  // Timed: in the event's zone, so the gap holds across daylight saving. All-day: this device's clock, like tasks.
  const timezone = event.allDay ? ctx.timezone : (event.timezone ?? ctx.timezone);
  const rule = event.recurrenceRule;
  const [keep, ...extra] = live;
  if (keep && keep.remindAt === at.toISOString() && keep.recurrenceRule === rule && keep.timezone === timezone && keep.status !== "done") {
    // Unchanged: leave it, including which occurrences were already dismissed.
    return { put: [], remove: extra };
  }
  const put = keep
    ? rescheduleReminder(keep, { remindAt: at, recurrenceRule: rule, timezone }, ctx.now)
    : newReminder(ctx.newId(), ctx.now, { remindAt: at, timezone, eventId: event.id, recurrenceRule: rule });
  return { put: [put], remove: extra };
}
