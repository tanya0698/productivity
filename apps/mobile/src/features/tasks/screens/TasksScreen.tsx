import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  addDays,
  dueState,
  groupTasks,
  isDone,
  localDate,
  newTask,
  priorityLabel,
  taskDay,
  taskGroupTitle,
  toggleDone,
  type LocalTask,
  type TaskGroupKey,
} from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { fonts, radii, usePalette } from "../../../theme";

type Task = LocalTask & { deletedAt: string | null };
type Due = "none" | "today" | "tomorrow";

const OPEN_GROUPS: TaskGroupKey[] = ["overdue", "today", "upcoming", "someday"];

/**
 * Tasks, saved on the phone first and synced in the background: the same groups
 * and rules as the web app. Tap the circle to tick a task off; long-press to delete.
 */
export default function TasksScreen() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const { records } = useLocalRecords<Task>("task");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Due>("none");
  const [showDone, setShowDone] = useState(false);

  const now = new Date();
  const today = localDate(now);
  const groups = useMemo(() => groupTasks(records, new Date(), localDate(new Date())), [records]);

  const add = async () => {
    if (!title.trim()) return;
    const dueDate = due === "today" ? today : due === "tomorrow" ? addDays(today, 1) : null;
    await runtime.write("task", newTask(runtime.newId(), new Date(), { title, dueDate }));
    setTitle("");
    setDue("none");
  };

  const remove = (task: Task) =>
    Alert.alert("Delete this task?", task.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runtime.write("task", task, "delete") },
    ]);

  const row = (task: Task) => {
    const done = isDone(task);
    const state = dueState(task, now, today);
    const date = taskDay(task);
    return (
      <Pressable
        key={task.id}
        onLongPress={() => remove(task)}
        accessibilityHint="Long-press to delete"
        style={[styles.row, { borderColor: p.border }]}
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
                    {
                      backgroundColor: state === "overdue" ? p.errorSoft : state === "due_soon" ? p.warningSoft : p.muted,
                    },
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
  };

  return (
    <ScreenFrame eyebrow="Plan" title="Tasks">
      <View style={[styles.add, { backgroundColor: p.surface, borderColor: p.border }]}>
        <TextInput
          accessibilityLabel="New task"
          placeholder="Add a task"
          placeholderTextColor={p.textMuted}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={() => void add()}
          returnKeyType="done"
          style={[styles.input, { color: p.text }]}
        />
        <View style={styles.chips}>
          {(["none", "today", "tomorrow"] as const).map((d) => (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ selected: due === d }}
              onPress={() => setDue(d)}
              style={[styles.chip, { borderColor: due === d ? p.primary : p.borderStrong, backgroundColor: due === d ? p.primarySoft : "transparent" }]}
            >
              <Text style={{ fontSize: 12, color: due === d ? p.primaryStrong : p.textSecondary }}>
                {d === "none" ? "No date" : d === "today" ? "Today" : "Tomorrow"}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => void add()}
            disabled={!title.trim()}
            style={[styles.addButton, { backgroundColor: p.primary, opacity: title.trim() ? 1 : 0.5 }]}
          >
            <Text weight="semiBold" style={{ color: p.onPrimary, fontSize: 13 }}>
              Add
            </Text>
          </Pressable>
        </View>
      </View>

      {!records.length ? (
        <EmptyState title="No tasks yet" body="Add one above. Tasks are saved on this phone first and sync to the web app." />
      ) : null}

      {OPEN_GROUPS.filter((k) => groups[k].length).map((key) => (
        <View key={key} style={[styles.group, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={styles.groupHead}>
            <Text label>{taskGroupTitle[key]}</Text>
            <Text label>{String(groups[key].length)}</Text>
          </View>
          {groups[key].map(row)}
        </View>
      ))}

      {groups.done.length ? (
        <View style={[styles.group, { backgroundColor: p.surface, borderColor: p.border }]}>
          <Pressable onPress={() => setShowDone(!showDone)} style={styles.groupHead} accessibilityRole="button">
            <Text label>{`Done · ${groups.done.length}`}</Text>
            <Ionicons name={showDone ? "chevron-up" : "chevron-down"} size={16} color={p.textMuted} />
          </Pressable>
          {showDone ? groups.done.slice(0, 50).map(row) : null}
        </View>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  add: { borderWidth: 1, borderRadius: radii.lg, padding: 12, gap: 10 },
  input: { fontSize: 16, fontFamily: fonts.native.regular, paddingVertical: 4 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
  addButton: { marginLeft: "auto", borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 7 },
  group: { borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 14, paddingBottom: 4 },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "flex-start" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
});
