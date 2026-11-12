import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STREAK_TARGET, bestStreakTrend, habitsCountTrend, habitsDoneTrend, habitProgress, isScheduled, localDate, newHabit, percentOf, streak } from "@productivity/domain";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import EmptyState from "../../../components/EmptyState";
import { ListCardSkeleton, TileRowSkeleton } from "../../../components/Skeleton";
import { useDataReady } from "../../../shared/data/useDataReady";
import { Button } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import ScreenFrame from "../../../components/ScreenFrame";
import { StatRow, StatTile } from "../../../components/StatTile";
import Text from "../../../components/Text";
import { useNow } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";
import HabitEditor from "../components/HabitEditor";
import HabitRow from "../components/HabitRow";
import { useHabits, type Habit } from "../components/useHabits";

const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

/**
 * Habits: today's ones to tick off, the rest of the week's, streaks and the
 * last seven days. Ticks are saved on the phone first and synced.
 */
export default function HabitsScreen() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const today = localDate(useNow(60_000));
  const { habits, archived, logs, index, loading: habitsLoading, tick, untick } = useHabits();
  const loading = !useDataReady(habitsLoading);
  const [editing, setEditing] = useState<{ habit: Habit; isNew: boolean } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const dueToday = habits.filter((h) => isScheduled(h, today));
  const notToday = habits.filter((h) => !isScheduled(h, today));
  const doneToday = dueToday.filter((h) => habitProgress(h, index, today).done).length;
  const best = habits.reduce((m, h) => Math.max(m, streak(h, index, today)), 0);

  const row = (h: Habit, n: number) => (
    <HabitRow
      key={h.id}
      habit={h}
      index={index}
      today={today}
      first={n === 0}
      onTick={(x) => void tick(x)}
      onUntick={(x) => void untick(x)}
      onOpen={(x) => setEditing({ habit: x, isNew: false })}
    />
  );

  const stamp = () => new Date().toISOString();

  return (
    <ScreenFrame eyebrow="Grow" title="Habits">
      <Button kind="primary" label="New habit" onPress={() => setEditing({ habit: newHabit(runtime.newId(), new Date(), { title: "" }) as Habit, isNew: true })} />

      {habits.length ? (
        <StatRow>
          <StatTile
            icon="checkmark-circle"
            iconTone="success"
            label="Done today"
            trend={{ ...habitsDoneTrend(habits, index, today), period: "vs yesterday" }}
            subtitle={`${dueToday.length} due`}
            value={`${doneToday}/${dueToday.length}`}
            ring={{ percent: dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : null, label: "Today" }}
          />
          <StatTile icon="flame" iconTone="warning" label="Best streak" trend={{ ...bestStreakTrend(habits, index, today) }} ring={{ percent: percentOf(best, STREAK_TARGET), label: "30-Day Goal" }} subtitle="In a row" value={best} hint={best === 1 ? "day or week" : "days or weeks"} />
          <StatTile
            icon="list"
            iconTone="accent"
            label="Habits"
            trend={{ ...habitsCountTrend(habits, today) }}
            ring={{ percent: percentOf(habits.filter((h) => streak(h, index, today) > 0).length, habits.length), label: "On A Streak" }}
            subtitle="Active"
            value={habits.length}
            hint={`${habits.filter((h) => h.cadence === "daily").length} daily · ${habits.filter((h) => h.cadence === "weekly").length} weekly`}
          />
        </StatRow>
      ) : null}

      {loading && !habits.length ? <TileRowSkeleton /> : null}
      {loading && !habits.length ? <ListCardSkeleton rows={4} /> : null}
      {!loading && !habits.length ? <EmptyState title="No habits yet" body="Start with one small thing you want to do most days." /> : null}

      {dueToday.length ? (
        <Card title="Today" right={String(dueToday.length)}>
          {dueToday.map(row)}
        </Card>
      ) : null}
      {notToday.length ? (
        <Card title="Not due today" right={String(notToday.length)}>
          {notToday.map(row)}
        </Card>
      ) : null}

      {archived.length ? (
        <Card>
          <Pressable accessibilityRole="button" onPress={() => setShowArchived(!showArchived)} style={styles.head}>
            <Text label>{`Archived · ${archived.length}`}</Text>
            <Ionicons name={showArchived ? "chevron-up" : "chevron-down"} size={16} color={p.textMuted} />
          </Pressable>
          {showArchived
            ? archived.map((h) => (
                <View key={h.id} style={[styles.archived, { borderColor: p.border }]}>
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Button small label="Restore" onPress={() => void runtime.write("habit", { ...h, archivedAt: null, updatedAt: stamp() })} />
                </View>
              ))
            : null}
        </Card>
      ) : null}

      <HabitEditor
        habit={editing?.habit ?? null}
        isNew={editing?.isNew}
        onClose={() => setEditing(null)}
        onSave={(h) => {
          void runtime.write("habit", h);
          toast(editing?.isNew ? "Habit added" : "Habit saved");
          setEditing(null);
        }}
        onArchive={(h) => {
          void runtime.write("habit", { ...h, archivedAt: stamp(), updatedAt: stamp() });
          toast("Habit archived");
          setEditing(null);
        }}
        onDelete={(h) => {
          // Its logs go too, so nothing is left pointing at it.
          for (const l of logs.filter((l) => l.habitId === h.id)) void runtime.write("habit_log", l, "delete");
          void runtime.write("habit", h, "delete");
          toast("Habit deleted");
          setEditing(null);
        }}
      />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  archived: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
