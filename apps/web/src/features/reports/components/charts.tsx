import { Tooltip } from "antd";
import dayjs from "dayjs";
import { niceTicks } from "./ticks";

/**
 * Small charts for reports, following the dataviz specs: one hue (the
 * validated chart teal per theme), thin columns with 4px rounded ends square
 * at the baseline, hairline solid grid, a 2px gap between bars, a tooltip on
 * every bar (also on keyboard focus), and the extreme value labelled once.
 * Every chart has a table twin on the page, so no value is tooltip-only.
 */

const fmt = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString());

export function ColumnChart({
  data,
  unit,
  label,
  height = 180,
}: {
  data: { date: string; value: number }[];
  /** "task" → "3 tasks". */
  unit: [singular: string, plural: string];
  label: string;
  height?: number;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;
  const peak = data.findIndex((d) => d.value === max && max > 0);
  // Up to a week: every day ("Mon"). Up to two weeks: every other day. Longer:
  // Mondays only. Each label gets room for itself, so labels never collide.
  const showLabel = (d: string, i: number) =>
    data.length <= 7 ? true : data.length <= 14 ? i % 2 === 0 : dayjs(d).day() === 1 && i <= data.length - 3;
  const words = (v: number) => `${v.toLocaleString()} ${v === 1 ? unit[0] : unit[1]}`;

  return (
    <div className="pp-chart" role="img" aria-label={`${label}: ${data.map((d) => `${dayjs(d.date).format("D MMM")} ${words(d.value)}`).join(", ")}`}>
      <div className="pp-chart-plot" style={{ height }}>
        <div className="pp-chart-grid" aria-hidden>
          {ticks.map((t) => (
            <div key={t} className="pp-chart-gridline" style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="pp-num">{fmt(t)}</span>
            </div>
          ))}
        </div>
        <div className="pp-chart-bars">
          {data.map((d, i) => {
            const h = top ? (d.value / top) * 100 : 0;
            return (
              <Tooltip
                key={d.date}
                title={
                  <span>
                    <strong>{words(d.value)}</strong>
                    <br />
                    {dayjs(d.date).format("ddd D MMM")}
                  </span>
                }
                mouseEnterDelay={0}
              >
                <button type="button" className="pp-chart-slot" aria-label={`${dayjs(d.date).format("ddd D MMM")}: ${words(d.value)}`}>
                  {d.value > 0 ? (
                    <span className="pp-chart-bar" style={{ height: `${h}%`, animationDelay: `${Math.min(i * 18, 400)}ms` }}>
                      {i === peak ? <span className="pp-chart-peak pp-num">{d.value.toLocaleString()}</span> : null}
                    </span>
                  ) : null}
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div className="pp-chart-axis" aria-hidden>
        {data.map((d, i) => (
          <span key={d.date}>{showLabel(d.date, i) ? dayjs(d.date).format(data.length <= 7 ? "ddd" : "D MMM") : ""}</span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars, largest first, one hue, value at the tip. */
export function RankedBars({ rows, unit }: { rows: { label: string; value: number }[]; unit: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="pp-ranked">
      {rows.map((r, i) => (
        <li key={r.label + i}>
          <span className="pp-ranked-label">
            {r.label}
          </span>
          <Tooltip title={<strong>{unit(r.value)}</strong>} mouseEnterDelay={0}>
            <span className="pp-ranked-track" tabIndex={0} aria-label={`${r.label}: ${unit(r.value)}`}>
              {r.value > 0 ? <span className="pp-ranked-bar" style={{ width: `${(r.value / max) * 100}%`, animationDelay: `${i * 40}ms` }} /> : null}
            </span>
          </Tooltip>
          <span className="pp-ranked-value pp-num">{unit(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A thin meter for one ratio (0–100), with its number beside it. */
export function Meter({ percent, label }: { percent: number | null; label: string }) {
  return (
    <span className="pp-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined} aria-label={label}>
      <span className="pp-meter-track">
        {percent ? <span className="pp-meter-fill" style={{ width: `${percent}%` }} /> : null}
      </span>
      <span className="pp-num pp-meter-text">{percent === null ? "—" : `${percent}%`}</span>
    </span>
  );
}
