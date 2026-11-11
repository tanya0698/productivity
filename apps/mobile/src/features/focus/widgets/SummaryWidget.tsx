import React from "react";
import { View } from "react-native";
import { FOCUS_PRESETS, clock, focusStats, minutesText, remainingMs, type LocalFocusSession } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import { Button } from "../../../components/Field";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { go } from "../../../navigation/ref";
import { useFocus, useTicking } from "../../../shared/focus/FocusProvider";
import { useNow } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";

/** Today's focus time, and a quick start (or what's running). */
export default function SummaryWidget() {
  const p = usePalette();
  const { timer, start } = useFocus();
  const now = useTicking(!!timer?.runningSince);
  const stats = focusStats(useLocalRecords<LocalFocusSession & { deletedAt: string | null }>("focus_session").records, useNow(60_000));
  return (
    <View style={{ gap: 8, paddingBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text weight="extraBold" style={{ fontSize: 28, color: p.primary }}>
          {minutesText(stats.todaySeconds)}
        </Text>
        <Text tone="secondary">focused today</Text>
      </View>
      {timer ? (
        <FootLink label={`${timer.kind === "focus" ? "Focus" : "Break"} ${timer.runningSince ? "running" : "paused"} · ${clock(remainingMs(timer, now))} left`} onPress={() => go("focus")} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Button small label="Start 25 min" onPress={() => start("focus", FOCUS_PRESETS[0].focus)} />
          </View>
          <FootLink label="Open focus" onPress={() => go("focus")} />
        </View>
      )}
    </View>
  );
}
