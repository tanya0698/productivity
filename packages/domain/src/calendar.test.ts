import { describe, expect, it } from "vitest";
import { calendarEvent } from "@productivity/contracts";
import {
  cancelOccurrence,
  editEvent,
  expandEvents,
  layoutColumns,
  movedWhen,
  newEvent,
  overrideOccurrence,
  seriesWhen,
  wallIn,
} from "./calendar.ts";

const now = new Date("2026-11-01T00:00:00Z");
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const local = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi);
const id = () => crypto.randomUUID();
const userId = crypto.randomUUID();

describe("calendar events", () => {
  it("makes valid timed and all-day events", () => {
    const timed = newEvent(id(), now, { title: "Dentist" }, { allDay: false, start: local(2026, 11, 12, 14, 30), end: local(2026, 11, 12, 15), timezone: tz });
    expect(timed.localStart).toBe("2026-11-12T14:30:00");
    expect(calendarEvent.safeParse({ ...timed, userId }).success).toBe(true);
    const allDay = newEvent(id(), now, { title: "Conference" }, { allDay: true, startDate: "2026-11-20", endDate: "2026-11-22" });
    expect(calendarEvent.safeParse({ ...allDay, userId }).success).toBe(true);
    expect(calendarEvent.safeParse({ ...allDay, userId, endDate: "2026-11-20" }).success).toBe(false);
  });

  it("gives a timed event with no length half an hour", () => {
    const e = newEvent(id(), now, { title: "Call" }, { allDay: false, start: local(2026, 11, 12, 9), end: local(2026, 11, 12, 9), timezone: tz });
    expect(new Date(e.endsAt!).getTime() - new Date(e.startsAt!).getTime()).toBe(30 * 60_000);
  });
});

describe("expandEvents", () => {
  const standup = newEvent(
    id(),
    now,
    { title: "Stand-up", recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    { allDay: false, start: local(2026, 11, 2, 9), end: local(2026, 11, 2, 9, 15), timezone: tz },
  );

  it("repeats on weekdays inside the range only", () => {
    const week = expandEvents([standup], [], "2026-11-09", "2026-11-16");
    expect(week).toHaveLength(5);
    expect(week.map((o) => o.start.getDate())).toEqual([9, 10, 11, 12, 13]);
    expect(week.every((o) => o.start.getHours() === 9 && o.end.getMinutes() === 15)).toBe(true);
  });

  it("drops a cancelled occurrence and moves an overridden one", () => {
    const [mon, tue] = expandEvents([standup], [], "2026-11-09", "2026-11-11");
    const cancelled = cancelOccurrence(id(), mon!, now);
    const moved = overrideOccurrence(
      id(),
      tue!,
      { when: { allDay: false, start: local(2026, 11, 10, 11), end: local(2026, 11, 10, 11, 30), timezone: tz }, title: "Stand-up (late)" },
      now,
    );
    const week = expandEvents([standup], [cancelled, moved], "2026-11-09", "2026-11-16");
    expect(week).toHaveLength(4);
    expect(week[0]).toMatchObject({ title: "Stand-up (late)" });
    expect(week[0]!.start.getHours()).toBe(11);
    expect(week[0]!.key).toBe(tue!.key);
  });

  it("finds an occurrence moved in from outside the range", () => {
    const [mon] = expandEvents([standup], [], "2026-11-09", "2026-11-10");
    const moved = overrideOccurrence(id(), mon!, { when: { allDay: false, start: local(2026, 11, 21, 10), end: local(2026, 11, 21, 10, 15), timezone: tz } }, now);
    const saturday = expandEvents([standup], [moved], "2026-11-21", "2026-11-22");
    expect(saturday.map((o) => o.original)).toEqual(["2026-11-09T09:00:00"]);
  });

  it("keeps 09:00 local across a daylight-saving change", () => {
    const london = newEvent(
      id(),
      now,
      { title: "Gym", recurrenceRule: "FREQ=DAILY" },
      { allDay: false, start: new Date("2026-03-28T09:00:00Z"), end: new Date("2026-03-28T10:00:00Z"), timezone: "Europe/London" },
    );
    const days = expandEvents([london], [], "2026-03-27", "2026-04-01").map((o) => wallIn(o.start, "Europe/London"));
    expect(days.filter((w) => w.startsWith("2026-03-2") || w.startsWith("2026-03-3")).every((w) => w.endsWith("T09:00:00"))).toBe(true);
  });

  it("spans all-day events across the days they cover", () => {
    const trip = newEvent(id(), now, { title: "Lisbon" }, { allDay: true, startDate: "2026-11-20", endDate: "2026-11-23" });
    expect(expandEvents([trip], [], "2026-11-22", "2026-11-23")).toHaveLength(1);
    expect(expandEvents([trip], [], "2026-11-23", "2026-11-24")).toHaveLength(0);
  });

  it("leaves deleted events out", () => {
    expect(expandEvents([{ ...standup, deletedAt: now.toISOString() }], [], "2026-11-09", "2026-11-16")).toHaveLength(0);
  });
});

describe("moving and series edits", () => {
  it("moves an occurrence keeping its length", () => {
    const e = newEvent(id(), now, { title: "Review" }, { allDay: false, start: local(2026, 11, 12, 14), end: local(2026, 11, 12, 15, 30), timezone: tz });
    const [o] = expandEvents([e], [], "2026-11-12", "2026-11-13");
    const when = movedWhen(o!, local(2026, 11, 13, 9), tz);
    const moved = editEvent(e, {}, when, now);
    expect(moved.localStart).toBe("2026-11-13T09:00:00");
    expect(moved.localEnd).toBe("2026-11-13T10:30:00");
  });

  it("applies a new time of day to the whole series from its first date", () => {
    const e = newEvent(id(), now, { title: "Yoga", recurrenceRule: "FREQ=WEEKLY" }, { allDay: false, start: local(2026, 11, 3, 18), end: local(2026, 11, 3, 19), timezone: tz });
    const [later] = expandEvents([e], [], "2026-11-17", "2026-11-18");
    const when = seriesWhen(e, later!, { allDay: false, start: local(2026, 11, 17, 19), end: local(2026, 11, 17, 20, 30), timezone: tz });
    const edited = editEvent(e, {}, when, now);
    expect(edited.localStart).toBe("2026-11-03T19:00:00");
    expect(edited.localEnd).toBe("2026-11-03T20:30:00");
  });
});

describe("layoutColumns", () => {
  it("puts overlapping items side by side, and lone ones full width", () => {
    const at = (h: number, m = 0) => local(2026, 11, 9, h, m);
    const items = [
      { id: "a", start: at(9), end: at(10) },
      { id: "b", start: at(9, 30), end: at(10, 30) },
      { id: "c", start: at(10), end: at(11) },
      { id: "d", start: at(14), end: at(15) },
    ];
    const laid = Object.fromEntries(layoutColumns(items).map((l) => [l.item.id, [l.column, l.columns]]));
    expect(laid).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1] });
  });
});
