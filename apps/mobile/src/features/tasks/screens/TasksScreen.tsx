import React, { useEffect, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDays, groupTasks, localDate, newTask, taskGroupTitle, type TaskGroupKey } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import TaskEditor from "../components/TaskEditor";
import TaskRow, { type Task } from "../components/TaskRow";
import { fonts, radii, usePalette } from "../../../theme";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = records.find((t) => t.id === editingId) ?? null;

  // Opened from elsewhere (a reminder, a notification): navigate("tasks", { task: id }).
  const route = useRoute<{ key: string; name: string; params?: { task?: string } }>();
  const navigation = useNavigation();
  const requested = route.params?.task;
  useEffect(() => {
    if (!requested) return;
    setEditingId(requested);
    navigation.setParams({ task: undefined } as never);
  }, [requested, navigation]);

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

  const row = (task: Task) => <TaskRow key={task.id} task={task} now={now} today={today} onPress={() => setEditingId(task.id)} onLongPress={() => remove(task)} />;

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
      <TaskEditor task={editing} onClose={() => setEditingId(null)} />
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
});
