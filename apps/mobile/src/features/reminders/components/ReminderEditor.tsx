import React, { useEffect, useState } from "react";
import { Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { repeatLabel, rescheduleReminder } from "@productivity/domain";
import type { ReminderRepeat } from "@productivity/contracts";
import Sheet from "../../../components/Sheet";
import { Button, Chips, DateTimeButton, Field, Input } from "../../../components/Field";
import Text from "../../../components/Text";
import type { Reminder } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";

type Repeat = ReminderRepeat | "none";
const repeatOptions: { value: Repeat; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  ...(Object.keys(repeatLabel) as ReminderRepeat[]).map((r) => ({ value: r, label: repeatLabel[r] })),
];

/**
 * Create or edit a reminder: what, when, how often. One on a note shows the
 * note's title instead of its own. The same fields as the web editor.
 */
export default function ReminderEditor({
  reminder,
  isNew,
  linkedTitle,
  onClose,
  onSave,
  onDelete,
}: {
  reminder: Reminder | null;
  isNew?: boolean;
  linkedTitle?: string;
  onClose: () => void;
  onSave: (r: Reminder) => void;
  onDelete?: (r: Reminder) => void;
}) {
  const p = usePalette();
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(new Date());
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [error, setError] = useState<string | null>(null);

  const id = reminder?.id;
  useEffect(() => {
    if (!reminder) return;
    setTitle(reminder.title ?? "");
    setAt(new Date(reminder.remindAt));
    setRepeat(reminder.recurrenceRule ?? "none");
    setError(null);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setDay = (d: Date) => {
    const next = new Date(at);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setAt(next);
  };
  const setClock = (d: Date) => {
    const next = new Date(at);
    next.setHours(d.getHours(), d.getMinutes(), 0, 0);
    setAt(next);
  };

  const save = () => {
    if (!reminder) return;
    if (!linkedTitle && !title.trim()) return setError("Say what to remind you about.");
    const when = new Date(at);
    when.setSeconds(0, 0);
    if (repeat === "none" && when.getTime() < Date.now() - 60_000) return setError("That time has passed. Pick a later one.");
    onSave(
      rescheduleReminder(reminder, { remindAt: when, recurrenceRule: repeat === "none" ? null : repeat, title: linkedTitle ? reminder.title : title }, new Date()),
    );
  };

  const confirmDelete = () =>
    reminder &&
    onDelete &&
    Alert.alert("Delete this reminder?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(reminder) },
    ]);

  return (
    <Sheet
      open={!!reminder}
      title={isNew ? "New reminder" : "Reminder"}
      onClose={onClose}
      right={
        reminder && !isNew && onDelete ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete reminder" hitSlop={10} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={20} color={p.errorText} />
          </Pressable>
        ) : null
      }
    >
      {linkedTitle ? (
        <Field label="About">
          <Text weight="medium">{linkedTitle}</Text>
        </Field>
      ) : (
        <Field label="Remind me to">
          <Input
            accessibilityLabel="Remind me to"
            placeholder="e.g. Call the bank"
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              setError(null);
            }}
            maxLength={500}
            autoFocus={isNew}
          />
        </Field>
      )}
      <Field label="When">
        <DateTimeButton label="Date" mode="date" value={at} onChange={setDay} />
        <DateTimeButton label="Time" mode="time" value={at} onChange={setClock} />
      </Field>
      <Field label="Repeat">
        <Chips value={repeat} options={repeatOptions} onChange={setRepeat} />
      </Field>
      {error ? <Text style={{ color: p.errorText }}>{error}</Text> : null}
      <Button kind="primary" label={isNew ? "Add reminder" : "Save"} onPress={save} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
