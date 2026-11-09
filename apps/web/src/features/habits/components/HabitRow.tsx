import { Button, Tooltip } from "antd";
import { CheckOutlined, FireOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { habitProgress, recentDays, scheduleLabel, streak, type DayMark, type LogIndex } from "@productivity/domain";
import type { Habit } from "./useHabits";

const markText: Record<DayMark, string> = {
  done: "done",
  partial: "partly done",
  missed: "missed",
  pending: "not done yet",
  off: "not due",
};

/**
 * One habit: a check (or +/− for a count), its schedule and streak, and the
 * last seven days. Each day says what it was in words, not just colour.
 */
export function HabitRow({
  habit,
  index,
  today,
  onTick,
  onUntick,
  onOpen,
  compact = false,
}: {
  habit: Habit;
  index: LogIndex;
  today: string;
  onTick: (h: Habit) => void;
  onUntick: (h: Habit) => void;
  onOpen?: (h: Habit) => void;
  compact?: boolean;
}) {
  const p = habitProgress(habit, index, today);
  const days = streak(habit, index, today);
  const counting = habit.targetCount > 1;
  const unit = habit.cadence === "weekly" ? "week" : "day";

  return (
    <div className={`pp-habit${p.done ? " pp-habit-done" : ""}${p.scheduled ? "" : " pp-habit-off"}`}>
      {counting ? (
        <div className="pp-habit-counter" role="group" aria-label={`${habit.title}: ${p.count} of ${p.target}`}>
          <Button size="small" shape="circle" icon={<MinusOutlined />} aria-label={`Remove one from ${habit.title}`} onClick={() => onUntick(habit)} disabled={!p.count} />
          <span className="pp-num pp-habit-count">
            {p.count}/{p.target}
          </span>
          <Button size="small" shape="circle" type={p.done ? "default" : "primary"} icon={<PlusOutlined />} aria-label={`Add one to ${habit.title}`} onClick={() => onTick(habit)} />
        </div>
      ) : (
        <button
          type="button"
          className={`pp-habit-check${p.done ? " pp-habit-check-on" : ""}`}
          aria-pressed={p.done}
          aria-label={p.done ? `Mark "${habit.title}" as not done` : `Mark "${habit.title}" as done`}
          onClick={() => (p.done ? onUntick(habit) : onTick(habit))}
        >
          {p.done ? <CheckOutlined /> : null}
        </button>
      )}

      <button type="button" className="pp-habit-main" onClick={() => onOpen?.(habit)} disabled={!onOpen} aria-label={onOpen ? `Edit habit: ${habit.title}` : undefined}>
        <span className="pp-task-title">{habit.title}</span>
        <span className="pp-task-meta">
          <span className="pp-priority">{scheduleLabel(habit)}</span>
          {days ? (
            <span className="pp-badge pp-badge-success">
              <FireOutlined /> {days}-{unit} streak
            </span>
          ) : null}
          {!p.scheduled ? <span className="pp-badge">Not due today</span> : null}
        </span>
      </button>

      {compact ? null : (
        <div className="pp-habit-days" aria-label="Last 7 days">
          {recentDays(habit, index, today, 7).map((d) => (
            <Tooltip key={d.date} title={`${dayjs(d.date).format("ddd D MMM")}: ${markText[d.mark]}${d.count > 1 ? ` (${d.count})` : ""}`}>
              <span className={`pp-habit-day pp-day-${d.mark}`} aria-label={`${dayjs(d.date).format("ddd")}: ${markText[d.mark]}`}>
                {dayjs(d.date).format("dd").slice(0, 1)}
              </span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
