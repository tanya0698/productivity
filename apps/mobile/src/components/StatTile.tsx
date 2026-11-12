import React from "react";
import { StyleSheet, View } from "react-native";
import type { Ionicons } from "@expo/vector-icons";
import EntityCard, { type CardTrend, type Tone } from "./EntityCard";

/**
 * A stat card: the EntityCard layout for one figure (Done today, Focus time…),
 * as on the web. `label` is the title, `hint` the caption under the value;
 * `tone` "error" colours the value when the number itself is a warning.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  iconTone = "primary",
  subtitle,
  trend,
  ring,
  compact,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "error" | "primary";
  icon?: keyof typeof Ionicons.glyphMap;
  iconTone?: Tone;
  subtitle?: string;
  trend?: CardTrend;
  ring?: { percent: number | null; label: string };
  compact?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <EntityCard
        icon={icon}
        tone={iconTone}
        title={label}
        subtitle={subtitle}
        value={value}
        valueTone={tone === "error" ? "error" : "default"}
        compact={compact ?? (typeof value === "string" && value.length > 6)}
        trend={trend}
        caption={hint}
        ring={ring}
      />
    </View>
  );
}

/** Stat cards two to a row; an odd one out takes the full width. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  // The same 12 across and down as between the screen's other cards.
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { flexBasis: "46%", flexGrow: 1 },
});
