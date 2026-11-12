import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Text from "./Text";
import { usePalette, type Palette } from "../theme";

/**
 * The stat card used wherever a card shows numbers (the hub template's entity
 * card layout, in Creedence's tokens), the same as the web's EntityCard:
 *
 *   [icon]  Title                 ( ring )
 *           subtitle              ring label
 *   VALUE  ▲ 20%
 *   caption
 *
 * One tone per card, on the icon and its tile only. The trend pill is green
 * when the change is good and red when it's bad, with ▲/▼ so it isn't colour
 * alone. Every card has a ring (0 with nothing to measure), and every word
 * on it is capitalised, as in the template ("Recurring Revenue").
 */

export type Tone = "primary" | "accent" | "success" | "warning" | "error" | "ai" | "neutral";

export interface CardTrend {
  /** Percentage change vs the period before; null shows nothing (no earlier data). */
  change: number | null;
  goodWhenUp?: boolean;
  /** "%" by default; " pts" for a change in a rate. */
  unit?: string;
  /** For screen readers: "vs last week". */
  period?: string;
}

const toneColor = (p: Palette, t: Tone) =>
  ({ primary: p.primary, accent: p.accent, success: p.success, warning: p.warning, error: p.error, ai: p.ai, neutral: p.textSecondary })[t];

/** Alpha on a #rrggbb colour. */
const tint = (hex: string, alpha: number) => `${hex.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

export function TrendPill({ trend }: { trend: CardTrend }) {
  const p = usePalette();
  const { change, goodWhenUp = true, unit = "%", period = "vs last week" } = trend;
  if (change === null) return null;
  if (change === 0) {
    return (
      <View accessible accessibilityLabel={`No change ${period}`} style={[styles.pill, { backgroundColor: p.muted }]}>
        <Text style={{ fontSize: 12, color: p.textSecondary }} weight="medium">{`● 0${unit}`}</Text>
      </View>
    );
  }
  const up = change > 0;
  const good = up === goodWhenUp;
  return (
    <View
      accessible
      accessibilityLabel={`${up ? "Up" : "Down"} ${Math.abs(change)}${unit.trim() === "pts" ? " points" : " percent"} ${period}`}
      style={[styles.pill, { backgroundColor: tint(good ? p.success : p.error, 0.1) }]}
    >
      <Text style={{ fontSize: 12, color: good ? p.successText : p.errorText }} weight="medium">
        {`${up ? "▲" : "▼"}${Math.abs(change)}${unit}`}
      </Text>
    </View>
  );
}

/**
 * A progress ring from plain views (no SVG on the phone): two half-rings, each
 * clipped to its side and turned to show its share of the arc.
 */
export function ProgressRing({ percent, size = 44, label }: { percent: number; size?: number; label: string }) {
  const p = usePalette();
  const color = p.primary;
  const stroke = 4;
  const value = Math.max(0, Math.min(100, percent));
  const deg = (value / 100) * 360;
  const right = Math.min(deg, 180);
  const left = Math.max(deg - 180, 0);
  const ring = { width: size, height: size, borderRadius: size / 2, borderWidth: stroke };
  // A ring coloured on its top and right borders covers half the circle; turned 45° it's the right half.
  const half = (rotate: number) => (
    <View
      style={[
        ring,
        { position: "absolute", borderColor: "transparent", borderTopColor: color, borderRightColor: color, transform: [{ rotate: `${rotate}deg` }] },
      ]}
    />
  );
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: value }} style={{ width: size, height: size }}>
      <View style={[ring, { position: "absolute", borderColor: p.border }]} />
      {right > 0 ? (
        <View style={[styles.clip, { left: size / 2, width: size / 2, height: size }]}>
          <View style={{ position: "absolute", left: -size / 2, width: size, height: size }}>{half(45 + right - 180)}</View>
        </View>
      ) : null}
      {left > 0 ? (
        <View style={[styles.clip, { left: 0, width: size / 2, height: size }]}>
          <View style={{ position: "absolute", left: 0, width: size, height: size }}>{half(45 + left)}</View>
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text weight="bold" style={{ fontSize: 10, color }}>
          {String(Math.round(value))}
        </Text>
      </View>
    </View>
  );
}

export default function EntityCard({
  icon,
  tone = "primary",
  title,
  subtitle,
  value,
  valueTone = "default",
  compact = false,
  trend,
  caption,
  ring,
  onPress,
  accessibilityLabel,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  title: string;
  subtitle?: string;
  value: string | number;
  valueTone?: "default" | "primary" | "error";
  compact?: boolean;
  trend?: CardTrend;
  caption?: string;
  ring?: { percent: number | null; label: string };
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const color = toneColor(p, tone);
  const valueColor = { default: p.heading, primary: p.primary, error: p.errorText }[valueTone];
  const body = (
    <>
      <View style={styles.head}>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: tint(color, 0.16) }]}>
            <Ionicons name={icon} size={18} color={color} />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="semiBold" tone="heading" numberOfLines={1} style={{ fontSize: 14, lineHeight: 18, textTransform: "capitalize" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text tone="secondary" numberOfLines={1} style={{ fontSize: 12, textTransform: "capitalize" }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={styles.valueRow}>
            <Text weight="bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: compact ? 18 : 22, color: valueColor, flexShrink: 1 }}>
              {String(value)}
            </Text>
            {trend ? <TrendPill trend={trend} /> : null}
          </View>
          {caption ? (
            <Text tone="secondary" numberOfLines={2} style={{ fontSize: 10, lineHeight: 14, textTransform: "capitalize" }}>
              {caption}
            </Text>
          ) : null}
        </View>
        {ring ? (
          <View style={{ alignItems: "center", gap: 4 }}>
            <ProgressRing percent={ring.percent ?? 0} label={ring.label} />
            <Text tone="secondary" style={{ fontSize: 10, textTransform: "capitalize" }}>
              {ring.label}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
  const frame = [styles.card, { backgroundColor: p.surface, borderColor: p.cardBorder }];
  return onPress ? (
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...frame, { opacity: pressed ? 0.85 : 1 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={frame}>{body}</View>
  );
}

const styles = StyleSheet.create({
  // Even spacing: 16 on every side, 16 between header and numbers (the 4/8 scale).
  card: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 16, gap: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  // Room for a ring (46 + label) in every card, so values line up across a row; pinned to the bottom.
  body: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: "auto" },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  pill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  clip: { position: "absolute", top: 0, overflow: "hidden" },
});
