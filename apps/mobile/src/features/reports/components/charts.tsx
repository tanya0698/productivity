import React, { useState } from "react";
import { Pressable, StyleSheet, View, useColorScheme } from "react-native";
import Text from "../../../components/Text";
import { usePalette } from "../../../theme";
import { dateOf } from "../../calendar/components/items";

/**
 * Small charts for reports, as on the web: one hue (the validated chart teal
 * for each theme), thin columns with rounded tops square at the baseline,
 * hairline grid, a gap between bars, the peak labelled once, and a tap on a
 * bar to read its value. Every chart has a table view, so nothing is chart-only.
 */

/** The chart teal the web validated: lighter on dark, deeper on light. */
export function useChartColor() {
  return useColorScheme() === "dark" ? "#2dd4bf" : "#0d9488";
}

/** A clean axis top and its ticks: 0 / 5 / 10 / 15, 0 / 20 / 40, … */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

const fmt = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}K` : n.toLocaleString());
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => dateOf(d).toLocaleDateString(undefined, opts);

export function ColumnChart({
  data,
  unit,
  label,
  height = 160,
}: {
  data: { date: string; value: number }[];
  unit: [singular: string, plural: string];
  label: string;
  height?: number;
}) {
  const p = usePalette();
  const color = useChartColor();
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;
  const peak = data.findIndex((d) => d.value === max && max > 0);
  const words = (v: number) => `${v.toLocaleString()} ${v === 1 ? unit[0] : unit[1]}`;
  // Up to a week: every day. Up to two weeks: every other day. Longer: Mondays only.
  const showLabel = (d: string, i: number) => (data.length <= 7 ? true : data.length <= 14 ? i % 2 === 0 : dateOf(d).getDay() === 1 && i <= data.length - 3);
  const sel = picked !== null ? data[picked] : undefined;

  return (
    <View accessible accessibilityLabel={`${label}: ${data.map((d) => `${dayLabel(d.date, { day: "numeric", month: "short" })} ${words(d.value)}`).join(", ")}`}>
      <Text tone="secondary" style={{ fontSize: 12, minHeight: 18 }}>
        {sel ? `${dayLabel(sel.date, { weekday: "short", day: "numeric", month: "short" })} · ${words(sel.value)}` : "Tap a bar to see its day"}
      </Text>
      <View style={{ flexDirection: "row", height, marginTop: 6 }}>
        <View style={{ width: 28 }}>
          {ticks.map((t) => (
            <Text key={t} tone="muted" style={[styles.tick, { bottom: (t / top) * height - 6 }]}>
              {fmt(t)}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {ticks.map((t) => (
            <View key={t} style={[styles.grid, { bottom: (t / top) * height, backgroundColor: t === 0 ? p.borderStrong : p.border }]} />
          ))}
          <View style={styles.bars}>
            {data.map((d, i) => {
              const h = top ? (d.value / top) * height : 0;
              return (
                <Pressable key={d.date} onPress={() => setPicked(picked === i ? null : i)} style={styles.slot} hitSlop={{ top: 0, bottom: 0, left: 2, right: 2 }}>
                  {d.value > 0 ? (
                    <View style={[styles.bar, { height: Math.max(2, h), backgroundColor: color, opacity: picked === null || picked === i ? 1 : 0.45, maxWidth: 24 }]}>
                      {i === peak ? (
                        <Text weight="semiBold" style={[styles.peak, { color: p.text }]} numberOfLines={1}>
                          {d.value.toLocaleString()}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", marginLeft: 28, marginTop: 4 }}>
        {data.map((d, i) => (
          <View key={d.date} style={{ flex: 1, alignItems: "center", overflow: "visible" }}>
            {showLabel(d.date, i) ? (
              <Text tone="muted" style={{ fontSize: 9, width: 44, textAlign: "center" }} numberOfLines={1}>
                {data.length <= 7 ? dayLabel(d.date, { weekday: "short" }) : dayLabel(d.date, { day: "numeric", month: "short" })}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ranked horizontal bars, largest first, one hue, value beside the bar. */
export function RankedBars({ rows, unit }: { rows: { label: string; value: number }[]; unit: (v: number) => string }) {
  const p = usePalette();
  const color = useChartColor();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      {rows.map((r, i) => (
        <View key={r.label + i} accessible accessibilityLabel={`${r.label}: ${unit(r.value)}`} style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
              {r.label}
            </Text>
            <Text tone="secondary" style={{ fontSize: 12 }}>
              {unit(r.value)}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: p.muted }]}>
            {r.value > 0 ? <View style={[styles.track, { width: `${(r.value / max) * 100}%`, backgroundColor: color }]} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** A thin meter for one ratio (0–100), with its number beside it. */
export function Meter({ percent, label }: { percent: number | null; label: string }) {
  const p = usePalette();
  const color = useChartColor();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={percent === null ? undefined : { min: 0, max: 100, now: percent }}
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <View style={[styles.track, { flex: 1, backgroundColor: p.muted }]}>
        {percent ? <View style={[styles.track, { width: `${percent}%`, backgroundColor: color }]} /> : null}
      </View>
      <Text tone="secondary" style={{ fontSize: 12, minWidth: 34, textAlign: "right" }}>
        {percent === null ? "—" : `${percent}%`}
      </Text>
    </View>
  );
}

/** "↑ 20% vs previous 7 days", coloured by whether that direction is good, with the arrow so it isn't colour alone. */
export function Delta({ value, unit = "%", goodWhenUp = true, period }: { value: number | null; unit?: string; goodWhenUp?: boolean; period: string }) {
  const p = usePalette();
  const style = { fontSize: 11 };
  if (value === null) return <Text tone="muted" style={style} numberOfLines={2}>No earlier data to compare</Text>;
  if (value === 0) return <Text tone="muted" style={style} numberOfLines={2}>{`No change vs ${period}`}</Text>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <Text style={[style, { color: good ? p.successText : p.errorText }]} numberOfLines={2}>
      {`${up ? "↑" : "↓"} ${Math.abs(value)}${unit} vs ${period}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  tick: { position: "absolute", right: 4, fontSize: 9 },
  grid: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  bars: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "flex-end" },
  slot: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 1 },
  bar: { width: "80%", borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: "center" },
  peak: { position: "absolute", top: -16, fontSize: 10, width: 40, textAlign: "center" },
  track: { height: 6, borderRadius: 3 },
});
