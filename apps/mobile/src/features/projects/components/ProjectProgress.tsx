import React from "react";
import { StyleSheet, View } from "react-native";
import type { ProjectProgress as Progress } from "@productivity/domain";
import Text from "../../../components/Text";
import { usePalette } from "../../../theme";

/** A thin teal bar with "3 of 5 done" beside it; the words carry the number, not the bar alone. */
export default function ProjectProgress({ progress }: { progress: Progress }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Tasks done"
        accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
        style={[styles.track, { backgroundColor: p.muted }]}
      >
        <View style={[styles.fill, { width: `${progress.percent}%`, backgroundColor: p.primary }]} />
      </View>
      <Text tone="secondary" style={{ fontSize: 12 }}>
        {progress.total ? `${progress.done} of ${progress.total} done` : "No tasks yet"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});
