import { describe, expect, it } from "vitest";
import { newEvent, type LocalEvent, type LocalEventException } from "./calendar.ts";
import { eventReminderChoice, eventReminderSeries, planEventReminder } from "./eventReminders.ts";
import { alertKey, currentOccurrence, dismissReminder, newReminder, type LocalReminder, type Series } from "./reminders.ts";

const id = () => crypto.randomUUID();
const at = (iso: string) => new Date(iso);
const TZ = "Europe/London";
const ctx = (now = at("2026-03-01T00:00:00Z")) => ({ now, timezone: TZ, newId: id });

const take = (series: Series, n: number) => {
  const out: string[] = [];
  for (const d of series()) {
    out.push(d.toISOString());
    if (out.length === n) break;
  }
  return out;
};

/** Weekly stand-up, Mondays 09:00 London, from Monday 2 March 2026. */
const standup = (): LocalEvent =>
  newEvent(id(), at("2026-03-01T00:00:00Z"), { title: "Stand-up", recurrenceRule: "FREQ=WEEKLY" }, {
    allDay: false,
    start: at("2026-03-02T09:00:00Z"),
    end: at("2026-03-02T09:30:00Z"),
    timezone: TZ,
  });

const exception = (event: LocalEvent, original: string, change: Partial<LocalEventException>): LocalEventException => ({
  id: id(),
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
  version: 0,
  deletedAt: null,
  eventId: event.id,
  originalOccurrence: original,
  cancelled: false,
  overrideLocalStart: null,
  overrideLocalEnd: null,
  overrideTitle: null,
  ...change,
});

const tenBefore = (event: LocalEvent): LocalReminder => planEventReminder(event, "10m", [], ctx()).put[0]!;

describe("reminders on repeating events", () => {
  it("creates one reminder that repeats with the event", () => {
    const event = standup();
    const r = tenBefore(event);
    expect(r).toMatchObject({ eventId: event.id, recurrenceRule: "FREQ=WEEKLY", timezone: TZ, remindAt: "2026-03-02T08:50:00.000Z" });
    expect(eventReminderChoice(event, r)).toBe("10m");
  });

  it("alerts before every occurrence, keeping local time across daylight saving", () => {
    const event = standup();
    const series = eventReminderSeries(tenBefore(event), event, [])!;
    // London moves to summer time on 29 March: 08:50 local is 08:50Z before, 07:50Z after.
    expect(take(series, 6)).toEqual([
      "2026-03-02T08:50:00.000Z",
      "2026-03-09T08:50:00.000Z",
      "2026-03-16T08:50:00.000Z",
      "2026-03-23T08:50:00.000Z",
      "2026-03-30T07:50:00.000Z",
      "2026-04-06T07:50:00.000Z",
    ]);
  });

  it("skips a cancelled occurrence and follows a moved one", () => {
    const event = standup();
    const series = eventReminderSeries(tenBefore(event), event, [
      exception(event, "2026-03-09T09:00:00", { cancelled: true }),
      exception(event, "2026-03-16T09:00:00", { overrideLocalStart: "2026-03-16T14:00:00", overrideLocalEnd: "2026-03-16T14:30:00" }),
    ])!;
    expect(take(series, 3)).toEqual(["2026-03-02T08:50:00.000Z", "2026-03-16T13:50:00.000Z", "2026-03-23T08:50:00.000Z"]);
  });

  it("keeps the alerts in order when an occurrence moves past the next one", () => {
    const event = standup();
    const series = eventReminderSeries(tenBefore(event), event, [
      exception(event, "2026-03-02T09:00:00", { overrideLocalStart: "2026-03-11T09:00:00", overrideLocalEnd: "2026-03-11T09:30:00" }),
    ])!;
    expect(take(series, 3)).toEqual(["2026-03-09T08:50:00.000Z", "2026-03-11T08:50:00.000Z", "2026-03-16T08:50:00.000Z"]);
  });

  it("is due for the right occurrence, and dismissing moves on to the next real one", () => {
    const event = standup();
    const r = tenBefore(event);
    const exceptions = [exception(event, "2026-03-16T09:00:00", { cancelled: true })];
    const series = eventReminderSeries(r, event, exceptions)!;
    const monday = at("2026-03-09T08:55:00Z");
    expect(currentOccurrence(r, monday, series)?.toISOString()).toBe("2026-03-09T08:50:00.000Z");
    expect(alertKey(r, monday, series)).toBe(`${r.id}@2026-03-09T08:50:00.000Z`);
    const dismissed = dismissReminder(r, monday, series);
    expect(dismissed).toMatchObject({ status: "scheduled", lastHandledAt: "2026-03-09T08:50:00.000Z" });
    // 16 March is cancelled, so the next alert is the 23rd.
    expect(currentOccurrence(dismissed, at("2026-03-16T09:00:00Z"), series)?.toISOString()).toBe("2026-03-23T08:50:00.000Z");
  });

  it("all-day: the morning before at 9:00, moving with a moved day", () => {
    const event = newEvent(id(), at("2026-03-01T00:00:00Z"), { title: "Bins out", recurrenceRule: "FREQ=WEEKLY" }, {
      allDay: true,
      startDate: "2026-03-05",
      endDate: "2026-03-06",
    });
    const r = { ...newReminder(id(), at("2026-03-01T00:00:00Z"), { remindAt: at("2026-03-04T09:00:00Z"), timezone: TZ, eventId: event.id, recurrenceRule: "FREQ=WEEKLY" }) };
    const series = eventReminderSeries(r, event, [exception(event, "2026-03-12T00:00:00", { overrideLocalStart: "2026-03-13T00:00:00", overrideLocalEnd: "2026-03-14T00:00:00" })])!;
    expect(take(series, 3)).toEqual(["2026-03-04T09:00:00.000Z", "2026-03-12T09:00:00.000Z", "2026-03-18T09:00:00.000Z"]);
  });

  it("leaves an unchanged reminder alone, keeping what was dismissed", () => {
    const event = standup();
    const r = { ...tenBefore(event), lastHandledAt: "2026-03-09T08:50:00.000Z" };
    expect(planEventReminder(event, "10m", [r], ctx())).toEqual({ put: [], remove: [] });
  });

  it("changes, or removes, the reminder when the choice changes", () => {
    const event = standup();
    const r = tenBefore(event);
    const changed = planEventReminder(event, "1h", [r], ctx()).put[0]!;
    expect(changed).toMatchObject({ id: r.id, remindAt: "2026-03-02T08:00:00.000Z", recurrenceRule: "FREQ=WEEKLY" });
    expect(planEventReminder(event, "none", [r], ctx())).toEqual({ put: [], remove: [r] });
  });

  it("a one-off event keeps a one-off reminder, and a series that stops repeating drops the rule", () => {
    const event = { ...standup(), recurrenceRule: null };
    expect(planEventReminder(event, "10m", [], ctx()).put[0]).toMatchObject({ recurrenceRule: null, remindAt: "2026-03-02T08:50:00.000Z" });
    const wasRepeating = tenBefore(standup());
    expect(planEventReminder(event, "10m", [wasRepeating], ctx()).put[0]).toMatchObject({ id: wasRepeating.id, recurrenceRule: null });
    expect(eventReminderSeries(wasRepeating, event, [])).toBeUndefined();
  });
});
