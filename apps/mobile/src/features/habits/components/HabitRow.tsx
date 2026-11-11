import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { habitProgress, recentDays, scheduleLabel, streak, type DayMark, type LogIndex } from "@productivity/domain";
import { Pop } from "../../../components/Motion";
import Text from "../../../components/Text";
import { radii, usePalette } from "../../../theme";
import { dateOf } from "../../calendar/components/items";
import type { Habit } from "./useHabits";

const markText: Record<DayMark, string> = {
  done: "done",
  partial: "partly done",
  missed: "missed",
  pending: "not done yet",
  off: "not due",
};

/**
 * One habit: a check (or −/+ for a count), its schedule and streak, and the
 * last seven days. Each day says what it was in words for screen readers.
 */
export default function HabitRow({
  habit,
  index,
  today,
  onTick,
  onUntick,
  onOpen,
  compact = false,
  first = false,
}: {
  habit: Habit;
  index: LogIndex;
  today: string;
  onTick: (h: Habit) => void;
  onUntick: (h: Habit) => void;
  onOpen?: (h: Habit) => void;
  compact?: boolean;
  first?: boolean;
}) {
  const p = usePalette();
  const prog = habitProgress(habit, index, today);
  const days = streak(habit, index, today);
  const counting = habit.targetCount > 1;
  const unit = habit.cadence === "weekly" ? "week" : "day";

  const dayStyle = (m: DayMark) =>
    m === "done"
      ? { backgroundColor: p.primary, borderColor: p.primary, color: p.onPrimary }
      : m === "partial"
        ? { backgroundColor: p.primarySoft, borderColor: p.primary, color: p.primaryStrong }
        : m === "missed"
          ? { backgroundColor: p.errorSoft, borderColor: p.errorSoft, color: p.errorText }
          : m === "pending"
            ? { backgroundColor: "transparent", borderColor: p.borderStrong, color: p.textSecondary }
            : { backgroundColor: "transparent", borderColor: "transparent", color: p.textMuted };

  return (
    <View style={[styles.row, { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, opacity: prog.scheduled ? 1 : 0.7 }]}>
      {counting ? (
        <View style={styles.counter} accessibilityLabel={`${habit.title}: ${prog.count} of ${prog.target}`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove one from ${habit.title}`}
            disabled={!prog.count}
            hitSlop={6}
            onPress={() => onUntick(habit)}
            style={[styles.round, { borderColor: p.borderStrong, opacity: prog.count ? 1 : 0.4 }]}
          >
            <Ionicons name="remove" size={16} color={p.text} />
          </Pressable>
          <Pop on={prog.done}>
            <Text weight="semiBold" style={{ minWidth: 34, textAlign: "center", fontSize: 13, color: prog.done ? p.primary : p.text }}>{`${prog.count}/${prog.target}`}</Text>
          </Pop>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add one to ${habit.title}`}
            hitSlop={6}
            onPress={() => onTick(habit)}
            style={[styles.round, prog.done ? { borderColor: p.borderStrong } : { backgroundColor: p.primary, borderColor: p.primary }]}
          >
            <Ionicons name="add" size={16} color={prog.done ? p.text : p.onPrimary} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: prog.done }}
          accessibilityLabel={prog.done ? `Mark "${habit.title}" as not done` : `Mark "${habit.title}" as done`}
          hitSlop={10}
          onPress={() => (prog.done ? onUntick(habit) : onTick(habit))}
        >
          <Pop on={prog.done}>
            <Ionicons name={prog.done ? "checkmark-circle" : "ellipse-outline"} size={28} color={prog.done ? p.primary : p.borderStrong} />
          </Pop>
        </Pressable>
      )}

      <Pressable
        style={{ flex: 1, gap: 4 }}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        accessibilityLabel={onOpen ? `Edit habit: ${habit.title}` : undefined}
        onPress={() => onOpen?.(habit)}
      >
        <Text weight="medium" style={prog.done && !counting ? { color: p.textSecondary } : undefined}>
          {habit.title}
        </Text>
        <View style={styles.meta}>
          <Text tone="secondary" style={{ fontSize: 12 }}>
            {scheduleLabel(habit)}
          </Text>
          {days ? (
            <View style={[styles.badge, { backgroundColor: p.successSoft }]}>
              <Text style={{ fontSize: 11, color: p.successText }}>{`🔥 ${days}-${unit} streak`}</Text>
            </View>
          ) : null}
          {!prog.scheduled ? (
            <View style={[styles.badge, { backgroundColor: p.muted }]}>
              <Text style={{ fontSize: 11, color: p.textSecondary }}>Not due today</Text>
            </View>
          ) : null}
        </View>
        {compact ? null : (
          <View style={styles.days} accessibilityLabel="Last 7 days">
            {recentDays(habit, index, today, 7).map((d) => {
              const s = dayStyle(d.mark);
              const date = dateOf(d.date);
              return (
                <View
                  key={d.date}
                  accessible
                  accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: "long" })}: ${markText[d.mark]}${d.count > 1 ? ` (${d.count})` : ""}`}
                  style={[styles.day, { backgroundColor: s.backgroundColor, borderColor: s.borderColor }]}
                >
                  <Text style={{ fontSize: 10, color: s.color }}>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, alignItems: "flex-start" },
  counter: { flexDirection: "row", alignItems: "center", gap: 2 },
  round: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  days: { flexDirection: "row", gap: 4, marginTop: 4 },
  day: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
