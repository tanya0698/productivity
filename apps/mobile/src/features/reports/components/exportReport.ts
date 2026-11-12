import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { goalStatusLabel, minutesText, reportToCsv, type Report } from "@productivity/domain";

/**
 * Export a report the way the web does: a CSV file for spreadsheets (the same
 * file, from the shared reportToCsv), or a PDF laid out for paper. Both are
 * written to the phone's cache and handed to Android's share sheet, so they
 * can go to Drive, email, a chat, or a printer.
 */

const APP_NAME = "Creedence";

const fileStem = (r: Report) => `${APP_NAME.toLowerCase()}-report-${r.range.from}-to-${lastDay(r)}`;
const lastDay = (r: Report) => {
  const [y, m, d] = r.range.to.split("-").map(Number) as [number, number, number];
  const last = new Date(y, m - 1, d - 1);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
};

async function share(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : "com.adobe.pdf" });
}

/** The report as a .csv file (with a BOM, so Excel reads accents right), shared. */
export async function exportCsv(report: Report): Promise<void> {
  const file = new File(Paths.cache, `${fileStem(report)}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write("﻿" + reportToCsv(report, APP_NAME));
  await share(file.uri, "text/csv", "Share report as CSV");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? "" : "s"}`;
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

function table(head: string[], rows: string[][]): string {
  if (!rows.length) return `<p class="empty">Nothing in this period.</p>`;
  return `<table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

/** The report laid out for A4: the figures, then each breakdown as a table. */
export function reportHtml(report: Report, rangeText: string): string {
  const r = report;
  const kpis: [string, string, string][] = [
    ["Tasks completed", r.tasks.completed.toLocaleString(), `${r.tasks.created.toLocaleString()} created`],
    ["Focus time", minutesText(r.focus.minutes * 60), plural(r.focus.sessions, "session")],
    ["Habit consistency", pct(r.habits.consistency), "of due days met"],
    ["Done on time", pct(r.tasks.onTimeRate), r.tasks.overdue ? `${r.tasks.overdue} open and overdue` : "Nothing overdue"],
    ["In the calendar", `${r.calendar.hours} h`, plural(r.calendar.events, "event")],
    ["Notes written", r.notes.created.toLocaleString(), "this period"],
  ];
  const made = new Date().toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Segoe UI", sans-serif; color: #0f172a; font-size: 11pt; margin: 0; }
  .brand { font-family: monospace; letter-spacing: 3px; text-transform: uppercase; color: #0f766e; font-size: 9pt; }
  h1 { font-size: 22pt; margin: 4px 0 2px; }
  .range { color: #475569; margin: 0 0 18px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; break-inside: avoid; }
  .kpi .label { font-size: 8.5pt; color: #475569; text-transform: capitalize; }
  .kpi .value { font-size: 18pt; font-weight: 700; margin: 2px 0; }
  .kpi .hint { font-size: 8pt; color: #64748b; text-transform: capitalize; }
  h2 { font-size: 12pt; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: auto; }
  th { text-align: left; color: #475569; font-weight: 600; border-bottom: 1px solid #cbd5e1; padding: 5px 4px; }
  td { border-bottom: 1px solid #f1f5f9; padding: 5px 4px; }
  tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: #64748b; font-size: 9.5pt; }
  footer { margin-top: 22px; color: #94a3b8; font-size: 8pt; }
</style></head><body>
  <div class="brand">${APP_NAME}</div>
  <h1>Report</h1>
  <p class="range">${esc(rangeText)}, compared with the ${r.days} days before.</p>
  <div class="kpis">${kpis
    .map(([l, v, h]) => `<div class="kpi"><div class="label">${esc(l)}</div><div class="value">${esc(v)}</div><div class="hint">${esc(h)}</div></div>`)
    .join("")}</div>
  <h2>Habits</h2>
  ${table(
    ["Habit", "Schedule", "Met", "Consistency", "Streak now"],
    r.habits.rows.map((h) => [h.title, h.schedule === "weekly" ? "Weekly" : "Daily", `${h.met} of ${h.due}`, pct(h.rate), h.streak ? String(h.streak) : "—"]),
  )}
  <h2>Projects</h2>
  ${table(["Project", "Done in period", "Open", "All tasks"], r.projects.map((p) => [p.title, String(p.completedInRange), String(p.open), String(p.total)]))}
  <h2>Focus by task</h2>
  ${table(["Task", "Focus"], r.focus.byTask.map((t) => [t.title, minutesText(t.minutes * 60)]))}
  <h2>Goals</h2>
  ${table(
    ["Goal", "Status", "Milestones", "Done in period", "Progress"],
    r.goals.map((g) => [g.title, goalStatusLabel[g.status], `${g.milestonesDone} of ${g.milestonesTotal}`, String(g.doneInRange), g.milestonesTotal ? `${g.percent}%` : "—"]),
  )}
  <h2>Tasks completed per day</h2>
  ${table(["Date", "Completed"], r.tasks.completedByDay.filter((d) => d.value).map((d) => [d.date, String(d.value)]))}
  <h2>Focus minutes per day</h2>
  ${table(["Date", "Minutes"], r.focus.minutesByDay.filter((d) => d.value).map((d) => [d.date, String(d.value)]))}
  <footer>Made with ${APP_NAME} on ${esc(made)}.</footer>
</body></html>`;
}

/** The report as a PDF (A4), shared: print it, save it to Drive, or send it. */
export async function exportPdf(report: Report, rangeText: string): Promise<void> {
  // A4 at 72 dpi.
  const { uri } = await Print.printToFileAsync({ html: reportHtml(report, rangeText), width: 595, height: 842 });
  // Give it a readable name rather than a random one.
  const named = new File(Paths.cache, `${fileStem(report)}.pdf`);
  if (named.exists) named.delete();
  await new File(uri).move(named);
  await share(named.uri, "application/pdf", "Share report as PDF");
}
