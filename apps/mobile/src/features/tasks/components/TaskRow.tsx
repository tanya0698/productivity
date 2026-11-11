import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, dueState, isDone, priorityLabel, taskDay, toggleDone, type LocalTask } from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import Text from "../../../components/Text";
import { radii, usePalette } from "../../../theme";

export type Task = LocalTask & { deletedAt: string | null };

/** One task: tap the circle to tick it off; long-press (when given) for more. */
export default function TaskRow({
  task,
  now,
  today,
  onPress,
  onLongPress,
  first = false,
}: {
  task: Task;
  now: Date;
  today: string;
  onPress?: () => void;
  onLongPress?: () => void;
  first?: boolean;
}) {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const done = isDone(task);
  const state = dueState(task, now, today);
  const date = taskDay(task);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={onPress ? "Opens the task" : undefined}
      style={[styles.row, { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        hitSlop={10}
        onPress={() => void runtime.write("task", toggleDone(task, new Date()))}
      >
        <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={24} color={done ? p.success : p.borderStrong} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={done ? { color: p.textMuted, textDecorationLine: "line-through" } : undefined}>{task.title}</Text>
        {!done && (date || task.priority !== 3) ? (
          <View style={styles.meta}>
            {date ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: state === "overdue" ? p.errorSoft : state === "due_soon" ? p.warningSoft : p.muted },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: state === "overdue" ? p.errorText : state === "due_soon" ? p.warningText : p.textSecondary,
                  }}
                >
                  {state === "overdue" ? `Overdue · ${date}` : date === today ? "Due today" : date === addDays(today, 1) ? "Tomorrow" : date}
                </Text>
              </View>
            ) : null}
            {task.priority !== 3 ? (
              <Text tone="secondary" weight={task.priority === 1 ? "semiBold" : "regular"} style={{ fontSize: 12 }}>
                ⚑ {priorityLabel[task.priority]}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 10, alignItems: "flex-start" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
