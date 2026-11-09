import dayjs from "dayjs";
import { CheckSquareOutlined, RetweetOutlined } from "@ant-design/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { itemsOn, timeRange, type CalendarItem } from "./items";

/** The coming days as a list: each day with its events and due tasks. */
export function AgendaView({
  days,
  items,
  today,
  onOpen,
}: {
  days: string[];
  items: CalendarItem[];
  today: string;
  onOpen: (item: CalendarItem) => void;
}) {
  const withItems = days.map((d) => ({ d, list: itemsOn(items, d) })).filter((x) => x.list.length);
  if (!withItems.length) return <EmptyState text="Nothing scheduled in the next two weeks." />;
  return (
    <div className="pp-cal-agenda">
      {withItems.map(({ d, list }) => (
        <section key={d} className="pp-cal-agenda-day" aria-label={dayjs(d).format("dddd D MMMM")}>
          <h3 className={`pp-label${d === today ? " pp-label-brand" : ""}`}>
            {d === today ? "Today · " : ""}
            {dayjs(d).format("ddd D MMM")}
          </h3>
          {list.map((item) => (
            <button type="button" key={item.key} className="pp-cal-agenda-item" onClick={() => onOpen(item)}>
              <span className="pp-cal-agenda-time pp-num">{timeRange(item)}</span>
              <span className={`pp-cal-dot pp-kind-${item.kind}`} aria-hidden />
              <span className="pp-task-title">{item.title}</span>
              {item.kind === "task" ? <CheckSquareOutlined className="pp-cal-agenda-icon" aria-label="Task" /> : null}
              {item.occurrence?.recurring ? <RetweetOutlined className="pp-cal-agenda-icon" aria-label="Repeats" /> : null}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
