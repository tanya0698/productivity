import { Suspense, lazy, useMemo, useState } from "react";
import {
  App as AntApp,
  Card,
  Col,
  Input,
  Row,
  Segmented,
  Space,
} from "antd";
import { CalendarOutlined, FileTextOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import {
  groupTasks,
  localDate,
  notesTrend,
  dueTodayTrend,
  overdueTrend,
  onTrackShare,
  percentOf,
  todayDoneShare,
  newNote,
  newTask,
  type LocalNote,
  type LocalTask,
} from "@productivity/domain";
import {
  useLocalRecords,
  useSyncRuntime,
} from "@productivity/sync-engine/react";
import { getLiveModules } from "@/shared/modules/registry";
import { ModulePage } from "@/shared/page/ModulePage";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { RowsSkeleton, TileRowSkeleton } from "@/components/ui/Skeletons";
import { useDataReady } from "@/shared/data/useDataReady";
import { useOptionalAuth } from "@/shared/auth/AuthProvider";
import { firstName } from "@/shared/auth/profile";

/** "Good morning, Elton." by the hour on this device; just "Good morning." without a name. */
function greeting(now: Date, name: string): string {
  const h = now.getHours();
  const part =
    h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}${name ? `, ${name}` : ""}.`;
}

type CaptureKind = "task" | "note";
const CAPTURE_KEY = "productivity:capture-kind";

/**
 * Type and press Enter: saved straight away, offline or not, as a task (the
 * text is its title) or a note (the first line is its title). The choice is
 * remembered on this device. Reminders join when that module lands.
 */
function QuickCapture() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<CaptureKind>(() => {
    try {
      return localStorage.getItem(CAPTURE_KEY) === "note" ? "note" : "task";
    } catch {
      return "task";
    }
  });

  const choose = (next: CaptureKind) => {
    setKind(next);
    try {
      localStorage.setItem(CAPTURE_KEY, next);
    } catch {
      /* not remembered; still works */
    }
  };

  const capture = async () => {
    const text = value.trim();
    if (!text) return;
    if (kind === "task") {
      await runtime.write(
        "task",
        newTask(runtime.newId(), new Date(), { title: text }),
      );
    } else {
      await runtime.write(
        "note",
        newNote(runtime.newId(), new Date(), { text }),
      );
    }
    setValue("");
    void message.success(kind === "task" ? "Added to Tasks" : "Saved to Notes");
  };

  return (
    <Space.Compact block size="large">
      <Segmented<CaptureKind>
        size="large"
        value={kind}
        onChange={choose}
        options={[
          { value: "task", label: "Task" },
          { value: "note", label: "Note" },
        ]}
        aria-label="Capture as"
      />
      <Input
        prefix={<PlusOutlined />}
        suffix={
          <span
            className="pp-label"
            style={{ fontSize: 10, letterSpacing: "0.08em" }}
          >
            Enter to save
          </span>
        }
        placeholder={kind === "task" ? "Capture a task" : "Capture a note"}
        aria-label="Quick capture"
        maxLength={2000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={() => void capture()}
      />
    </Space.Compact>
  );
}

/**
 * Today — the landing page (plan §4.2): the day's numbers up top, like the
 * portfolio card's big figure, then quick capture, then the panels each module
 * contributes through `widgets` in its manifest.
 */
export default function TodayPage() {
  const now = new Date();
  const name = firstName(useOptionalAuth()?.session?.user);
  const { records: tasks, loading } = useLocalRecords<
    LocalTask & { deletedAt: string | null }
  >("task");
  const ready = useDataReady(loading) || tasks.length > 0;
  const { records: notes } = useLocalRecords<
    LocalNote & { deletedAt: string | null }
  >("note");

  const groups = groupTasks(tasks, now, localDate(now));
  const dueToday = groups.today.length;
  const overdue = groups.overdue.length;

  const widgets = useMemo(
    () =>
      getLiveModules().flatMap((m) =>
        (m.widgets ?? []).map((w) => ({
          ...w,
          key: `${m.key}:${w.id}`,
          Component: lazy(w.load),
        })),
      ),
    [],
  );

  return (
    <ModulePage
      eyebrow={now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
      title="Today"
      description={`${greeting(now, name)} Here's what needs you today, and everything you captured recently.`}
    >
      {!ready ? (
        <TileRowSkeleton />
      ) : (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={8}>
            <StatTile
              icon={<CalendarOutlined />}
              label="Due today"
              trend={{ ...dueTodayTrend(tasks, localDate(now)), goodWhenUp: false, period: "vs yesterday" }}
              subtitle="Tasks"
              value={dueToday}
              hint={dueToday === 1 ? "task left" : "tasks left"}
              ring={{ percent: todayDoneShare(tasks, dueToday, localDate(now)), label: "Done" }}
            />
          </Col>
          <Col xs={12} md={8}>
            <StatTile
              icon={<WarningOutlined />}
              iconTone={overdue ? "error" : "success"}
              label="Overdue"
              trend={{ ...overdueTrend(tasks, localDate(now)), goodWhenUp: false }}
              ring={{ percent: onTrackShare(groups.overdue.length + groups.today.length + groups.upcoming.length, groups.overdue.length), label: "On Track" }}
              subtitle="Tasks"
              value={overdue}
              hint={overdue ? "need attention" : "all clear"}
              tone={overdue ? "error" : "neutral"}
            />
          </Col>
          <Col xs={24} md={8}>
            <StatTile
              icon={<FileTextOutlined />}
              iconTone="accent"
              label="Notes"
              ring={{ percent: percentOf(notes.filter((n) => n.projectId).length, notes.length), label: "In Projects" }}
              subtitle="On this device"
              value={notes.length}
              hint={`${notesTrend(notes, localDate(now)).now} written this week`}
              trend={{ ...notesTrend(notes, localDate(now)) }}
              tone="neutral"
            />
          </Col>
        </Row>
      )}

      <QuickCapture />

      {widgets.length ? (
        <Row gutter={[16, 16]}>
          {widgets.map(({ key, title, span, Component }) => (
            <Col key={key} xs={24} lg={span ?? 12}>
              <Card title={title} className="pp-card">
                <Suspense fallback={<RowsSkeleton rows={3} check={false} />}>
                  <Component />
                </Suspense>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card className="pp-card">
          <EmptyState text="Tasks due today, your next event and reminders will appear here." />
        </Card>
      )}
    </ModulePage>
  );
}
