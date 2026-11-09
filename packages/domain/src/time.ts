import type { ReminderRepeat } from "@productivity/contracts";

/**
 * Wall-clock time in a zone, and repeat rules over calendar dates, without a
 * library. Shared by reminders and calendar events, so "every weekday at
 * 09:00" means the same thing for both.
 */

export interface Ymd {
  year: number;
  month: number; // 1–12
  day: number;
}

export interface Parts extends Ymd {
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The wall-clock reading of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): Parts {
  const p: Record<string, string> = {};
  for (const { type, value } of formatter(timeZone).formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
  };
}

const offsetAt = (t: number, timeZone: string) => {
  const p = zonedParts(new Date(t), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
};

/**
 * The instant when the clock in `timeZone` reads this wall-clock time. In a
 * spring-forward gap (02:30 that never happens) it lands just after the jump.
 */
export function zonedTime(
  { year, month, day, hour, minute, second = 0 }: Ymd & { hour: number; minute: number; second?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const first = guess - offsetAt(guess, timeZone);
  return new Date(guess - offsetAt(first, timeZone));
}

export const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** "2026-11-09" ↔ {year, month, day}. */
export const parseYmd = (s: string): Ymd => {
  const [year, month, day] = s.slice(0, 10).split("-").map(Number) as [number, number, number];
  return { year, month, day };
};
export const formatYmd = ({ year, month, day }: Ymd) =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/** A date `days` later (or earlier), across month and year ends. */
export function shiftYmd(d: Ymd, days: number): Ymd {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Whole days from `a` to `b`. */
export const daysBetween = (a: Ymd, b: Ymd) =>
  Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);

/**
 * The dates a repeat rule produces, from `anchor` onwards (no rule: just the
 * anchor). Monthly on the 31st falls on the last day of shorter months, and
 * yearly on 29 February on the 28th, without drifting afterwards.
 */
export function* repeatDates(anchor: Ymd, rule: ReminderRepeat | null): Generator<Ymd> {
  if (!rule) {
    yield anchor;
    return;
  }
  for (let k = 0; k < 100_000; k++) {
    switch (rule) {
      case "FREQ=DAILY":
      case "FREQ=WEEKLY":
      case "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR": {
        const d = shiftYmd(anchor, k * (rule === "FREQ=WEEKLY" ? 7 : 1));
        const weekday = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
        if (rule.includes("BYDAY") && (weekday === 0 || weekday === 6)) continue;
        yield d;
        break;
      }
      case "FREQ=MONTHLY": {
        const total = anchor.month - 1 + k;
        const year = anchor.year + Math.floor(total / 12);
        const month = (total % 12) + 1;
        yield { year, month, day: Math.min(anchor.day, daysIn(year, month)) };
        break;
      }
      case "FREQ=YEARLY": {
        const year = anchor.year + k;
        yield { year, month: anchor.month, day: Math.min(anchor.day, daysIn(year, anchor.month)) };
        break;
      }
    }
  }
}
