import { Suspense, lazy, useMemo, useState } from "react";
import { App as AntApp, Card, Col, Input, Row, Skeleton } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { dueState, newNote, type LocalNote } from "@productivity/domain";
import type { Task } from "@productivity/contracts";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { getLiveModules } from "@/shared/modules/registry";
import { ModulePage } from "@/shared/page/ModulePage";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";

type LocalTask = Omit<Task, "userId"> & { userId?: string };

/**
 * Type and press Enter: saved as a note straight away, offline or not. The first
 * line becomes the note's title. Tasks and reminders join when those modules
 * land (Phase 2, capture registry).
 */
function QuickCapture() {
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const [value, setValue] = useState("");

  const capture = async () => {
    const text = value.trim();
    if (!text) return;
    await runtime.write("note", newNote(runtime.newId(), new Date(), { text }));
    setValue("");
    void message.success("Saved to Notes");
  };

  return (
    <Input
      size="large"
      prefix={<PlusOutlined />}
      suffix={<span className="pp-label" style={{ fontSize: 10, letterSpacing: "0.08em" }}>Enter to save</span>}
      placeholder="Capture a note"
      aria-label="Quick capture"
      maxLength={2000}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onPressEnter={() => void capture()}
    />
  );
}

/** The user's local calendar date, YYYY-MM-DD, for date-only due dates. */
const localToday = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/**
 * Today — the landing page (plan §4.2): the day's numbers up top, like the
 * portfolio card's big figure, then quick capture, then the panels each module
 * contributes through `widgets` in its manifest.
 */
export default function TodayPage() {
  const now = new Date();
  const { records: tasks } = useLocalRecords<LocalTask & { deletedAt: string | null }>("task");
  const { records: notes } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");

  const today = localToday(now);
  const states = tasks.map((t) => dueState(t, now, today));
  const dueToday = states.filter((s) => s === "due_soon").length;
  const overdue = states.filter((s) => s === "overdue").length;

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
