import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, App as AntApp, Button, Card, Collapse, Dropdown, Flex, Typography } from "antd";
import { BellOutlined, CheckOutlined, ClockCircleOutlined, EllipsisOutlined, PlusOutlined, RetweetOutlined } from "@ant-design/icons";
import {
  dismissReminder,
  endReminder,
  newReminder,
  noteDisplayTitle,
  repeatLabel,
  setTaskStatus,
  snoozeChoices,
  snoozeReminder,
  type LocalNote,
} from "@productivity/domain";
import {
  ModulePage,
  deviceTimezone,
  useActiveReminders,
  useLocalRecords,
  useNow,
  useReminders,
  useSyncRuntime,
  whenText,
  type ActiveReminder,
  type Reminder,
  type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton } from "@/components/ui/Skeletons";
import { ReminderEditor } from "../components/ReminderEditor";
import { IconButton } from "@/components/ui/IconButton";

/**
 * Reminders: what's due now (snooze, dismiss, or tick off the task), what's
 * coming up, and what was dismissed lately. Alerts themselves come from the
 * shell (ReminderAlerts), on whichever page is open.
 */
export default function HomePage() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const now = useNow(15_000);
  const { items, loading } = useActiveReminders(now);
  const ready = useDataReady(loading);
  const { records: all } = useReminders();
  const { records: tasks } = useLocalRecords<Task>("task");
  const { records: notes } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const nameOf = (r: Reminder) =>
    r.title ||
    (r.taskId && tasks.find((t) => t.id === r.taskId)?.title) ||
    (r.noteId && notes.find((n) => n.id === r.noteId) ? noteDisplayTitle(notes.find((n) => n.id === r.noteId)!) : null) ||
    "Reminder";
  const [editing, setEditing] = useState<{ reminder: Reminder; isNew: boolean; linkedTitle?: string } | null>(null);

  const due = items.filter((i) => i.at.getTime() <= now.getTime());
  const upcoming = items.filter((i) => i.at.getTime() > now.getTime());
  const history = useMemo(
    () =>
      all
        .filter((r) => r.status === "dismissed" || r.status === "done")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20),
    [all],
  );

  const create = () => {
    const at = new Date(now.getTime() + 60 * 60_000);
    at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5, 0, 0);
    setEditing({ reminder: newReminder(runtime.newId(), new Date(), { remindAt: at, timezone: deviceTimezone() }), isNew: true });
  };

  return (
    <ModulePage
      eyebrow="Plan"
      title="Reminders"
      description="One-off or repeating, on their own or on a task. Saved on this device first, then synced."
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={create}>
          New reminder
        </Button>
      }
    >
      <NotificationPermission />

      {due.length ? (
        <Card className="pp-card pp-card-due" title={`Due now · ${due.length}`}>
          <Flex vertical>
            {due.map((item) => (
              <ReminderRow key={item.reminder.id} item={item} now={now} due onEdit={setEditing} />
            ))}
          </Flex>
        </Card>
      ) : null}

      <Card className="pp-card" title="Coming up" extra={<span className="pp-label pp-num">{upcoming.length}</span>}>
        {!ready && !items.length ? (
          <RowsSkeleton rows={3} check={false} />
        ) : upcoming.length ? (
          <Flex vertical>
            {upcoming.map((item) => (
              <ReminderRow key={item.reminder.id} item={item} now={now} onEdit={setEditing} />
            ))}
          </Flex>
        ) : (
          <EmptyState compact text="Nothing coming up. Add a reminder, or give a task a due time and a reminder." />
        )}
      </Card>

      {history.length ? (
        <Collapse
          ghost
          items={[
            {
              key: "history",
              label: <span className="pp-label">Dismissed lately · {history.length}</span>,
              children: (
                <Flex vertical gap={6}>
                  {history.map((r) => (
                    <Flex key={r.id} justify="space-between" gap={12} className="pp-reminder-past">
                      <Typography.Text type="secondary" ellipsis>
                        {nameOf(r)}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="pp-num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {whenText(new Date(r.lastHandledAt ?? r.remindAt), now)}
                      </Typography.Text>
                    </Flex>
                  ))}
                </Flex>
              ),
            },
          ]}
        />
      ) : null}

      <ReminderEditor
        reminder={editing?.reminder ?? null}
        isNew={editing?.isNew}
        linkedTitle={editing?.linkedTitle}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          void runtime.write("reminder", r);
          void message.success(editing?.isNew ? "Reminder added" : "Reminder saved");
          setEditing(null);
        }}
        onDelete={(r) => {
          void runtime.write("reminder", r, "delete");
          void message.success("Reminder deleted");
          setEditing(null);
        }}
      />
    </ModulePage>
  );
}

function ReminderRow({
  item,
  now,
  due = false,
  onEdit,
}: {
  item: ActiveReminder;
  now: Date;
  due?: boolean;
  onEdit: (e: { reminder: Reminder; isNew: boolean; linkedTitle?: string }) => void;
}) {
  const runtime = useSyncRuntime();
  const navigate = useNavigate();
  const { reminder, at, title, task, note, event } = item;
  const repeating = !!reminder.recurrenceRule;
  const snoozed = reminder.status === "snoozed";

  const open = () => {
    if (task) navigate(`/tasks?task=${task.id}`);
    else if (event) navigate(`/calendar?event=${event.id}`);
    else onEdit({ reminder, isNew: false, linkedTitle: note ? title : undefined });
  };

  return (
    <div className={`pp-reminder${due ? " pp-reminder-due" : ""}`}>
      <span className="pp-reminder-icon" aria-hidden>
        {due ? <BellOutlined /> : <ClockCircleOutlined />}
      </span>
      <button type="button" className="pp-reminder-main" onClick={open} aria-label={`Open reminder: ${title}`}>
        <span className="pp-task-title">{title}</span>
        <span className="pp-task-meta">
          <span className={`pp-badge${due ? " pp-badge-warning" : ""} pp-num`}>{whenText(at, now)}</span>
          {snoozed ? <span className="pp-badge">Snoozed</span> : null}
          {repeating ? (
            <span className="pp-priority">
              <RetweetOutlined /> {repeatLabel[reminder.recurrenceRule!]}
            </span>
          ) : null}
          {task ? <span className="pp-priority">Task</span> : note ? <span className="pp-priority">Note</span> : event ? <span className="pp-priority">Event</span> : null}
        </span>
      </button>
      <Flex gap={6} wrap justify="flex-end" className="pp-reminder-actions">
        {due ? (
          <>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: snoozeChoices(new Date()).map((c) => ({ key: c.label, label: c.label })),
                onClick: ({ key }) => {
                  const t = new Date();
                  const choice = snoozeChoices(t).find((c) => c.label === key);
                  if (choice) void runtime.write("reminder", snoozeReminder(reminder, choice.until, t));
                },
              }}
            >
              <Button size="small">Snooze</Button>
            </Dropdown>
            {task ? (
              <Button
                size="small"
                icon={<CheckOutlined />}
                onClick={() => {
                  const t = new Date();
                  void runtime.write("task", { ...setTaskStatus(task, "done", t), updatedAt: t.toISOString() });
                  void runtime.write("reminder", dismissReminder(reminder, t));
                }}
              >
                Done
              </Button>
            ) : null}
            <Button size="small" type="primary" onClick={() => void runtime.write("reminder", dismissReminder(reminder, new Date()))}>
              Dismiss
            </Button>
          </>
        ) : repeating ? (
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "skip", label: "Skip the next one" },
                { key: "stop", label: "Stop repeating", danger: true },
              ],
              onClick: ({ key }) => {
                const t = new Date();
                void runtime.write("reminder", key === "skip" ? dismissReminder(reminder, t) : endReminder(reminder, t));
              },
            }}
          >
            <IconButton size="small" icon={<EllipsisOutlined />} tip="Skip or stop repeating" label={`More for ${title}`} />
          </Dropdown>
        ) : null}
      </Flex>
    </div>
  );
}

const HIDE_KEY = "productivity:hide-notification-tip";

/** Browser notifications are optional: alerts always show inside the app while it's open. */
function NotificationPermission() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : "denied"));
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* fine: hidden for this visit */
    }
  };
  if (!supported || permission === "granted" || hidden) return null;
  if (permission === "denied") {
    return (
      <Alert
        type="info"
        showIcon
        closable={{ onClose: hide, "aria-label": "Hide" }}
        title="Browser notifications are blocked for this site"
        description="Reminders still show inside the app while it's open. To get them while you're in another tab, allow notifications in your browser's site settings."
      />
    );
  }
  return (
    <Alert
      type="info"
      showIcon
      icon={<BellOutlined />}
      closable={{ onClose: hide, "aria-label": "Not now" }}
      title="Get reminders while you're in another tab"
      description="Alerts always show inside the app while it's open. Allow browser notifications to see them over other tabs too. (For alerts with the app closed, use the Android app.)"
      action={
        <Button size="small" type="primary" onClick={() => void Notification.requestPermission().then(setPermission)}>
          Allow
        </Button>
      }
    />
  );
}
