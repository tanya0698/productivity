import dayjs, { type Dayjs } from "dayjs";
import { itemsOn, timeRange, weekStart, ymd, type CalendarItem } from "./items";

const SHOWN = 3;

/** A month as weeks (Monday first). Click a date for its day view, an item to open it, empty space to add one. */
export function MonthView({
  month,
  items,
  today,
  onDay,
  onOpen,
  onCreateDay,
}: {
  month: Dayjs;
  items: CalendarItem[];
  today: string;
  onDay: (day: string) => void;
  onOpen: (item: CalendarItem) => void;
  onCreateDay: (day: string) => void;
}) {
  const first = weekStart(month.startOf("month"));
  const weeks = Math.ceil(month.endOf("month").diff(first, "day") / 7);
  const names = Array.from({ length: 7 }, (_, i) => first.add(i, "day").format("ddd"));

  return (
    <div className="pp-cal-month" role="grid" aria-label={month.format("MMMM YYYY")}>
      <div className="pp-cal-month-row pp-cal-month-names" role="row">
        {names.map((n) => (
          <span key={n} className="pp-label" role="columnheader">
            {n}
          </span>
        ))}
      </div>
      {Array.from({ length: weeks }, (_, w) => (
        <div className="pp-cal-month-row" role="row" key={w}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = first.add(w * 7 + i, "day");
            const d = ymd(day);
            const onDayItems = itemsOn(items, d);
            const outside = day.month() !== month.month();
            return (
              <div
                key={d}
                role="gridcell"
                className={`pp-cal-cell${outside ? " pp-cal-outside" : ""}${d === today ? " pp-cal-today" : ""}`}
                onClick={(e) => e.target === e.currentTarget && onCreateDay(d)}
              >
                <button type="button" className="pp-cal-cell-date pp-num" onClick={() => onDay(d)} aria-label={dayjs(d).format("dddd D MMMM")}>
                  {day.date()}
                </button>
                {onDayItems.slice(0, SHOWN).map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`pp-cal-chip pp-kind-${item.kind}${item.allDay ? "" : " pp-cal-chip-timed"}`}
                    onClick={() => onOpen(item)}
                    title={`${item.title} · ${timeRange(item)}`}
                  >
                    {item.allDay ? null : <span className="pp-num pp-cal-chip-time">{dayjs(item.start).format("HH:mm")}</span>}
                    {item.title}
                  </button>
                ))}
                {onDayItems.length > SHOWN ? (
                  <button type="button" className="pp-cal-more" onClick={() => onDay(d)}>
                    +{onDayItems.length - SHOWN} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
