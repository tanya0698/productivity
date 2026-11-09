import type { CalendarEvent, EventException, ReminderRepeat } from "@productivity/contracts";
import { daysBetween, formatYmd, parseYmd, repeatDates, shiftYmd, zonedParts, zonedTime, type Ymd } from "./time.ts";

/**
 * Calendar rules (plan §7.2): expanding repeating events into occurrences,
 * applying "just this one" exceptions, and creating or moving events. Times
 * are kept as wall-clock + zone, so a repeating 09:00 stays at 09:00.
 */

export type LocalEvent = Omit<CalendarEvent, "userId"> & { userId?: string };
export type LocalEventException = Omit<EventException, "userId"> & { userId?: string };

export interface Occurrence {
  event: LocalEvent;
  /** Stable per occurrence: `<eventId>@<original wall-clock start>`. */
  key: string;
  /** The wall-clock start this occurrence had before any exception. */
  original: string;
  title: string;
  allDay: boolean;
  /** Instants; for all-day, midnight on this device at the start and (exclusive) end dates. */
  start: Date;
  end: Date;
  /** All-day only: dates, end exclusive. */
  startDate?: string;
  endDate?: string;
  recurring: boolean;
  exception?: LocalEventException;
}

// ─── Wall-clock strings ───────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

interface Wall extends Ymd {
  hour: number;
  minute: number;
  second: number;
}

export const parseWall = (s: string): Wall => {
  const [date, time = "00:00:00"] = s.split("T") as [string, string?];
  const [hour, minute, second] = time.split(":").map(Number) as [number, number, number];
  return { ...parseYmd(date), hour, minute, second: second || 0 };
};
export const formatWall = (w: Wall) => `${formatYmd(w)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;

/** `date`'s wall-clock reading in `timeZone`, as "YYYY-MM-DDTHH:mm:ss". */
export const wallIn = (date: Date, timeZone: string) => formatWall(zonedParts(date, timeZone));

/** Midnight at the start of a YYYY-MM-DD date on this device. */
const deviceMidnight = (d: Ymd) => new Date(d.year, d.month - 1, d.day);

// ─── Expansion ────────────────────────────────────────────────────────────────

/** How far outside the range to look for occurrences moved into it by an exception. */
const SLACK_DAYS = 31;

/**
 * Every occurrence that overlaps [from, to) (YYYY-MM-DD dates on this device,
 * `to` exclusive), with exceptions applied, sorted: all-day first, then by start.
 */
export function expandEvents(
  events: readonly LocalEvent[],
  exceptions: readonly LocalEventException[],
  from: string,
  to: string,
): Occurrence[] {
  const fromYmd = parseYmd(from);
  const toYmd = parseYmd(to);
  const fromAt = deviceMidnight(fromYmd).getTime();
  const toAt = deviceMidnight(toYmd).getTime();
  const lookFrom = shiftYmd(fromYmd, -SLACK_DAYS);
  const lookTo = shiftYmd(toYmd, SLACK_DAYS);

  const byEvent = new Map<string, Map<string, LocalEventException>>();
  for (const x of exceptions) {
    if (x.deletedAt) continue;
    let m = byEvent.get(x.eventId);
    if (!m) byEvent.set(x.eventId, (m = new Map()));
    m.set(x.originalOccurrence, x);
  }

  const out: Occurrence[] = [];
  for (const event of events) {
    if (event.deletedAt) continue;
    const exc = byEvent.get(event.id);
    const recurring = !!event.recurrenceRule;

    if (event.allDay) {
      if (!event.startDate || !event.endDate) continue;
      const anchor = parseYmd(event.startDate);
      const span = Math.max(1, daysBetween(anchor, parseYmd(event.endDate)));
      for (const d of repeatDates(anchor, event.recurrenceRule)) {
        if (daysBetween(lookTo, d) > 0) break;
        if (daysBetween(d, lookFrom) > span) continue;
        const original = `${formatYmd(d)}T00:00:00`;
        const x = exc?.get(original);
        if (x?.cancelled) continue;
        const startYmd = x?.overrideLocalStart ? parseYmd(x.overrideLocalStart) : d;
        const endYmd = x?.overrideLocalEnd ? parseYmd(x.overrideLocalEnd) : shiftYmd(startYmd, span);
        const start = deviceMidnight(startYmd);
        const end = deviceMidnight(endYmd);
        if (end.getTime() <= fromAt || start.getTime() >= toAt) continue;
        out.push({
          event,
          key: `${event.id}@${original}`,
          original,
          title: x?.overrideTitle || event.title,
          allDay: true,
          start,
          end,
          startDate: formatYmd(startYmd),
          endDate: formatYmd(endYmd),
          recurring,
          exception: x,
        });
      }
      continue;
    }

    if (!event.localStart || !event.timezone || !event.startsAt || !event.endsAt) continue;
    const tz = event.timezone;
    const anchor = parseWall(event.localStart);
    const duration = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
    for (const d of repeatDates(anchor, event.recurrenceRule)) {
      if (daysBetween(lookTo, d) > 0) break;
      if (daysBetween(d, lookFrom) > 1 + duration / 86_400_000) continue;
      const original = formatWall({ ...d, hour: anchor.hour, minute: anchor.minute, second: anchor.second });
      const x = exc?.get(original);
      if (x?.cancelled) continue;
      const start = zonedTime(x?.overrideLocalStart ? parseWall(x.overrideLocalStart) : parseWall(original), tz);
      const end = x?.overrideLocalEnd ? zonedTime(parseWall(x.overrideLocalEnd), tz) : new Date(start.getTime() + duration);
      if (end.getTime() <= fromAt || start.getTime() >= toAt) continue;
      out.push({
        event,
        key: `${event.id}@${original}`,
        original,
        title: x?.overrideTitle || event.title,
        allDay: false,
        start,
        end,
        recurring,
        exception: x,
      });
    }
  }

  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
}

// ─── Creating and changing events ─────────────────────────────────────────────

export type EventWhen =
  | { allDay: false; start: Date; end: Date; timezone: string }
  | { allDay: true; startDate: string; endDate: string };

/** The time fields for `when`, keeping the timed/all-day shape consistent. */
function timeFields(when: EventWhen) {
  if (when.allDay) {
    return {
      allDay: true,
      startDate: when.startDate,
      endDate: when.endDate > when.startDate ? when.endDate : formatYmd(shiftYmd(parseYmd(when.startDate), 1)),
      localStart: null,
      localEnd: null,
      timezone: null,
      startsAt: null,
      endsAt: null,
    };
  }
  const end = when.end.getTime() > when.start.getTime() ? when.end : new Date(when.start.getTime() + 30 * 60_000);
  return {
    allDay: false,
    startDate: null,
    endDate: null,
    localStart: wallIn(when.start, when.timezone),
    localEnd: wallIn(end, when.timezone),
    timezone: when.timezone,
    startsAt: when.start.toISOString(),
    endsAt: end.toISOString(),
  };
}

export interface EventFields {
  title: string;
  description?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  recurrenceRule?: ReminderRepeat | null;
}

export function newEvent(id: string, now: Date, fields: EventFields, when: EventWhen): LocalEvent {
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    projectId: fields.projectId ?? null,
    taskId: fields.taskId ?? null,
    title: fields.title.trim() || "Untitled event",
    description: fields.description?.trim() || null,
    recurrenceRule: fields.recurrenceRule ?? null,
    ...timeFields(when),
  };
}

/** Change an event (for a repeating one: the whole series, from its first date). */
export function editEvent<T extends LocalEvent>(event: T, fields: Partial<EventFields>, when: EventWhen | null, now: Date): T {
  return {
    ...event,
    ...(fields.title !== undefined ? { title: fields.title.trim() || event.title } : {}),
    ...(fields.description !== undefined ? { description: fields.description?.trim() || null } : {}),
    ...(fields.projectId !== undefined ? { projectId: fields.projectId } : {}),
    ...(fields.taskId !== undefined ? { taskId: fields.taskId } : {}),
    ...(fields.recurrenceRule !== undefined ? { recurrenceRule: fields.recurrenceRule } : {}),
    ...(when ? timeFields(when) : {}),
    updatedAt: now.toISOString(),
  };
}

/**
 * Where a series edit should put the series, when the user changed one
 * occurrence's time: keep the series' first date, take the new time of day
 * and length. (Changing the date of every occurrence at once isn't offered.)
 */
export function seriesWhen(event: LocalEvent, occurrence: Occurrence, edited: EventWhen): EventWhen {
  if (edited.allDay) {
    const span = Math.max(1, daysBetween(parseYmd(edited.startDate), parseYmd(edited.endDate)));
    const first = event.startDate ?? edited.startDate;
    return { allDay: true, startDate: first, endDate: formatYmd(shiftYmd(parseYmd(first), span)) };
  }
  const tz = edited.timezone;
  const newStart = zonedParts(edited.start, tz);
  const firstDay = event.allDay ? parseYmd(occurrence.original) : parseWall(event.localStart ?? occurrence.original);
  const start = zonedTime({ ...firstDay, hour: newStart.hour, minute: newStart.minute }, tz);
  return { allDay: false, start, end: new Date(start.getTime() + (edited.end.getTime() - edited.start.getTime())), timezone: tz };
}

/** An exception that moves or retitles one occurrence (reusing its existing exception). */
export function overrideOccurrence(
  id: string,
  occurrence: Occurrence,
  change: { when?: EventWhen; title?: string | null },
  now: Date,
): LocalEventException {
  const base = occurrence.exception ?? {
    id,
    createdAt: now.toISOString(),
    version: 0,
    deletedAt: null,
    eventId: occurrence.event.id,
    originalOccurrence: occurrence.original,
    cancelled: false,
    overrideLocalStart: null,
    overrideLocalEnd: null,
    overrideTitle: null,
  };
  const when = change.when;
  const tz = occurrence.event.timezone ?? "UTC";
  return {
    ...base,
    cancelled: false,
    ...(when
      ? when.allDay
        ? { overrideLocalStart: `${when.startDate}T00:00:00`, overrideLocalEnd: `${when.endDate}T00:00:00` }
        : { overrideLocalStart: wallIn(when.start, tz), overrideLocalEnd: wallIn(when.end, tz) }
      : {}),
    ...(change.title !== undefined ? { overrideTitle: change.title?.trim() || null } : {}),
    updatedAt: now.toISOString(),
  };
}

/** An exception that removes one occurrence. */
export function cancelOccurrence(id: string, occurrence: Occurrence, now: Date): LocalEventException {
  return { ...overrideOccurrence(id, occurrence, {}, now), cancelled: true };
}

/** `when` for an occurrence dragged to `start`, keeping its length (all-day: whole days). */
export function movedWhen(occurrence: Occurrence, start: Date, timezone: string): EventWhen {
  if (occurrence.allDay) {
    const span = Math.max(1, daysBetween(parseYmd(occurrence.startDate!), parseYmd(occurrence.endDate!)));
    const s: Ymd = { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() };
    return { allDay: true, startDate: formatYmd(s), endDate: formatYmd(shiftYmd(s, span)) };
  }
  return { allDay: false, start, end: new Date(start.getTime() + (occurrence.end.getTime() - occurrence.start.getTime())), timezone };
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Side-by-side columns for overlapping timed items in one day: each gets a
 * column and the number of columns in its overlapping group.
 */
export function layoutColumns<T extends { start: Date; end: Date }>(items: readonly T[]): { item: T; column: number; columns: number }[] {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const out: { item: T; column: number; columns: number }[] = [];
  let group: { item: T; column: number; columns: number }[] = [];
  let colEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const g of group) g.columns = colEnds.length;
    out.push(...group);
    group = [];
    colEnds = [];
  };
  for (const item of sorted) {
    const s = item.start.getTime();
    if (s >= groupEnd && group.length) close();
    let column = colEnds.findIndex((end) => end <= s);
    if (column === -1) column = colEnds.push(0) - 1;
    colEnds[column] = item.end.getTime();
    groupEnd = Math.max(groupEnd === -Infinity ? 0 : groupEnd, item.end.getTime());
    group.push({ item, column, columns: 0 });
  }
  close();
  return out;
}
