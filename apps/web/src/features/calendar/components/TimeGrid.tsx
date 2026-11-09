import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import dayjs from "dayjs";
import { layoutColumns } from "@productivity/domain";
import { itemsOn, timeRange, type CalendarItem } from "./items";

/** Pixels per hour in the grid. */
const HOUR = 48;
const SNAP_MIN = 15;

interface Drag {
  key: string;
  x: number;
  y: number;
  width: number;
  minutes: number;
  days: number;
  moved: boolean;
}

/**
 * Week or day view: an all-day row, then hours down the side and one column
 * per day. Click an empty slot to add an event there; drag an event to move it
 * (15-minute steps, across days in the week view).
 */
export function TimeGrid({
  days,
  items,
  today,
  now,
  onCreate,
  onCreateAllDay,
  onOpen,
  onMove,
  onDay,
}: {
  days: string[];
  items: CalendarItem[];
  today: string;
  now: Date;
  onCreate: (start: Date) => void;
  onCreateAllDay: (day: string) => void;
  onOpen: (item: CalendarItem) => void;
  onMove: (item: CalendarItem, start: Date) => void;
  onDay?: (day: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const suppressClick = useRef(false);
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;

  // Open at 07:00, where the day usually starts.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR - 8;
  }, []);

  const startDrag = (e: ReactPointerEvent<HTMLButtonElement>, item: CalendarItem) => {
    if (item.kind !== "event" || e.button !== 0) return;
    // A zero width (not laid out yet) would turn the day maths into NaN.
    const column = (e.currentTarget.closest(".pp-cal-col") as HTMLElement | null)?.getBoundingClientRect().width || 100;
    try {
      // Keeps the moves coming if the pointer leaves the block; not everywhere supports it.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* dragging still works while the pointer stays over the block */
    }
    setDrag({ key: item.key, x: e.clientX, y: e.clientY, width: column, minutes: 0, days: 0, moved: false });
  };
  /** Where the pointer has taken the block: snapped minutes and whole days, from the drag's start. */
  const dragAt = (d: Drag, e: ReactPointerEvent<HTMLButtonElement>, dayIndex: number): Drag => {
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    return {
      ...d,
      minutes: Math.round(((dy / HOUR) * 60) / SNAP_MIN) * SNAP_MIN,
      days: Math.max(-dayIndex, Math.min(days.length - 1 - dayIndex, Math.round(dx / d.width))),
      moved: d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4,
    };
  };
  const moveDrag = (e: ReactPointerEvent<HTMLButtonElement>, dayIndex: number) => {
    if (drag) setDrag(dragAt(drag, e, dayIndex));
  };
  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>, item: CalendarItem, dayIndex: number) => {
    if (!drag) return;
    // From the release point itself: the last rendered position can lag a move behind.
    const final = dragAt(drag, e, dayIndex);
    if (final.moved) {
      suppressClick.current = true;
      if (final.minutes || final.days) onMove(item, dayjs(item.start).add(final.days, "day").add(final.minutes, "minute").toDate());
    }
    setDrag(null);
  };

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="pp-cal-grid">
      <div className="pp-cal-row pp-cal-head" style={{ gridTemplateColumns: cols }}>
        <span />
        {days.map((d) => (
          <button
            type="button"
            key={d}
            className={`pp-cal-dayname${d === today ? " pp-cal-today" : ""}`}
            onClick={() => onDay?.(d)}
            disabled={!onDay}
          >
            <span className="pp-label">{dayjs(d).format("ddd")}</span>
            <span className="pp-cal-daynum pp-num">{dayjs(d).format("D")}</span>
          </button>
        ))}
      </div>

      <div className="pp-cal-row pp-cal-allday" style={{ gridTemplateColumns: cols }}>
        <span className="pp-label pp-cal-hourlabel">All day</span>
        {days.map((d) => (
          <div
            key={d}
            className="pp-cal-allday-cell"
            onClick={(e) => e.target === e.currentTarget && onCreateAllDay(d)}
            role="presentation"
          >
            {itemsOn(items, d)
              .filter((i) => i.allDay)
              .map((i) => (
                <button type="button" key={i.key} className={`pp-cal-chip pp-kind-${i.kind}`} onClick={() => onOpen(i)} title={i.title}>
                  {i.title}
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="pp-cal-scroll" ref={scroller}>
        <div className="pp-cal-row" style={{ gridTemplateColumns: cols, height: 24 * HOUR }}>
          <div className="pp-cal-hours" aria-hidden>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HOUR }} className="pp-num">
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((d, dayIndex) => {
            const dayStart = dayjs(d).toDate().getTime();
            const dayEnd = dayjs(d).add(1, "day").toDate().getTime();
            const timed = itemsOn(items, d).filter((i) => !i.allDay);
            return (
              <div
                key={d}
                className="pp-cal-col"
                style={{ backgroundSize: `100% ${HOUR}px` }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  const minutes = Math.floor((e.nativeEvent.offsetY / HOUR) * 2) * 30;
                  onCreate(dayjs(d).add(minutes, "minute").toDate());
                }}
                role="presentation"
              >
                {layoutColumns(timed).map(({ item, column, columns }) => {
                  const from = Math.max(item.start.getTime(), dayStart);
                  const to = Math.min(item.end.getTime(), dayEnd);
                  const top = ((from - dayStart) / 3_600_000) * HOUR;
                  const height = Math.max(((to - from) / 3_600_000) * HOUR, 18);
                  const dragging = drag?.key === item.key ? drag : null;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`pp-cal-event pp-kind-${item.kind}${height < 30 ? " pp-cal-short" : ""}${dragging?.moved ? " pp-cal-dragging" : ""}`}
                      style={{
                        top,
                        height,
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${100 / columns}% - 4px)`,
                        transform: dragging ? `translate(${dragging.days * dragging.width}px, ${(dragging.minutes / 60) * HOUR}px)` : undefined,
                      }}
                      onPointerDown={(e) => startDrag(e, item)}
                      onPointerMove={(e) => moveDrag(e, dayIndex)}
                      onPointerUp={(e) => endDrag(e, item, dayIndex)}
                      onPointerCancel={() => setDrag(null)}
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        onOpen(item);
                      }}
                      aria-label={`${item.title}, ${timeRange(item)}`}
                    >
                      <span className="pp-cal-event-title">{item.title}</span>
                      {height >= 34 ? <span className="pp-cal-event-time pp-num">{timeRange(item)}</span> : null}
                    </button>
                  );
                })}
                {d === today ? <div className="pp-cal-now" style={{ top: (nowMinutes / 60) * HOUR }} aria-hidden /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
