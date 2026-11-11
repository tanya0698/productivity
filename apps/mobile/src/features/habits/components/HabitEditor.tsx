import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WEEKDAY_NAMES, editHabit, type LocalGoal } from "@productivity/domain";
import { useLocalRecords } from "@productivity/sync-engine/react";
import Sheet from "../../../components/Sheet";
import { Button, Chips, Field, Input } from "../../../components/Field";
import Text from "../../../components/Text";
import { radii, usePalette } from "../../../theme";
import type { Habit } from "./useHabits";

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
type Cadence = "daily" | "weekly";

/** Create or edit a habit: what, how often, how many times, and the goal it serves. */
export default function HabitEditor({
  habit,
  isNew = false,
  onClose,
  onSave,
  onArchive,
  onDelete,
}: {
  habit: Habit | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (h: Habit) => void;
  onArchive?: (h: Habit) => void;
  onDelete?: (h: Habit) => void;
}) {
  const p = usePalette();
  const { records: goals } = useLocalRecords<LocalGoal & { deletedAt: string | null }>("goal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Cadence>("daily");
  const [days, setDays] = useState<number[]>(ALL_DAYS);
  const [target, setTarget] = useState(1);
  const [goalId, setGoalId] = useState("");

  const id = habit?.id;
  useEffect(() => {
    if (!habit) return;
    setTitle(habit.title);
    setDescription(habit.description ?? "");
    setCadence(habit.cadence);
    setDays(habit.daysOfWeek ?? ALL_DAYS);
    setTarget(habit.targetCount);
    setGoalId(habit.goalId ?? "");
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const goalOptions = [
    { value: "", label: "No goal" },
    ...goals.filter((g) => g.status === "active" || g.id === habit?.goalId).map((g) => ({ value: g.id, label: g.title })),
  ];
  const valid = !!title.trim() && (cadence === "weekly" || days.length > 0);

  const save = () => {
    if (!habit || !valid) return;
    onSave(editHabit(habit, { title, description: description || null, cadence, daysOfWeek: days, targetCount: target, goalId: goalId || null }, new Date()));
  };

  const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());

  return (
    <Sheet
      open={!!habit}
      title={isNew ? "New habit" : "Habit"}
      onClose={onClose}
      right={
        habit && !isNew ? (
          <View style={{ flexDirection: "row", gap: 18 }}>
            {onArchive ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Archive habit: hide it, keep its history" hitSlop={10} onPress={() => onArchive(habit)}>
                <Ionicons name="archive-outline" size={20} color={p.text} />
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete habit"
                hitSlop={10}
                onPress={() =>
                  Alert.alert("Delete this habit and its history?", habit.title, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => onDelete(habit) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={20} color={p.errorText} />
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
    >
      <Field label="Habit">
        <Input accessibilityLabel="Habit" value={title} onChangeText={setTitle} maxLength={200} placeholder="e.g. Read 20 pages" autoFocus={isNew} />
      </Field>
      <Field label="How often">
        <Chips<Cadence>
          value={cadence}
          onChange={setCadence}
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ]}
        />
      </Field>
      {cadence === "daily" ? (
        <Field label="On" hint={days.length ? undefined : "Pick at least one day."}>
          <View style={styles.days}>
            {ALL_DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAY_NAMES[d - 1]}
                  onPress={() => toggleDay(d)}
                  style={[styles.day, { borderColor: on ? p.primary : p.borderStrong, backgroundColor: on ? p.primarySoft : "transparent" }]}
                >
                  <Text style={{ fontSize: 12, color: on ? p.primaryStrong : p.textSecondary }}>{WEEKDAY_NAMES[d - 1]}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}
      <Field
        label={cadence === "weekly" ? "Times a week" : "Times a day"}
        hint={cadence === "weekly" ? "e.g. gym 3 times a week, any days." : "More than 1 for things you count, like glasses of water."}
      >
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="One fewer" disabled={target <= 1} onPress={() => setTarget(target - 1)} style={[styles.round, { borderColor: p.borderStrong, opacity: target > 1 ? 1 : 0.4 }]}>
            <Ionicons name="remove" size={18} color={p.text} />
          </Pressable>
          <Text weight="bold" style={{ fontSize: 18, minWidth: 32, textAlign: "center" }}>
            {String(target)}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="One more" disabled={target >= 100} onPress={() => setTarget(target + 1)} style={[styles.round, { borderColor: p.borderStrong }]}>
            <Ionicons name="add" size={18} color={p.text} />
          </Pressable>
        </View>
      </Field>
      {goalOptions.length > 1 ? (
        <Field label="Towards a goal">
          <Chips value={goalId} options={goalOptions} onChange={setGoalId} />
        </Field>
      ) : null}
      <Field label="Notes">
        <Input accessibilityLabel="Notes" value={description} onChangeText={setDescription} placeholder="Why, or how" multiline textAlignVertical="top" style={{ minHeight: 56 }} />
      </Field>
      <Button kind="primary" label={isNew ? "Add habit" : "Save"} onPress={save} disabled={!valid} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  day: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  round: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
