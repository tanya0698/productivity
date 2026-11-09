import { Link } from "react-router-dom";
import { Button, Flex, Typography } from "antd";
import { CaretRightOutlined } from "@ant-design/icons";
import { FOCUS_PRESETS, clock, focusStats, minutesText, remainingMs, type LocalFocusSession } from "@productivity/domain";
import { useFocus, useLocalRecords, useNow, useTicking } from "@/shared";

/** Today's focus time, and a quick start (or what's running). */
export default function SummaryWidget() {
  const { timer, start } = useFocus();
  const now = useTicking(!!timer?.runningSince);
  const stats = focusStats(useLocalRecords<LocalFocusSession & { deletedAt: string | null }>("focus_session").records, useNow(60_000));
  return (
    <Flex vertical gap={10}>
      <Flex align="baseline" gap={8}>
        <span className="pp-tile-value pp-num" style={{ fontSize: 30, color: "var(--pp-primary)" }}>
          {minutesText(stats.todaySeconds)}
        </span>
        <Typography.Text type="secondary">focused today</Typography.Text>
      </Flex>
      {timer ? (
        <Link to="/focus">
          {timer.kind === "focus" ? "Focus" : "Break"} running · {clock(remainingMs(timer, now))} left
        </Link>
      ) : (
        <Flex gap={8} align="center">
          <Button icon={<CaretRightOutlined />} onClick={() => start("focus", FOCUS_PRESETS[0].focus)}>
            Start 25 min
          </Button>
          <Link to="/focus">Open focus</Link>
        </Flex>
      )}
    </Flex>
  );
}
