import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { groupTasks, localDate, newNote, newTask, type LocalNote, type LocalTask } from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { Card } from "../components/ListCard";
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

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone?: "error" }) {
  const p = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: p.surface, borderColor: p.border }]}>
      <Text label style={{ fontSize: 10, letterSpacing: 1.2 }}>
        {label}
      </Text>
      <Text weight="extraBold" style={{ fontSize: 28, letterSpacing: -0.8, color: tone === "error" ? p.errorText : p.heading }}>
        {value}
      </Text>
      <Text tone="secondary" style={{ fontSize: 11 }} numberOfLines={1}>
        {hint}
      </Text>
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
  const { records: tasks } = useLocalRecords<LocalTask & { deletedAt: string | null }>("task");
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
      <View style={styles.stats}>
        <Stat label="Due today" value={groups.today.length} hint={groups.today.length === 1 ? "task" : "tasks"} />
        <Stat
          label="Overdue"
          value={groups.overdue.length}
          hint={groups.overdue.length ? "need attention" : "all clear"}
          tone={groups.overdue.length ? "error" : undefined}
        />
        <Stat label="Notes" value={notes.length} hint="on this phone" />
      </View>
      {widgets.map(({ key, title, component: Widget }) => (
        <Card key={key} title={title}>
          <Widget />
        </Card>
      ))}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  capture: { flexDirection: "row", alignItems: "center", gap: 8 },
  kind: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.native.regular, paddingVertical: 6 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
});
