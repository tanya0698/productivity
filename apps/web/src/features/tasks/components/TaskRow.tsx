import type { MouseEvent } from "react";
import { Checkbox } from "antd";
import { ClockCircleOutlined, ExclamationCircleOutlined, FlagFilled, FlagOutlined } from "@ant-design/icons";
import { dueState, isDone, priorityLabel, type LocalTask } from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import { formatDue } from "./formatDue";

export type Task = LocalTask & { deletedAt: string | null };

/** Red for overdue, amber for today, plain for later: always with words, never colour alone. */
export function DueBadge({ task, now, today }: { task: Task; now: Date; today: string }) {
  const date = task.dueDate ?? task.dueAt?.slice(0, 10);
  if (!date) return null;
  const state = dueState(task, now, today);
  if (state === "overdue") {
    return (
      <span className="pp-badge pp-badge-error">
        <ExclamationCircleOutlined /> Overdue · {formatDue(date, today)}
      </span>
    );
  }
  if (state === "due_soon") {
    return (
      <span className="pp-badge pp-badge-warning">
        <ClockCircleOutlined /> Due {formatDue(date, today).toLowerCase()}
      </span>
    );
  }
  return <span className="pp-badge">{formatDue(date, today)}</span>;
}

/** Priority as an icon plus its name. Normal is the default and isn't shown in lists. */
export function PriorityLabel({ priority, always = false }: { priority: TaskPriority; always?: boolean }) {
  if (priority === 3 && !always) return null;
  const strong = priority <= 2;
  return (
    <span className={`pp-priority${priority === 1 ? " pp-priority-urgent" : ""}`}>
      {strong ? <FlagFilled /> : <FlagOutlined />}
      {priorityLabel[priority]}
    </span>
  );
}

/** One task in a list: tick it off, or open it to edit. */
export function TaskRow({
  task,
  now,
  today,
  onToggle,
  onOpen,
}: {
  task: Task;
  now: Date;
  today: string;
  onToggle: (task: Task) => void;
  onOpen?: (task: Task) => void;
}) {
  const done = isDone(task);
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div
      className={`pp-task${done ? " pp-task-done" : ""}`}
      onClick={() => onOpen?.(task)}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(task);
        }
      }}
      aria-label={onOpen ? `Open task: ${task.title}` : undefined}
    >
      <span onClick={stop} style={{ paddingTop: 1 }}>
        <Checkbox checked={done} onChange={() => onToggle(task)} aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="pp-task-title">{task.title}</div>
        {!done && (task.dueDate || task.dueAt || task.priority !== 3) ? (
          <div className="pp-task-meta">
            <DueBadge task={task} now={now} today={today} />
            <PriorityLabel priority={task.priority} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
