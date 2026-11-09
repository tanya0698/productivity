import { useNavigate } from "react-router-dom";
import { Badge, Button, Tooltip } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useActiveReminders, useNow } from "./activeReminders";

/** The header's bell: how many reminders are due now; opens the Reminders page. */
export function ReminderBell() {
  const navigate = useNavigate();
  const now = useNow(15_000);
  const { items } = useActiveReminders(now);
  const due = items.filter((i) => i.at.getTime() <= now.getTime()).length;
  const label = due ? `${due} reminder${due === 1 ? "" : "s"} due` : "Reminders";
  return (
    <Tooltip title={label}>
      <Badge count={due} size="small" offset={[-4, 4]}>
        <Button type="text" icon={<BellOutlined />} aria-label={label} onClick={() => navigate("/reminders")} />
      </Badge>
    </Tooltip>
  );
}
