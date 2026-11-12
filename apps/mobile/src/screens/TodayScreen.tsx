import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { groupTasks, localDate, notesTrend, dueTodayTrend, overdueTrend, onTrackShare, percentOf, todayDoneShare, newNote, newTask, type LocalNote, type LocalTask } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { Card } from "../components/ListCard";
import { RowsSkeleton, TileRowSkeleton } from "../components/Skeleton";
import { StatRow, StatTile } from "../components/StatTile";
import { useDataReady } from "../shared/data/useDataReady";
import ScreenFrame from "../components/ScreenFrame";
import Text from "../components/Text";
import { modules } from "../features/registry";
import { useAuth } from "../shared/auth/AuthProvider";
import { firstNameOf, greeting } from "../shared/auth/profile";
import { fonts, radii, usePalette } from "../theme";

type Kind = "task" | "note";

/** Type and press enter: saved on the phone straight away, as a task or a note. */
function QuickCapture() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const [kind, setKind] = useState<Kind>("task");
  const [value, setValue] = useState("");

  const capture = async () => {
    const text = value.trim();
    if (!text) return;
    if (kind === "task") await runtime.write("task", newTask(runtime.newId(), new Date(), { title: text }));
    else await runtime.write("note", newNote(runtime.newId(), new Date(), { text }));
    setValue("");
    if (Platform.OS === "android") ToastAndroid.show(kind === "task" ? "Added to Tasks" : "Saved to Notes", ToastAndroid.SHORT);
  };

  return (
    <View style={styles.capture}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Capturing as a ${kind}. Tap to switch.`}
        onPress={() => setKind(kind === "task" ? "note" : "task")}
        style={[styles.kind, { backgroundColor: p.primarySoft }]}
      >
        <Ionicons name={kind === "task" ? "checkbox-outline" : "document-text-outline"} size={15} color={p.primaryStrong} />
        <Text weight="semiBold" style={{ fontSize: 12, color: p.primaryStrong }}>
          {kind === "task" ? "Task" : "Note"}
        </Text>
      </Pressable>
      <TextInput
        accessibilityLabel="Quick capture"
        placeholder={kind === "task" ? "Capture a task…" : "Capture a note…"}
        placeholderTextColor={p.textMuted}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => void capture()}
        returnKeyType="done"
        maxLength={2000}
        style={[styles.input, { color: p.text }]}
      />
      {value.trim() ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Save" hitSlop={8} onPress={() => void capture()}>
          <Ionicons name="arrow-up-circle" size={28} color={p.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Today — the home screen, like the web app's Today page: the day's numbers,
 * quick capture, then the panels each module contributes through `widgets`.
 */
export default function TodayScreen() {
  const now = new Date();
  const { session } = useAuth();
  const { records: tasks, loading } = useLocalRecords<LocalTask & { deletedAt: string | null }>("task");
  const ready = useDataReady(loading);
  const { records: notes } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const groups = groupTasks(tasks, now, localDate(now));
  const widgets = useMemo(
    () =>
      modules
        .filter((m) => m.status !== "soon")
        .flatMap((m) => (m.widgets ?? []).map((w) => ({ ...w, key: `${m.key}:${w.id}` })))
        .sort((a, b) => (a.order ?? 50) - (b.order ?? 50)),
    [],
  );
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScreenFrame eyebrow={date} title="Today" capture={<QuickCapture />}>
      <Text tone="secondary" style={{ paddingHorizontal: 4 }}>
        {greeting(now, firstNameOf(session?.user))}
      </Text>
      {!ready ? <TileRowSkeleton /> : null}
      {ready ? (
      <StatRow>
        <StatTile
          icon="calendar"
          label="Due today"
          trend={{ ...dueTodayTrend(tasks, localDate(now)), goodWhenUp: false, period: "vs yesterday" }}
          subtitle="Tasks"
          value={groups.today.length}
          hint={groups.today.length === 1 ? "task left" : "tasks left"}
          ring={{ percent: todayDoneShare(tasks, groups.today.length, localDate(now)), label: "Done" }}
        />
        <StatTile
          icon="warning"
          iconTone={groups.overdue.length ? "error" : "success"}
          label="Overdue"
          trend={{ ...overdueTrend(tasks, localDate(now)), goodWhenUp: false }}
          ring={{ percent: onTrackShare(groups.overdue.length + groups.today.length + groups.upcoming.length, groups.overdue.length), label: "On Track" }}
          subtitle="Tasks"
          value={groups.overdue.length}
          hint={groups.overdue.length ? "need attention" : "all clear"}
          tone={groups.overdue.length ? "error" : undefined}
        />
        <StatTile
          icon="document-text"
          iconTone="accent"
          label="Notes"
          ring={{ percent: percentOf(notes.filter((n) => n.projectId).length, notes.length), label: "In Projects" }}
          subtitle="On this phone"
          value={notes.length}
          hint={`${notesTrend(notes, localDate(now)).now} written this week`}
          trend={{ ...notesTrend(notes, localDate(now)) }}
        />
      </StatRow>
      ) : null}
      {widgets.map(({ key, title, component: Widget }) => (
        <Card key={key} title={title}>
          {ready ? <Widget /> : <RowsSkeleton rows={3} check={false} />}
        </Card>
      ))}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  capture: { flexDirection: "row", alignItems: "center", gap: 8 },
  kind: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.native.regular, paddingVertical: 6 },
});
