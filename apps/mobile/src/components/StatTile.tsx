import React from "react";
import { StyleSheet, View } from "react-native";
import Text from "./Text";
import { radii, usePalette } from "../theme";

/** A number with a mono label above and a short hint below. Use several in a <StatRow>. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "error" | "primary";
}) {
  const p = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text label style={{ fontSize: 10, letterSpacing: 1.2 }} numberOfLines={1}>
        {label}
      </Text>
      <Text
        weight="extraBold"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontSize: 28, letterSpacing: -0.8, color: tone === "error" ? p.errorText : tone === "primary" ? p.primary : p.heading }}
      >
        {String(value)}
      </Text>
      {hint ? (
        <Text tone="secondary" style={{ fontSize: 11 }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
});
