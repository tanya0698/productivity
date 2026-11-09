import { describe, expect, it } from "vitest";
import { reminder, reminderObject } from "@productivity/contracts";
import {
  alertKey,
  currentOccurrence,
  dismissReminder,
  endReminder,
  fireTime,
  isDue,
  newReminder,
  occurrences,
  rescheduleReminder,
  scheduledReminders,
  snoozeReminder,
  zonedParts,
  zonedTime,
  type LocalReminder,
} from "./reminders.ts";

const id = () => crypto.randomUUID();
const at = (iso: string) => new Date(iso);
const take = (r: Pick<LocalReminder, "remindAt" | "timezone" | "recurrenceRule">, n: number) => {
  const out: string[] = [];
  for (const d of occurrences(r)) {
    out.push(d.toISOString());
    if (out.length === n) break;
  }
  return out;
};

describe("zoned time", () => {
  it("reads and builds wall-clock times in a zone", () => {
    expect(zonedParts(at("2026-07-01T07:30:00Z"), "Europe/London")).toMatchObject({ hour: 8, minute: 30, weekday: 3 });
    expect(zonedTime({ year: 2026, month: 7, day: 1, hour: 8, minute: 30 }, "Europe/London").toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(zonedTime({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, "Africa/Harare").toISOString()).toBe("2026-01-15T07:00:00.000Z");
  });
});

describe("occurrences", () => {
  it("keeps 09:00 local across a daylight-saving change", () => {
    // London springs forward on 29 March 2026: 09:00 is 09:00Z before, 08:00Z after.
    const r = { remindAt: "2026-03-28T09:00:00.000Z", timezone: "Europe/London", recurrenceRule: "FREQ=DAILY" as const };
    expect(take(r, 3)).toEqual(["2026-03-28T09:00:00.000Z", "2026-03-29T08:00:00.000Z", "2026-03-30T08:00:00.000Z"]);
  });

  it("skips weekends for weekdays", () => {
    // Fri 6 Nov 2026, then Mon 9, Tue 10.
    const r = { remindAt: "2026-11-06T07:00:00.000Z", timezone: "UTC", recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" as const };
    expect(take(r, 3)).toEqual(["2026-11-06T07:00:00.000Z", "2026-11-09T07:00:00.000Z", "2026-11-10T07:00:00.000Z"]);
  });

  it("puts the 31st on the last day of shorter months, without drifting", () => {
    const r = { remindAt: "2026-01-31T10:00:00.000Z", timezone: "UTC", recurrenceRule: "FREQ=MONTHLY" as const };
    expect(take(r, 4)).toEqual([
      "2026-01-31T10:00:00.000Z",
      "2026-02-28T10:00:00.000Z",
      "2026-03-31T10:00:00.000Z",
      "2026-04-30T10:00:00.000Z",
    ]);
  });

  it("does weekly and yearly", () => {
    expect(take({ remindAt: "2026-11-09T10:00:00.000Z", timezone: "UTC", recurrenceRule: "FREQ=WEEKLY" }, 2)[1]).toBe("2026-11-16T10:00:00.000Z");
    expect(take({ remindAt: "2028-02-29T10:00:00.000Z", timezone: "UTC", recurrenceRule: "FREQ=YEARLY" }, 2)[1]).toBe("2029-02-28T10:00:00.000Z");
  });
});

describe("a one-off reminder", () => {
  const r = newReminder(id(), at("2026-11-09T08:00:00Z"), {
    remindAt: at("2026-11-09T12:00:00Z"),
    timezone: "UTC",
    title: "  Call the bank ",
  });

  it("is a valid record", () => {
    expect(r.title).toBe("Call the bank");
    expect(reminderObject.omit({ userId: true }).safeParse(r).success).toBe(true);
    expect(reminder.safeParse({ ...r, userId: id(), taskId: id(), noteId: id() }).success).toBe(false);
  });

  it("is due from its time, and not before", () => {
    expect(isDue(r, at("2026-11-09T11:59:00Z"))).toBe(false);
    expect(isDue(r, at("2026-11-09T12:00:00Z"))).toBe(true);
  });

  it("snoozes to a new time, alerting again under a new key", () => {
    const now = at("2026-11-09T12:01:00Z");
    const snoozed = snoozeReminder(r, at("2026-11-09T12:11:00Z"), now);
    expect(isDue(snoozed, now)).toBe(false);
    expect(fireTime(snoozed, now)?.toISOString()).toBe("2026-11-09T12:11:00.000Z");
    expect(isDue(snoozed, at("2026-11-09T12:11:00Z"))).toBe(true);
    expect(alertKey(snoozed, now)).not.toBe(alertKey(r, now));
  });

  it("is finished once dismissed", () => {
    const done = dismissReminder(r, at("2026-11-09T12:05:00Z"));
    expect(done.status).toBe("dismissed");
    expect(currentOccurrence(done, at("2026-11-10T00:00:00Z"))).toBeNull();
    expect(isDue(done, at("2026-11-10T00:00:00Z"))).toBe(false);
  });
});

describe("a repeating reminder", () => {
  const r = newReminder(id(), at("2026-11-01T00:00:00Z"), {
    remindAt: at("2026-11-02T09:00:00Z"),
    timezone: "UTC",
    recurrenceRule: "FREQ=DAILY",
    title: "Take vitamins",
  });

  it("alerts once for everything missed, at the latest occurrence", () => {
    const now = at("2026-11-09T10:00:00Z");
    expect(currentOccurrence(r, now)?.toISOString()).toBe("2026-11-09T09:00:00.000Z");
    expect(isDue(r, now)).toBe(true);
  });

  it("moves on to the next day when dismissed", () => {
    const now = at("2026-11-09T10:00:00Z");
    const next = dismissReminder(r, now);
    expect(next.status).toBe("scheduled");
    expect(next.lastHandledAt).toBe("2026-11-09T09:00:00.000Z");
    expect(isDue(next, now)).toBe(false);
    expect(fireTime(next, now)?.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("dismissing before it's due skips the next one", () => {
    // Up to date: yesterday's was dismissed; today's 09:00 hasn't come yet.
    const upToDate = { ...r, lastHandledAt: "2026-11-08T09:00:00.000Z" };
    const now = at("2026-11-09T08:00:00Z");
    expect(isDue(upToDate, now)).toBe(false);
    expect(fireTime(dismissReminder(upToDate, now), now)?.toISOString()).toBe("2026-11-10T09:00:00.000Z");
  });

  it("stops for good when ended", () => {
    expect(fireTime(endReminder(r, at("2026-11-09T10:00:00Z")), at("2026-11-09T10:00:00Z"))).toBeNull();
  });

  it("starts afresh when rescheduled", () => {
    const handled = dismissReminder(r, at("2026-11-09T10:00:00Z"));
    const moved = rescheduleReminder(handled, { remindAt: at("2026-11-12T18:00:00Z"), recurrenceRule: null }, at("2026-11-09T10:01:00Z"));
    expect(moved).toMatchObject({ status: "scheduled", lastHandledAt: null, recurrenceRule: null });
    expect(fireTime(moved, at("2026-11-09T10:01:00Z"))?.toISOString()).toBe("2026-11-12T18:00:00.000Z");
  });
});

describe("scheduledReminders", () => {
  it("lists live ones soonest first, leaving out finished and deleted", () => {
    const now = at("2026-11-09T10:00:00Z");
    const mk = (iso: string, over: Partial<LocalReminder> = {}) => ({
      ...newReminder(id(), now, { remindAt: at(iso), timezone: "UTC", title: iso }),
      ...over,
    });
    const list = scheduledReminders(
      [
        mk("2026-11-10T09:00:00Z"),
        mk("2026-11-09T09:00:00Z"),
        mk("2026-11-09T08:00:00Z", { status: "dismissed" }),
        mk("2026-11-09T07:00:00Z", { deletedAt: now.toISOString() }),
      ],
      now,
    );
    expect(list.map((x) => x.reminder.title)).toEqual(["2026-11-09T09:00:00Z", "2026-11-10T09:00:00Z"]);
  });
});
