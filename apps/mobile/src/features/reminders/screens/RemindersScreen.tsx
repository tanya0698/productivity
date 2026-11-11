import React, { useCallback, useMemo, useState } from "react";
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, StyleSheet, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import {
  dismissReminder,
  localDate,
  endReminder,
  newReminder,
  noteDisplayTitle,
  repeatLabel,
  setTaskStatus,
  snoozeChoices,
  snoozeReminder,
  type LocalNote,
  type LocalTask,
} from "@productivity/domain";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import { Button } from "../../../components/Field";
import { Card } from "../../../components/ListCard";
import { RowsSkeleton } from "../../../components/Skeleton";
import { useDataReady } from "../../../shared/data/useDataReady";
import ScreenFrame from "../../../components/ScreenFrame";
import Text from "../../../components/Text";
import { deviceTimezone, useActiveReminders, useNow, whenText, type ActiveReminder, type Reminder } from "../../../shared/reminders/active";
import { askForNotifications } from "../../../shared/reminders/notifications";
import { radii, usePalette } from "../../../theme";
import ReminderEditor from "../components/ReminderEditor";
import { go } from "../../../navigation/ref";

type Editing = { reminder: Reminder; isNew: boolean; linkedTitle?: string };
const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

/** Ask a question with a few choices: Android shows a dialog, iOS an action sheet. */
function choose(title: string, options: { label: string; destructive?: boolean; run: () => void }[]) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length, destructiveButtonIndex: options.findIndex((o) => o.destructive) },
      (i) => options[i]?.run(),
    );
  } else {
    Alert.alert(title, undefined, [...options.map((o) => ({ text: o.label, style: o.destructive ? ("destructive" as const) : ("default" as const), onPress: o.run })), { text: "Cancel", style: "cancel" as const }], { cancelable: true });
  }
}

/**
 * Reminders: what's due now (snooze, dismiss, or tick off the task), what's
 * coming up, and what was dismissed lately. Alerts themselves are Android
 * notifications, scheduled by ReminderNotifications.
 */
export default function RemindersScreen() {
  const runtime = useSyncRuntime();
  const now = useNow(15_000);
  const { items, reminders, loading } = useActiveReminders(now);
  const ready = useDataReady(loading);
  const { records: tasks } = useLocalRecords<LocalTask & { deletedAt: string | null }>("task");
  const { records: notes } = useLocalRecords<LocalNote & { deletedAt: string | null }>("note");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showPast, setShowPast] = useState(false);
  const p = usePalette();

  const due = items.filter((i) => i.at.getTime() <= now.getTime());
  const upcoming = items.filter((i) => i.at.getTime() > now.getTime());
  const history = useMemo(
    () => reminders.filter((r) => r.status === "dismissed" || r.status === "done").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 20),
    [reminders],
  );
  const nameOf = (r: Reminder) =>
    r.title ||
    (r.taskId && tasks.find((t) => t.id === r.taskId)?.title) ||
    (r.noteId && notes.find((n) => n.id === r.noteId) ? noteDisplayTitle(notes.find((n) => n.id === r.noteId)!) : null) ||
    "Reminder";

  const create = () => {
    const at = new Date(Date.now() + 60 * 60_000);
    at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5, 0, 0);
    setEditing({ reminder: newReminder(runtime.newId(), new Date(), { remindAt: at, timezone: deviceTimezone() }) as Reminder, isNew: true });
  };

  return (
    <ScreenFrame eyebrow="Plan" title="Reminders">
      <NotificationsBanner />
      <Button kind="primary" label="New reminder" onPress={create} />

      {due.length ? (
        <Card title={`Due now · ${due.length}`}>
          {due.map((item, i) => (
            <ReminderRow key={item.reminder.id} item={item} now={now} due first={i === 0} onEdit={setEditing} />
          ))}
        </Card>
      ) : null}

      <Card title="Coming up" right={String(upcoming.length)}>
        {upcoming.length ? (
          upcoming.map((item, i) => <ReminderRow key={item.reminder.id} item={item} now={now} first={i === 0} onEdit={setEditing} />)
        ) : !ready ? (
          <RowsSkeleton rows={3} check={false} />
        ) : (
          <Text tone="secondary" style={{ paddingBottom: 12 }}>
            Nothing coming up. Add a reminder, or give a task a due time and a reminder.
          </Text>
        )}
      </Card>

      {history.length ? (
        <Card
          title={`Dismissed lately · ${history.length}`}
          right={
            <Pressable accessibilityRole="button" accessibilityLabel={showPast ? "Hide" : "Show"} hitSlop={10} onPress={() => setShowPast(!showPast)}>
              <Ionicons name={showPast ? "chevron-up" : "chevron-down"} size={16} color={p.textMuted} />
            </Pressable>
          }
        >
          {showPast
            ? history.map((r) => (
                <View key={r.id} style={styles.past}>
                  <Text tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                    {nameOf(r)}
                  </Text>
                  <Text tone="muted" style={{ fontSize: 12 }}>
                    {whenText(new Date(r.lastHandledAt ?? r.remindAt), now)}
                  </Text>
                </View>
              ))
            : null}
        </Card>
      ) : null}

      <ReminderEditor
        reminder={editing?.reminder ?? null}
        isNew={editing?.isNew}
        linkedTitle={editing?.linkedTitle}
        onClose={() => setEditing(null)}
        onSave={(r) => {
          void runtime.write("reminder", r);
          toast(editing?.isNew ? "Reminder added" : "Reminder saved");
          if (editing?.isNew) void askForNotifications();
          setEditing(null);
        }}
        onDelete={(r) => {
          void runtime.write("reminder", r, "delete");
          toast("Reminder deleted");
          setEditing(null);
        }}
      />
    </ScreenFrame>
  );
}

function ReminderRow({
  item,
  now,
  due = false,
  first,
  onEdit,
}: {
  item: ActiveReminder;
  now: Date;
  due?: boolean;
  first: boolean;
  onEdit: (e: Editing) => void;
}) {
  const runtime = useSyncRuntime();  const p = usePalette();
  const { reminder, at, title, task, note, event, series } = item;
  const repeating = !!reminder.recurrenceRule;

  const open = () => {
    if (task) go("tasks", { task: task.id });
    else if (event) go("calendar", { date: localDate(at) });
    else onEdit({ reminder, isNew: false, linkedTitle: note ? title : undefined });
  };
  const snooze = () =>
    choose(
      "Snooze for",
      snoozeChoices(new Date()).map((c) => ({
        label: c.label,
        run: () => {
          const t = new Date();
          const until = snoozeChoices(t).find((x) => x.label === c.label)!.until;
          void runtime.write("reminder", snoozeReminder(reminder, until, t));
        },
      })),
    );
  const more = () =>
    choose(title, [
      { label: "Skip the next one", run: () => void runtime.write("reminder", dismissReminder(reminder, new Date(), series)) },
      { label: "Stop repeating", destructive: true, run: () => void runtime.write("reminder", endReminder(reminder, new Date())) },
    ]);

  return (
    <View style={[styles.row, { borderColor: p.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth }]}>
      <View style={styles.rowTop}>
        <View style={[styles.icon, { backgroundColor: due ? p.warningSoft : p.muted }]}>
          <Ionicons name={due ? "notifications" : "time-outline"} size={16} color={due ? p.warningText : p.textSecondary} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open reminder: ${title}`}
          onPress={open}
          onLongPress={repeating && !due ? more : undefined}
          style={{ flex: 1, gap: 4 }}
        >
          <Text weight="medium">{title}</Text>
          <View style={styles.meta}>
            <View style={[styles.badge, { backgroundColor: due ? p.warningSoft : p.muted }]}>
              <Text style={{ fontSize: 12, color: due ? p.warningText : p.textSecondary }}>{whenText(at, now)}</Text>
            </View>
            {reminder.status === "snoozed" ? <Text tone="secondary" style={{ fontSize: 12 }}>Snoozed</Text> : null}
            {repeating ? (
              <Text tone="secondary" style={{ fontSize: 12 }}>
                ↻ {series ? "Each time" : repeatLabel[reminder.recurrenceRule!]}
              </Text>
            ) : null}
            {task || note || event ? (
              <Text tone="muted" style={{ fontSize: 12 }}>
                {task ? "Task" : note ? "Note" : "Event"}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {repeating && !due ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`More for ${title}`} hitSlop={10} onPress={more}>
            <Ionicons name="ellipsis-horizontal" size={18} color={p.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {due ? (
        <View style={styles.actions}>
          <Button small label="Snooze" onPress={snooze} />
          {task ? (
            <Button
              small
              label="Done"
              onPress={() => {
                const t = new Date();
                void runtime.write("task", { ...setTaskStatus(task, "done", t), updatedAt: t.toISOString() });
                void runtime.write("reminder", dismissReminder(reminder, t, series));
              }}
            />
          ) : null}
          <Button small kind="primary" label="Dismiss" onPress={() => void runtime.write("reminder", dismissReminder(reminder, new Date(), series))} />
        </View>
      ) : null}
    </View>
  );
}

const EXACT_TIP = "reminders.exactTipHidden";

/**
 * Notifications are what make reminders work on the phone, so ask for them
 * here. Once allowed, a one-time tip about Android's exact-alarm setting,
 * without which alerts can arrive late.
 */
function NotificationsBanner() {
  const runtime = useSyncRuntime();
  const p = usePalette();
  const [state, setState] = useState<{ granted: boolean; canAsk: boolean } | null>(null);
  const [tipHidden, setTipHidden] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void Notifications.getPermissionsAsync().then((s) => live && setState({ granted: s.granted, canAsk: s.canAskAgain }));
      void runtime.db.getMeta(EXACT_TIP).then((v) => live && setTipHidden(v === "1"));
      return () => {
        live = false;
      };
    }, [runtime]),
  );

  if (!state) return null;
  const box = [styles.banner, { backgroundColor: p.primarySoft, borderColor: p.border }];

  if (!state.granted) {
    return (
      <View style={box}>
        <Ionicons name="notifications-outline" size={20} color={p.primaryStrong} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text weight="semiBold">Turn on notifications</Text>
          <Text tone="secondary" style={{ fontSize: 13 }}>
            Reminders alert you with a notification, even with the app closed and no connection.
          </Text>
          <View style={{ flexDirection: "row" }}>
            <Button
              small
              kind="primary"
              label={state.canAsk ? "Turn on" : "Open settings"}
              onPress={() =>
                state.canAsk
                  ? void askForNotifications().then((granted) => setState({ granted, canAsk: false }))
                  : void Linking.openSettings()
              }
            />
          </View>
        </View>
      </View>
    );
  }
  if (tipHidden || Platform.OS !== "android") return null;
  return (
    <View style={box}>
      <Ionicons name="alarm-outline" size={20} color={p.primaryStrong} />
      <View style={{ flex: 1, gap: 8 }}>
        <Text weight="semiBold">Alerts on the minute</Text>
        <Text tone="secondary" style={{ fontSize: 13 }}>
          Android can hold alerts back to save battery. In Settings → Apps → Creedence, turn on Alarms &amp; reminders so they arrive on time.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button small kind="primary" label="Open settings" onPress={() => void Linking.openSettings()} />
          <Button
            small
            label="Done"
            onPress={() => {
              setTipHidden(true);
              void runtime.db.setMeta(EXACT_TIP, "1");
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 11, gap: 10 },
  rowTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  past: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  banner: { flexDirection: "row", gap: 12, padding: 14, borderRadius: radii.lg, borderWidth: 1 },
});
