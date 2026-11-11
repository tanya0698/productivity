import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { useActiveReminders, useNow, whenText } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";
import { go } from "../../../navigation/ref";

/** What's due now and the next few, on the Today screen. */
export default function RemindersWidget() {
  const p = usePalette();
  const now = useNow(30_000);
  const { items } = useActiveReminders(now);
  const shown = items.slice(0, 5);
  return (
    <>
      {shown.length ? (
        shown.map((i, n) => {
          const due = i.at.getTime() <= now.getTime();
          return (
            <View key={i.reminder.id} style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0 }]}>
              <Ionicons name={due ? "notifications" : "time-outline"} size={16} color={due ? p.warningText : p.textMuted} />
              <Text numberOfLines={1} style={{ flex: 1 }} weight={due ? "semiBold" : "regular"}>
                {i.title}
              </Text>
              <Text style={{ fontSize: 12, color: due ? p.warningText : p.textSecondary }}>{whenText(i.at, now)}</Text>
            </View>
          );
        })
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          No reminders coming up.
        </Text>
      )}
      <FootLink label="All reminders" onPress={() => go("reminders")} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
});
