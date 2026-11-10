import { useMemo, useState, type ReactNode } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Flex,
  Row,
  Segmented,
  Table,
  Typography,
} from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FireOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import {
  buildReport,
  change,
  goalStatusLabel,
  localDate,
  minutesText,
  previousRange,
  reportToCsv,
  type ReportInput,
  type ReportRange,
} from "@productivity/domain";
import { ModulePage, useDataReady, useLocalRecords } from "@/shared";
import { APP_NAME } from "@/shared/brand";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Bone,
  ChartSkeleton,
  ListCardSkeleton,
  TileRowSkeleton,
} from "@/components/ui/Skeletons";
import { ColumnChart, Delta, Meter, RankedBars } from "../components/charts";

type Preset = "7d" | "30d" | "month" | "90d" | "custom";
type View = "chart" | "table";

const presetLabel: Record<Exclude<Preset, "custom">, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  "90d": "Last 90 days",
};

/** The range a preset means, ending today (inclusive) on this device's calendar. */
function presetRange(p: Exclude<Preset, "custom">, today: string): ReportRange {
  const end = dayjs(today).add(1, "day");
  if (p === "month")
    return {
      from: dayjs(today).startOf("month").format("YYYY-MM-DD"),
      to: end.format("YYYY-MM-DD"),
    };
  const n = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  return {
    from: end.subtract(n, "day").format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}

/** Everything the report reads, live from this device. */
function useReportInput(): { input: ReportInput; loading: boolean } {
  const taskRecords = useLocalRecords("task");
  const tasks = taskRecords.records;
  const notes = useLocalRecords("note").records;
  const projects = useLocalRecords("project").records;
  const sessions = useLocalRecords("focus_session").records;
  const habits = useLocalRecords("habit").records;
  const habitLogs = useLocalRecords("habit_log").records;
  const goals = useLocalRecords("goal").records;
  const milestones = useLocalRecords("goal_milestone").records;
  const events = useLocalRecords("event").records;
  const eventExceptions = useLocalRecords("event_exception").records;
  const input = useMemo(
    () =>
      ({
        tasks,
        notes,
        projects,
        sessions,
        habits,
        habitLogs,
        goals,
        milestones,
        events,
        eventExceptions,
      }) as unknown as ReportInput,
    [
      tasks,
      notes,
      projects,
      sessions,
      habits,
      habitLogs,
      goals,
      milestones,
      events,
      eventExceptions,
    ],
  );
  return { input, loading: taskRecords.loading };
}

/**
 * Reports: how a period went across tasks, focus, habits, projects, goals and
 * the calendar, against the period before. Exports as CSV (spreadsheets) or
 * PDF (the browser's print-to-PDF, laid out for paper).
 */
export default function ReportsPage() {
  const { message } = AntApp.useApp();
  const today = localDate(new Date());
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null);
  const [views, setViews] = useState<Record<string, View>>({});
  const { input, loading } = useReportInput();
  // Before the first sync every figure would read 0, which looks like a real (bad) result.
  const ready = useDataReady(loading) || input.tasks.length > 0;

  const range: ReportRange =
    preset === "custom" && custom
      ? {
          from: custom[0].format("YYYY-MM-DD"),
          to: custom[1].add(1, "day").format("YYYY-MM-DD"),
        }
      : presetRange(preset === "custom" ? "30d" : preset, today);
  const { from, to } = range;
  // The React Compiler memoises these; they rerun only when the records or range change.
  const report = buildReport(input, { from, to }, today);
  const before = buildReport(input, previousRange({ from, to }), today);
  const period = `previous ${report.days} days`;
  const rangeText = `${dayjs(range.from).format("D MMM YYYY")} – ${dayjs(range.to).subtract(1, "day").format("D MMM YYYY")}`;

  const view = (key: string): View => views[key] ?? "chart";
  const viewToggle = (key: string) => (
    <Segmented<View>
      size="small"
      value={view(key)}
      onChange={(v) => setViews((s) => ({ ...s, [key]: v }))}
      options={[
        { value: "chart", label: "Chart" },
        { value: "table", label: "Table" },
      ]}
      aria-label="Show as"
      className="pp-no-print"
    />
  );

  const exportCsv = () => {
    const csv = reportToCsv(report, APP_NAME);
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${APP_NAME.toLowerCase()}-report-${range.from}-to-${dayjs(range.to).subtract(1, "day").format("YYYY-MM-DD")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    void message.success("Report exported as CSV");
  };

  const dayTable = (
    rows: { date: string; value: number }[],
    heading: string,
    fmt: (v: number) => string = String,
  ) => (
    <Table
      size="small"
      pagination={rows.length > 14 ? { pageSize: 14, size: "small" } : false}
      rowKey="date"
      dataSource={rows}
      columns={[
        {
          title: "Date",
          dataIndex: "date",
          render: (d: string) => dayjs(d).format("ddd D MMM"),
        },
        {
          title: heading,
          dataIndex: "value",
          align: "right",
          render: (v: number) => <span className="pp-num">{fmt(v)}</span>,
        },
      ]}
    />
  );

  return (
    <ModulePage
      eyebrow="Insight"
      title="Reports"
      description={`How ${rangeText} went, compared with the ${report.days} days before.`}
      actions={
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              {
                key: "csv",
                icon: <FileTextOutlined />,
                label: "CSV, for spreadsheets",
              },
              {
                key: "pdf",
                icon: <FilePdfOutlined />,
                label: "PDF, to print or share",
              },
            ],
            onClick: ({ key }) =>
              key === "csv" ? exportCsv() : window.print(),
          }}
        >
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            className="pp-no-print"
          >
            Export
          </Button>
        </Dropdown>
      }
    >
      <div className="pp-print-only pp-print-head">
        <strong>{APP_NAME} report</strong> · {rangeText}
      </div>

      <Flex
        gap={8}
        wrap
        align="center"
        className="pp-no-print pp-report-filters"
      >
        <Segmented<Preset>
          value={preset}
          onChange={setPreset}
          options={[
            ...(Object.keys(presetLabel) as Exclude<Preset, "custom">[]).map(
              (p) => ({ value: p, label: presetLabel[p] }),
            ),
            { value: "custom", label: "Custom" },
          ]}
          aria-label="Period"
        />
        {preset === "custom" ? (
          <DatePicker.RangePicker
            value={custom}
            onChange={(v) => setCustom(v && v[0] && v[1] ? [v[0], v[1]] : null)}
            disabledDate={(d) => d.isAfter(dayjs(today), "day")}
            format="D MMM YYYY"
            allowClear={false}
            aria-label="Custom period"
          />
        ) : null}
      </Flex>

      {!ready ? (
        <>
          <TileRowSkeleton count={6} span={{ xs: 12, md: 8, xl: 4 }} />
          <Row gutter={[16, 16]}>
            {[0, 1].map((i) => (
              <Col key={i} xs={24} xl={12}>
                <Card className="pp-card" title={<Bone w={160} h={11} />}>
                  <ChartSkeleton />
                </Card>
              </Col>
            ))}
          </Row>
          <ListCardSkeleton rows={4} check={false} />
        </>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Kpi
              label="Tasks completed"
              value={report.tasks.completed.toLocaleString()}
              hint={
                <Delta
                  value={change(report.tasks.completed, before.tasks.completed)}
                  period={period}
                />
              }
            />
            <Kpi
              label="Focus time"
              value={minutesText(report.focus.minutes * 60)}
              hint={
                <Delta
                  value={change(report.focus.minutes, before.focus.minutes)}
                  period={period}
                />
              }
            />
            <Kpi
              label="Habit consistency"
              value={
                report.habits.consistency === null
                  ? "—"
                  : `${report.habits.consistency}%`
              }
              hint={
                report.habits.consistency !== null &&
                before.habits.consistency !== null ? (
                  <Delta
                    value={
                      report.habits.consistency - before.habits.consistency
                    }
                    unit=" pts"
                    period={period}
                  />
                ) : (
                  <span className="pp-delta">of due days met</span>
                )
              }
            />
            <Kpi
              label="Done on time"
              value={
                report.tasks.onTimeRate === null
                  ? "—"
                  : `${report.tasks.onTimeRate}%`
              }
              hint={
                <span className="pp-delta">
                  {report.tasks.overdue
                    ? `${report.tasks.overdue} open and overdue`
                    : "Nothing overdue"}
                </span>
              }
              tone={report.tasks.overdue ? "error" : "primary"}
            />
            <Kpi
              label="In the calendar"
              value={`${report.calendar.hours} h`}
              hint={
                <span className="pp-delta">
                  {plural(report.calendar.events, "event")}
                </span>
              }
              tone="neutral"
            />
            <Kpi
              label="Created"
              value={(
                report.tasks.created + report.notes.created
              ).toLocaleString()}
              hint={
                <span className="pp-delta">
                  {plural(report.tasks.created, "task")} ·{" "}
                  {plural(report.notes.created, "note")}
                </span>
              }
              tone="neutral"
            />
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card
                className="pp-card pp-report-card"
                title="Tasks completed per day"
                extra={viewToggle("tasks")}
              >
                {view("tasks") === "chart" ? (
                  <ColumnChart
                    data={report.tasks.completedByDay}
                    unit={["task", "tasks"]}
                    label="Tasks completed per day"
                  />
                ) : (
                  dayTable(report.tasks.completedByDay, "Completed")
                )}
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                className="pp-card pp-report-card"
                title="Focus minutes per day"
                extra={viewToggle("focus")}
              >
                {view("focus") === "chart" ? (
                  <ColumnChart
                    data={report.focus.minutesByDay}
                    unit={["minute", "minutes"]}
                    label="Focus minutes per day"
                  />
                ) : (
                  dayTable(report.focus.minutesByDay, "Minutes")
                )}
              </Card>
            </Col>
          </Row>

          <Card className="pp-card pp-report-card" title="Habits">
            {report.habits.rows.length ? (
              <Table
                size="small"
                pagination={false}
                rowKey="title"
                dataSource={report.habits.rows}
                scroll={{ x: 560 }}
                columns={[
                  { title: "Habit", dataIndex: "title" },
                  {
                    title: "Schedule",
                    dataIndex: "schedule",
                    render: (s: string) =>
                      s === "weekly" ? "Weekly" : "Daily",
                  },
                  {
                    title: "Met",
                    key: "met",
                    align: "right",
                    render: (_: unknown, r) => (
                      <span className="pp-num">
                        {r.met} of {r.due}{" "}
                        {r.schedule === "weekly" ? "weeks" : "days"}
                      </span>
                    ),
                  },
                  {
                    title: "Consistency",
                    dataIndex: "rate",
                    width: 200,
                    render: (v: number | null, r) => (
                      <Meter percent={v} label={`${r.title} consistency`} />
                    ),
                  },
                  {
                    title: "Streak now",
                    dataIndex: "streak",
                    align: "right",
                    render: (v: number) =>
                      v ? (
                        <span className="pp-badge pp-badge-success">
                          <FireOutlined /> {v}
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                ]}
              />
            ) : (
              <EmptyState compact text="No habits yet." />
            )}
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card
                className="pp-card pp-report-card"
                title="Projects: tasks completed"
                extra={report.projects.length ? viewToggle("projects") : null}
              >
                {!report.projects.length ? (
                  <EmptyState compact text="No projects yet." />
                ) : view("projects") === "chart" ? (
                  <RankedBars
                    rows={report.projects
                      .slice(0, 8)
                      .map((p) => ({
                        label: p.title,
                        value: p.completedInRange,
                      }))}
                    unit={(v) => `${v} done`}
                  />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="title"
                    dataSource={report.projects}
                    columns={[
                      { title: "Project", dataIndex: "title" },
                      {
                        title: "Completed",
                        dataIndex: "completedInRange",
                        align: "right",
                      },
                      { title: "Open", dataIndex: "open", align: "right" },
                      {
                        title: "All tasks",
                        dataIndex: "total",
                        align: "right",
                      },
                    ]}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card
                className="pp-card pp-report-card"
                title="Focus by task"
                extra={report.focus.byTask.length ? viewToggle("byTask") : null}
              >
                {!report.focus.byTask.length ? (
                  <EmptyState
                    compact
                    text="No focus sessions in this period."
                  />
                ) : view("byTask") === "chart" ? (
                  <RankedBars
                    rows={report.focus.byTask.map((t) => ({
                      label: t.title,
                      value: t.minutes,
                    }))}
                    unit={(v) => minutesText(v * 60)}
                  />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="title"
                    dataSource={report.focus.byTask}
                    columns={[
                      { title: "Task", dataIndex: "title" },
                      {
                        title: "Focus",
                        dataIndex: "minutes",
                        align: "right",
                        render: (v: number) => minutesText(v * 60),
                      },
                    ]}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Card className="pp-card pp-report-card" title="Goals">
            {report.goals.length ? (
              <Table
                size="small"
                pagination={false}
                rowKey="title"
                dataSource={report.goals}
                scroll={{ x: 560 }}
                columns={[
                  { title: "Goal", dataIndex: "title" },
                  {
                    title: "Status",
                    dataIndex: "status",
                    render: (s: keyof typeof goalStatusLabel) =>
                      goalStatusLabel[s],
                  },
                  {
                    title: "Milestones",
                    key: "ms",
                    align: "right",
                    render: (_: unknown, g) => (
                      <span className="pp-num">
                        {g.milestonesDone} of {g.milestonesTotal}
                      </span>
                    ),
                  },
                  {
                    title: "Done in period",
                    dataIndex: "doneInRange",
                    align: "right",
                  },
                  {
                    title: "Progress",
                    dataIndex: "percent",
                    width: 200,
                    render: (v: number, g) => (
                      <Meter
                        percent={g.milestonesTotal ? v : null}
                        label={`${g.title} progress`}
                      />
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState compact text="No goals yet." />
            )}
          </Card>
        </>
      )}

      <Typography.Text
        type="secondary"
        className="pp-print-only"
        style={{ fontSize: 11 }}
      >
        Made with {APP_NAME} on {dayjs().format("D MMM YYYY, HH:mm")}.
      </Typography.Text>
    </ModulePage>
  );
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

function Kpi({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
  tone?: "primary" | "error" | "neutral";
}) {
  return (
    <Col xs={12} md={8} xl={4} className="pp-kpi">
      <StatTile
        size="small"
        label={label}
        value={value}
        hint={hint}
        tone={tone}
      />
    </Col>
  );
}
