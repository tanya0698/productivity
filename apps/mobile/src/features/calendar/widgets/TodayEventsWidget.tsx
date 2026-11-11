import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FootLink } from "../../../components/ListCard";
import Text from "../../../components/Text";
import { useNow } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";
import { plusDays, timeRange, useCalendarItems, ymd } from "../components/items";

/** Today's events and timed tasks, in order; past ones dimmed (as on the web). */
export default function TodayEventsWidget() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const p = usePalette();
  const now = useNow(60_000);
  const today = ymd(now);
  const { items } = useCalendarItems(today, ymd(plusDays(now, 1)));
  const events = items.filter((i) => i.kind === "event" || !i.allDay);
  return (
    <>
      {events.length ? (
        events.slice(0, 6).map((i, n) => {
          const past = !i.allDay && i.end.getTime() < now.getTime();
          return (
            <Pressable
              key={i.key}
              accessibilityRole="button"
              onPress={() => (i.kind === "task" ? navigation.navigate("tasks", { task: i.task!.id }) : navigation.navigate("calendar", { date: today }))}
              style={[styles.row, { borderColor: p.border, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, opacity: past ? 0.55 : 1 }]}
            >
              <Text style={{ fontSize: 12, width: 92, color: p.textSecondary }}>{timeRange(i)}</Text>
              <View style={[styles.bar, { backgroundColor: i.kind === "task" ? p.warningText : p.primary }]} />
              <Text numberOfLines={1} style={{ flex: 1 }}>
                {i.title}
              </Text>
            </Pressable>
          );
        })
      ) : (
        <Text tone="secondary" style={{ paddingBottom: 8 }}>
          Nothing on the calendar today.
        </Text>
      )}
      <FootLink label="Open calendar" onPress={() => navigation.navigate("calendar")} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  bar: { width: 3, height: 18, borderRadius: 2 },
});
