import React, { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { useLocalRecords } from "@productivity/sync-engine/react";
import { Button, Chips, DateTimeButton } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { radii, usePalette } from "../../../theme";
import { dateOf, plusDays, ymd } from "../../calendar/components/items";
import { ColumnChart, Delta, Meter, RankedBars } from "../components/charts";

type Preset = "7d" | "30d" | "month" | "90d" | "custom";
type View_ = "chart" | "table";

const APP_NAME = "Creedence";
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
  const { input, loading } = useReportInput();

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

  const share = () =>
    void Share.share({
      title: `${APP_NAME} report, ${rangeText}`,
      message: reportToCsv(report, APP_NAME),
    });

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
      <Text tone="secondary" style={{ fontSize: 13 }}>
        {`${rangeText}, compared with the ${report.days} days before.`}
      </Text>

      {loading ? null : (
        <>
          <View style={styles.kpis}>
            <Kpi label="Tasks completed" value={report.tasks.completed.toLocaleString()} hint={<Delta value={change(report.tasks.completed, before.tasks.completed)} period={period} />} />
            <Kpi label="Focus time" value={minutesText(report.focus.minutes * 60)} hint={<Delta value={change(report.focus.minutes, before.focus.minutes)} period={period} />} />
            <Kpi
              label="Habit consistency"
              value={report.habits.consistency === null ? "—" : `${report.habits.consistency}%`}
              hint={
                report.habits.consistency !== null && before.habits.consistency !== null ? (
                  <Delta value={report.habits.consistency - before.habits.consistency} unit=" pts" period={period} />
                ) : (
                  <Hint text="of due days met" />
                )
              }
            />
            <Kpi
              label="Done on time"
              value={report.tasks.onTimeRate === null ? "—" : `${report.tasks.onTimeRate}%`}
              tone={report.tasks.overdue ? "error" : "primary"}
              hint={<Hint text={report.tasks.overdue ? `${report.tasks.overdue} open and overdue` : "Nothing overdue"} />}
            />
            <Kpi label="In the calendar" value={`${report.calendar.hours} h`} tone="neutral" hint={<Hint text={plural(report.calendar.events, "event")} />} />
            <Kpi
              label="Created"
              value={(report.tasks.created + report.notes.created).toLocaleString()}
              tone="neutral"
              hint={<Hint text={`${plural(report.tasks.created, "task")} · ${plural(report.notes.created, "note")}`} />}
            />
          </View>

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

          <Button label="Share as CSV" onPress={share} />
        </>
      )}
    </ScreenFrame>
  );
}

function Kpi({ label, value, hint, tone = "primary" }: { label: string; value: string; hint: React.ReactNode; tone?: "primary" | "error" | "neutral" }) {
  const p = usePalette();
  return (
    <View style={[styles.kpi, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text label style={{ fontSize: 10, letterSpacing: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text weight="extraBold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 24, letterSpacing: -0.6, color: tone === "error" ? p.errorText : tone === "primary" ? p.primary : p.heading }}>
        {value}
      </Text>
      {hint}
    </View>
  );
}

const Hint = ({ text }: { text: string }) => (
  <Text tone="muted" style={{ fontSize: 11 }} numberOfLines={2}>
    {text}
  </Text>
);

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
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kpi: { flexBasis: "48%", flexGrow: 1, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  item: { paddingVertical: 10, gap: 6 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tr: { flexDirection: "row", paddingVertical: 8, gap: 8 },
  td: { flex: 1 },
  first: { flex: 2 },
  num: { textAlign: "right" },
});
