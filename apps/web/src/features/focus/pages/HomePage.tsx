import { useMemo, useState } from "react";
import { Alert, Button, Card, Col, Flex, Row, Segmented, Select, Typography } from "antd";
import { CalendarOutlined, CaretRightOutlined, CheckOutlined, ClockCircleOutlined, PauseOutlined, StopOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  focusTrend,
  percentOf,
  FOCUS_DAY_TARGET_MIN,
  FOCUS_WEEK_TARGET_MIN,
  localDate,
  FOCUS_PRESETS,
  clock,
  elapsedMs,
  focusStats,
  isDone,
  minutesText,
  remainingMs,
  type LocalFocusSession,
} from "@productivity/domain";
import { ModulePage, useFocus, useLocalRecords, useNow, useTicking, type Task, useDataReady } from "@/shared";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { RowsSkeleton } from "@/components/ui/Skeletons";

type Session = LocalFocusSession & { deletedAt: string | null };
const PRESET_KEY = "productivity:focus-preset";

const savedPreset = () => {
  try {
    const i = Number(localStorage.getItem(PRESET_KEY));
    return Number.isInteger(i) && i >= 0 && i < FOCUS_PRESETS.length ? i : 0;
  } catch {
    return 0;
  }
};

/**
 * Focus: a timer for one stretch of work (optionally on a task), then a
 * break. Only finished sessions are saved and synced; the timer itself keeps
 * running on this device if you switch pages or reload.
 */
export default function HomePage() {
  const { timer, finished, start, pause, resume, stop, dismissFinished } = useFocus();
  const now = useTicking(!!timer?.runningSince);
  const today = useNow(60_000);
  const { records: sessions, loading: sessionsLoading } = useLocalRecords<Session>("focus_session");
  const ready = useDataReady(sessionsLoading);
  const { records: tasks } = useLocalRecords<Task>("task");
  const [preset, setPreset] = useState(savedPreset);
  const [taskId, setTaskId] = useState<string | null>(null);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const stats = focusStats(sessions, today);
  const recent = useMemo(
    () => sessions.filter((s) => s.kind === "focus").sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12),
    [sessions],
  );
  const { focus: focusMin, rest } = FOCUS_PRESETS[preset]!;

  const choosePreset = (i: number) => {
    setPreset(i);
    try {
      localStorage.setItem(PRESET_KEY, String(i));
    } catch {
      /* remembered for this visit */
    }
  };

  const total = timer ? timer.plannedMinutes * 60_000 : focusMin * 60_000;
  const left = timer ? remainingMs(timer, now) : total;
  const fraction = timer ? Math.min(1, elapsedMs(timer, now) / total) : 0;
  const linkedTask = timer?.taskId ? taskById.get(timer.taskId) : undefined;
  const openTasks = tasks.filter((t) => !isDone(t)).map((t) => ({ value: t.id, label: t.title }));

  return (
    <ModulePage eyebrow="Grow" title="Focus" description="One thing at a time: work for a set stretch, then take a short break.">
      {finished && !timer ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckOutlined />}
          title={finished.kind === "focus" ? `${finished.minutes} minutes of focus done.` : "Break over."}
          description={finished.kind === "focus" ? `Take a ${rest}-minute break before the next one.` : "Ready for another session?"}
          action={
            <Flex gap={8} wrap>
              {finished.kind === "focus" ? (
                <Button size="small" type="primary" onClick={() => start("break", rest)}>
                  Start {rest}-min break
                </Button>
              ) : (
                <Button size="small" type="primary" onClick={() => start("focus", focusMin, { taskId })}>
                  Start focus
                </Button>
              )}
              <Button size="small" onClick={dismissFinished}>
                {finished.kind === "focus" ? "Skip break" : "Not now"}
              </Button>
            </Flex>
          }
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card className="pp-card pp-focus-card">
            <Flex vertical align="center" gap={20}>
              <span className="pp-label pp-label-brand">{timer ? (timer.kind === "focus" ? "Focus" : "Break") : "Ready"}</span>
              <Ring fraction={fraction} kind={timer?.kind ?? "focus"}>
                <span className="pp-focus-clock pp-num" role="timer" aria-live="off" aria-label={`${clock(left)} left`}>
                  {clock(left)}
                </span>
                <span className="pp-focus-sub">
                  {timer ? (timer.runningSince ? `of ${timer.plannedMinutes} min` : "Paused") : `${focusMin} min focus · ${rest} min break`}
                </span>
              </Ring>

              {timer ? (
                <>
                  {linkedTask ? (
                    <Typography.Text type="secondary">
                      On: <strong>{linkedTask.title}</strong>
                    </Typography.Text>
                  ) : null}
                  <Flex gap={8}>
                    {timer.runningSince ? (
                      <Button size="large" icon={<PauseOutlined />} onClick={pause}>
                        Pause
                      </Button>
                    ) : (
                      <Button size="large" type="primary" icon={<CaretRightOutlined />} onClick={resume}>
                        Resume
                      </Button>
                    )}
                    <Button size="large" icon={<StopOutlined />} onClick={stop}>
                      {timer.kind === "focus" ? "Stop" : "End break"}
                    </Button>
                  </Flex>
                  {timer.kind === "focus" ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Stopping early still saves the time, if it was at least a minute.
                    </Typography.Text>
                  ) : null}
                </>
              ) : (
                <Flex vertical gap={12} align="stretch" style={{ width: "100%", maxWidth: 380 }}>
                  <Segmented<number>
                    block
                    value={preset}
                    onChange={choosePreset}
                    options={FOCUS_PRESETS.map((p, i) => ({ value: i, label: p.label }))}
                    aria-label="Focus and break length"
                  />
                  <Select
                    allowClear
                    showSearch={{ optionFilterProp: "label" }}
                    placeholder="Working on a task? (optional)"
                    value={taskId}
                    onChange={(v) => setTaskId(v ?? null)}
                    options={openTasks}
                    aria-label="Task"
                  />
                  <Button
                    size="large"
                    type="primary"
                    icon={<CaretRightOutlined />}
                    onClick={() => start("focus", focusMin, { taskId, projectId: taskId ? (taskById.get(taskId)?.projectId ?? null) : null })}
                  >
                    Start focus
                  </Button>
                </Flex>
              )}
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Flex vertical gap={16}>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <StatTile
                  size="small"
                  icon={<ClockCircleOutlined />}
                  label="Today"
                  ring={{ percent: percentOf(Math.round(stats.todaySeconds / 60), FOCUS_DAY_TARGET_MIN), label: "Of 2 H" }}
                  subtitle="Focus time"
                  value={minutesText(stats.todaySeconds)}
                  hint={`${stats.sessionsToday} session${stats.sessionsToday === 1 ? "" : "s"}`}
                  trend={{ change: focusTrend(sessions, localDate(today), 1).change, period: "vs yesterday" }}
                />
              </Col>
              <Col span={12}>
                <StatTile
                  size="small"
                  icon={<CalendarOutlined />}
                  iconTone="accent"
                  label="This week"
                  ring={{ percent: percentOf(Math.round(stats.weekSeconds / 60), FOCUS_WEEK_TARGET_MIN), label: "Of 10 H" }}
                  subtitle="Since Monday"
                  value={minutesText(stats.weekSeconds)}
                  hint={`${minutesText(focusTrend(sessions, localDate(today)).now * 60)} in the last 7 days`}
                  trend={{ change: focusTrend(sessions, localDate(today)).change }}
                  tone="neutral"
                />
              </Col>
            </Row>
            <Card className="pp-card" title="Recent sessions">
              {!ready && !recent.length ? (
                <RowsSkeleton rows={4} check={false} />
              ) : recent.length ? (
                <ul className="pp-note-list">
                  {recent.map((s) => (
                    <li key={s.id} className="pp-focus-session">
                      <span className="pp-num pp-focus-session-time">{dayjs(s.startedAt).format("ddd D MMM, HH:mm")}</span>
                      <span className="pp-task-title" style={{ flex: 1, minWidth: 0 }}>
                        {(s.taskId && taskById.get(s.taskId)?.title) || "Focus"}
                      </span>
                      <span className={`pp-badge${s.completed ? " pp-badge-success" : ""} pp-num`}>
                        {minutesText(s.durationSeconds)}
                        {s.completed ? "" : " · stopped"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact text="No sessions yet. Your finished sessions show up here." />
              )}
            </Card>
          </Flex>
        </Col>
      </Row>
    </ModulePage>
  );
}

/** A progress ring: teal for focus, the accent for a break. */
function Ring({ fraction, kind, children }: { fraction: number; kind: "focus" | "break"; children: React.ReactNode }) {
  const r = 108;
  const c = 2 * Math.PI * r;
  return (
    <div className="pp-focus-ring">
      <svg viewBox="0 0 240 240" width="240" height="240" aria-hidden>
        <circle cx="120" cy="120" r={r} fill="none" stroke="var(--pp-muted)" strokeWidth="10" />
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke={kind === "focus" ? "var(--pp-primary)" : "var(--pp-accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform="rotate(-90 120 120)"
          className="pp-focus-arc"
        />
      </svg>
      <div className="pp-focus-ring-inner">{children}</div>
    </div>
  );
}
