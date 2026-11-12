import React, { useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  buildReport,
  change,
  goalStatusLabel,
  localDate,
  minutesText,
  percentOf,
  previousRange,
  type ReportInput,
  type ReportRange,
} from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { Button, Chips, DateTimeButton } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import { StatRow, StatTile } from "../../../components/StatTile";
import { ListCardSkeleton, TileRowSkeleton } from "../../../components/Skeleton";
import { useDataReady } from "../../../shared/data/useDataReady";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { radii, usePalette } from "../../../theme";
import { dateOf, plusDays, ymd } from "../../calendar/components/items";
import { ColumnChart, Meter, RankedBars } from "../components/charts";
import { exportCsv, exportPdf } from "../components/exportReport";
import Sheet from "../../../components/Sheet";

type Preset = "7d" | "30d" | "month" | "90d" | "custom";
type View_ = "chart" | "table";

const presetOptions: { value: Preset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "90d", label: "90 days" },
  { value: "custom", label: "Custom" },
];

/** The range a preset means, ending today (inclusive) on this phone's calendar. */
function presetRange(p: Exclude<Preset, "custom">, today: string): ReportRange {
  const end = plusDays(dateOf(today), 1);
  if (p === "month") return { from: today.slice(0, 8) + "01", to: ymd(end) };
  const n = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  return { from: ymd(plusDays(end, -n)), to: ymd(end) };
}

/** Everything the report reads, live from this phone. */
function useReportInput(): { input: ReportInput; loading: boolean } {
  const t = useLocalRecords("task");
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
    () => ({ tasks: t.records, notes, projects, sessions, habits, habitLogs, goals, milestones, events, eventExceptions }) as unknown as ReportInput,
    [t.records, notes, projects, sessions, habits, habitLogs, goals, milestones, events, eventExceptions],
  );
  return { input, loading: t.loading };
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const shortDate = (d: string) => dateOf(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Reports: how a period went across tasks, focus, habits, projects, goals and
 * the calendar, against the period before. The same numbers as the web
 * (computed in the shared domain package); share as CSV.
 */
export default function ReportsScreen() {
  const p = usePalette();
  const today = localDate(new Date());
  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(() => plusDays(dateOf(today), -13));
  const [customTo, setCustomTo] = useState(() => dateOf(today));
  const [views, setViews] = useState<Record<string, View_>>({});
  const { input, loading: inputLoading } = useReportInput();
  // Before the first sync every figure would read 0, which looks like a real (bad) result.
  const loading = !(useDataReady(inputLoading) || input.tasks.length > 0);

  const range: ReportRange =
    preset === "custom"
      ? { from: ymd(customFrom), to: ymd(plusDays(customTo < customFrom ? customFrom : customTo, 1)) }
      : presetRange(preset, today);
  const report = useMemo(() => buildReport(input, range, today), [input, range.from, range.to, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => buildReport(input, previousRange(range), today), [input, range.from, range.to, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const period = `previous ${report.days} days`;
  const rangeText = `${shortDate(range.from)} – ${shortDate(ymd(plusDays(dateOf(range.to), -1)))}`;

  const view = (key: string): View_ => views[key] ?? "chart";
  const toggle = (key: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={view(key) === "chart" ? "Show as table" : "Show as chart"} hitSlop={10} onPress={() => setViews((s) => ({ ...s, [key]: view(key) === "chart" ? "table" : "chart" }))}>
      <Ionicons name={view(key) === "chart" ? "list-outline" : "bar-chart-outline"} size={18} color={p.textSecondary} />
    </Pressable>
  );

  // Export, as on the web: CSV for spreadsheets, or a PDF laid out for paper. Both go to the share sheet.
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const runExport = async (kind: "csv" | "pdf") => {
    setExporting(false);
    setBusy(kind);
    try {
      await new Promise((r) => setTimeout(r, 250)); // let the sheet close before Android's share sheet opens
      if (kind === "csv") await exportCsv(report);
      else await exportPdf(report, rangeText);
      if (Platform.OS === "android") ToastAndroid.show(kind === "csv" ? "Report exported as CSV" : "Report exported as PDF", ToastAndroid.SHORT);
    } catch (e) {
      Alert.alert("Couldn't export the report", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const dayTable = (rows: { date: string; value: number }[], heading: string) => (
    <View style={{ paddingBottom: 8 }}>
      <TableHead cols={["Date", heading]} />
      {rows
        .slice()
        .reverse()
        .map((r) => (
          <TableRow key={r.date} cells={[dateOf(r.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }), r.value.toLocaleString()]} />
        ))}
    </View>
  );

  return (
    <ScreenFrame eyebrow="Insight" title="Reports">
      <Chips value={preset} options={presetOptions} onChange={setPreset} />
      {preset === "custom" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <DateTimeButton label="From" mode="date" value={customFrom} onChange={setCustomFrom} />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeButton label="To" mode="date" value={customTo} onChange={setCustomTo} minimumDate={customFrom} />
          </View>
        </View>
      ) : null}
      <View style={styles.rangeRow}>
        <Text tone="secondary" style={{ fontSize: 13, flex: 1 }}>
          {`${rangeText}, compared with the ${report.days} days before.`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export report"
          disabled={loading || busy !== null}
          onPress={() => setExporting(true)}
          style={({ pressed }) => [styles.export, { backgroundColor: p.primary, opacity: loading || busy ? 0.5 : pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="download-outline" size={16} color={p.onPrimary} />
          <Text weight="semiBold" style={{ color: p.onPrimary, fontSize: 13 }}>
            {busy ? "Exporting…" : "Export"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <>
          <TileRowSkeleton count={2} />
          <TileRowSkeleton count={2} />
          <ListCardSkeleton rows={3} check={false} />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile
              icon="checkmark-circle"
              iconTone="success"
              label="Tasks completed"
              ring={{ percent: percentOf(report.tasks.completed, report.tasks.completed + report.tasks.overdue), label: "Cleared" }}
              subtitle="This period"
              value={report.tasks.completed.toLocaleString()}
              trend={{ now: report.tasks.completed, change: change(report.tasks.completed, before.tasks.completed), period: `vs ${period}` }}
              hint={`${before.tasks.completed.toLocaleString()} the ${report.days} days before`}
            />
            <StatTile
              icon="time"
              label="Focus time"
              ring={{ percent: percentOf(report.focus.completedSessions, report.focus.sessions), label: "Completed" }}
              subtitle="This period"
              value={minutesText(report.focus.minutes * 60)}
              trend={{ now: report.focus.minutes, change: change(report.focus.minutes, before.focus.minutes), period: `vs ${period}` }}
              hint={plural(report.focus.sessions, "session")}
            />
            <StatTile
              icon="flame"
              iconTone="warning"
              label="Habit consistency"
              subtitle="This period"
              value={report.habits.consistency === null ? "—" : `${report.habits.consistency}%`}
              trend={{ now: report.habits.consistency ?? 0, change: report.habits.consistency !== null && before.habits.consistency !== null ? report.habits.consistency - before.habits.consistency : null, unit: " pts", period: `vs ${period}` }}
              hint="of due days met"
              ring={{ percent: report.habits.consistency, label: "Met" }}
            />
            <StatTile
              icon="alarm"
              iconTone={report.tasks.overdue ? "error" : "accent"}
              label="Done on time"
              trend={{ now: report.tasks.onTimeRate ?? 0, change: report.tasks.onTimeRate !== null && before.tasks.onTimeRate !== null ? report.tasks.onTimeRate - before.tasks.onTimeRate : null, unit: " pts", period: `vs ${period}` }}
              subtitle="This period"
              value={report.tasks.onTimeRate === null ? "—" : `${report.tasks.onTimeRate}%`}
              hint={report.tasks.overdue ? `${report.tasks.overdue} open and overdue` : "Nothing overdue"}
              ring={{ percent: report.tasks.onTimeRate, label: "On time" }}
            />
            <StatTile
              icon="calendar"
              iconTone="accent"
              label="In the calendar"
              ring={{ percent: percentOf(report.calendar.hours, report.days * 8), label: "Of Work Hours" }}
              subtitle="This period"
              value={`${report.calendar.hours} h`}
              trend={{ now: report.calendar.hours, change: change(report.calendar.hours, before.calendar.hours), period: `vs ${period}` }}
              hint={plural(report.calendar.events, "event")}
            />
            <StatTile
              icon="add-circle"
              iconTone="ai"
              label="Created"
              ring={{ percent: percentOf(report.tasks.created, report.tasks.created + report.notes.created), label: "Tasks" }}
              subtitle="This period"
              value={(report.tasks.created + report.notes.created).toLocaleString()}
              trend={{ now: report.tasks.created + report.notes.created, change: change(report.tasks.created + report.notes.created, before.tasks.created + before.notes.created), period: `vs ${period}` }}
              hint={`${plural(report.tasks.created, "task")} · ${plural(report.notes.created, "note")}`}
            />
          </StatRow>

          <Card title="Tasks completed per day" right={toggle("tasks")}>
            {view("tasks") === "chart" ? (
              <View style={{ paddingBottom: 12 }}>
                <ColumnChart data={report.tasks.completedByDay} unit={["task", "tasks"]} label="Tasks completed per day" />
              </View>
            ) : (
              dayTable(report.tasks.completedByDay, "Completed")
            )}
          </Card>

          <Card title="Focus minutes per day" right={toggle("focus")}>
            {view("focus") === "chart" ? (
              <View style={{ paddingBottom: 12 }}>
                <ColumnChart data={report.focus.minutesByDay} unit={["minute", "minutes"]} label="Focus minutes per day" />
              </View>
            ) : (
              dayTable(report.focus.minutesByDay, "Minutes")
            )}
          </Card>

          <Card title="Habits">
            {report.habits.rows.length ? (
              report.habits.rows.map((r, n) => (
                <View key={r.title + n} style={[styles.item, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                      {r.title}
                    </Text>
                    {r.streak ? (
                      <View style={[styles.badge, { backgroundColor: p.successSoft }]}>
                        <Text style={{ fontSize: 11, color: p.successText }}>{`🔥 ${r.streak}`}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text tone="secondary" style={{ fontSize: 12 }}>
                    {`${r.schedule === "weekly" ? "Weekly" : "Daily"} · met ${r.met} of ${r.due} ${r.schedule === "weekly" ? "weeks" : "days"}`}
                  </Text>
                  <Meter percent={r.rate} label={`${r.title} consistency`} />
                </View>
              ))
            ) : (
              <Empty text="No habits yet." />
            )}
          </Card>

          <Card title="Projects: tasks completed" right={report.projects.length ? toggle("projects") : undefined}>
            {!report.projects.length ? (
              <Empty text="No projects yet." />
            ) : view("projects") === "chart" ? (
              <RankedBars rows={report.projects.slice(0, 8).map((x) => ({ label: x.title, value: x.completedInRange }))} unit={(v) => `${v} done`} />
            ) : (
              <View style={{ paddingBottom: 8 }}>
                <TableHead cols={["Project", "Done", "Open", "All"]} />
                {report.projects.map((x, i) => (
                  <TableRow key={x.title + i} cells={[x.title, String(x.completedInRange), String(x.open), String(x.total)]} />
                ))}
              </View>
            )}
          </Card>

          <Card title="Focus by task" right={report.focus.byTask.length ? toggle("byTask") : undefined}>
            {!report.focus.byTask.length ? (
              <Empty text="No focus sessions in this period." />
            ) : view("byTask") === "chart" ? (
              <RankedBars rows={report.focus.byTask.map((t) => ({ label: t.title, value: t.minutes }))} unit={(v) => minutesText(v * 60)} />
            ) : (
              <View style={{ paddingBottom: 8 }}>
                <TableHead cols={["Task", "Focus"]} />
                {report.focus.byTask.map((t, i) => (
                  <TableRow key={t.title + i} cells={[t.title, minutesText(t.minutes * 60)]} />
                ))}
              </View>
            )}
          </Card>

          <Card title="Goals">
            {report.goals.length ? (
              report.goals.map((g, n) => (
                <View key={g.title + n} style={[styles.item, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
                  <Text weight="medium" numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text tone="secondary" style={{ fontSize: 12 }}>
                    {`${goalStatusLabel[g.status]} · ${g.milestonesDone} of ${g.milestonesTotal} milestones · ${g.doneInRange} done in period`}
                  </Text>
                  <Meter percent={g.milestonesTotal ? g.percent : null} label={`${g.title} progress`} />
                </View>
              ))
            ) : (
              <Empty text="No goals yet." />
            )}
          </Card>

        </>
      )}
      <Sheet open={exporting} title="Export report" onClose={() => setExporting(false)}>
        <Text tone="secondary" style={{ fontSize: 13 }}>
          {rangeText}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void runExport("csv")} style={({ pressed }) => [styles.option, { borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="document-text-outline" size={22} color={p.primary} />
          <View style={{ flex: 1 }}>
            <Text weight="semiBold">CSV, for spreadsheets</Text>
            <Text tone="secondary" style={{ fontSize: 12 }}>
              Every figure and table, for Excel or Google Sheets.
            </Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void runExport("pdf")} style={({ pressed }) => [styles.option, { borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="print-outline" size={22} color={p.primary} />
          <View style={{ flex: 1 }}>
            <Text weight="semiBold">PDF, to print or share</Text>
            <Text tone="secondary" style={{ fontSize: 12 }}>
              Laid out for A4: the figures, then each breakdown.
            </Text>
          </View>
        </Pressable>
        <Button label="Cancel" onPress={() => setExporting(false)} />
      </Sheet>
    </ScreenFrame>
  );
}

const Empty = ({ text }: { text: string }) => (
  <Text tone="secondary" style={{ paddingBottom: 12 }}>
    {text}
  </Text>
);

function TableHead({ cols }: { cols: string[] }) {
  const p = usePalette();
  return (
    <View style={[styles.tr, { borderColor: p.borderStrong, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {cols.map((c, i) => (
        <Text key={c} label style={[styles.td, i ? styles.num : styles.first, { fontSize: 10 }]}>
          {c}
        </Text>
      ))}
    </View>
  );
}

function TableRow({ cells }: { cells: string[] }) {
  const p = usePalette();
  return (
    <View style={[styles.tr, { borderColor: p.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {cells.map((c, i) => (
        <Text key={i} numberOfLines={1} style={[styles.td, i ? styles.num : styles.first, { fontSize: 13 }]}>
          {c}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  export: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 9 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radii.md, padding: 14 },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { flexBasis: "48%", flexGrow: 1, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  item: { paddingVertical: 10, gap: 6 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tr: { flexDirection: "row", paddingVertical: 8, gap: 8 },
  td: { flex: 1 },
  first: { flex: 2 },
  num: { textAlign: "right" },
});
