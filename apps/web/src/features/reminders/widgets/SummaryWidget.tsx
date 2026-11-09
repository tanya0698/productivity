import { Link } from "react-router-dom";
import { Flex } from "antd";
import { BellOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useActiveReminders, useNow, whenText } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";

/** Today's view: reminders due now, then the next few in the coming day. */
export default function SummaryWidget() {
  const now = useNow(30_000);
  const { items } = useActiveReminders(now);
  const dayAhead = now.getTime() + 24 * 60 * 60_000;
  const shown = items.filter((i) => i.at.getTime() <= dayAhead).slice(0, 5);

  if (!shown.length) {
    return <EmptyState compact text="No reminders in the next 24 hours." />;
  }
  return (
    <Flex vertical gap={10}>
      {shown.map(({ reminder, at, title }) => {
        const due = at.getTime() <= now.getTime();
        return (
          <Flex key={reminder.id} align="center" gap={10}>
            <span style={{ color: due ? "var(--pp-warning-text)" : "var(--pp-text-muted)" }} aria-hidden>
              {due ? <BellOutlined /> : <ClockCircleOutlined />}
            </span>
            <span className="pp-task-title" style={{ flex: 1, minWidth: 0 }}>
              {title}
            </span>
            <span className={`pp-badge${due ? " pp-badge-warning" : ""} pp-num`}>{whenText(at, now)}</span>
          </Flex>
        );
      })}
      <Link to="/reminders">All reminders</Link>
    </Flex>
  );
}
