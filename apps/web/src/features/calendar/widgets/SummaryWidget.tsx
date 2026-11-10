import { Link, useNavigate } from "react-router-dom";
import { Flex } from "antd";
import dayjs from "dayjs";
import { useNow, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton } from "@/components/ui/Skeletons";
import { timeRange, useCalendarItems, ymd } from "../components/items";

/** Today's events and timed tasks, in order; past ones dimmed. */
export default function SummaryWidget() {
  const navigate = useNavigate();
  const now = useNow(60_000);
  const today = ymd(now);
  const { items } = useCalendarItems(today, ymd(dayjs(today).add(1, "day")));
  const ready = useDataReady();
  const events = items.filter((i) => i.kind === "event" || !i.allDay);

  if (!events.length) return ready ? <EmptyState compact text="Nothing on the calendar today." /> : <RowsSkeleton rows={3} check={false} />;
  return (
    <Flex vertical gap={8}>
      {events.slice(0, 6).map((i) => {
        const past = !i.allDay && i.end.getTime() < now.getTime();
        return (
          <button
            type="button"
            key={i.key}
            className="pp-cal-agenda-item"
            style={{ opacity: past ? 0.55 : 1 }}
            onClick={() => navigate(i.kind === "task" ? `/tasks?task=${i.task!.id}` : `/calendar?view=day&date=${today}&event=${i.occurrence!.event.id}`)}
          >
            <span className="pp-cal-agenda-time pp-num">{timeRange(i)}</span>
            <span className={`pp-cal-dot pp-kind-${i.kind}`} aria-hidden />
            <span className="pp-task-title">{i.title}</span>
          </button>
        );
      })}
      <Link to="/calendar">Open calendar</Link>
    </Flex>
  );
}
