import { Suspense, lazy, useMemo, useState } from "react";
import { App as AntApp, Card, Col, Input, Row, Segmented, Skeleton, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { groupTasks, localDate, newNote, newTask, type LocalNote, type LocalTask } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { getLiveModules } from "@/shared/modules/registry";
import { ModulePage } from "@/shared/page/ModulePage";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";

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
      await runtime.write("task", newTask(runtime.newId(), new Date(), { title: text }));
    } else {
      await runtime.write("note", newNote(runtime.newId(), new Date(), { text }));
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
        suffix={<span className="pp-label" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Enter to save</span>}
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
  const { records: tasks } = useLocalRecords<LocalTask & { deletedAt: string | null }>("task");
  const { records: notes } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");

  const groups = groupTasks(tasks, now, localDate(now));
  const dueToday = groups.today.length;
  const overdue = groups.overdue.length;

  const widgets = useMemo(
    () =>
      getLiveModules().flatMap((m) =>
        (m.widgets ?? []).map((w) => ({ ...w, key: `${m.key}:${w.id}`, Component: lazy(w.load) })),
      ),
    [],
  );

  return (
    <ModulePage
      eyebrow={now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
      title="Today"
      description="What needs you today, and everything you captured recently."
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <StatTile label="Due today" value={dueToday} hint={dueToday === 1 ? "task" : "tasks"} />
        </Col>
        <Col xs={12} md={8}>
          <StatTile
            label="Overdue"
            value={overdue}
            hint={overdue ? "need attention" : "all clear"}
            tone={overdue ? "error" : "neutral"}
          />
        </Col>
        <Col xs={24} md={8}>
          <StatTile label="Notes" value={notes.length} hint="saved on this device" tone="neutral" />
        </Col>
      </Row>

      <QuickCapture />

      {widgets.length ? (
        <Row gutter={[16, 16]}>
          {widgets.map(({ key, title, span, Component }) => (
            <Col key={key} xs={24} lg={span ?? 12}>
              <Card title={title} className="pp-card">
                <Suspense fallback={<Skeleton active />}>
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
