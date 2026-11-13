import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Switch, ToastAndroid, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  cancelOccurrence,
  editEvent,
  eventReminderChoice,
  newEvent,
  overrideOccurrence,
  planEventReminder,
  repeatLabel,
  seriesWhen,
  taskReminderChoices,
  type EventWhen,
  type LocalEvent,
  type Occurrence,
  type TaskReminderChoice,
} from "@productivity/domain";
import type { ReminderRepeat } from "@productivity/contracts";
import { useLocalRecords, useSyncRuntime } from "@productivity/sync-engine/react";
import Sheet from "../../../components/Sheet";
import { Button, Chips, DateTimeButton, Field, Input } from "../../../components/Field";
import Text from "../../../components/Text";
import { askForNotifications } from "../../../shared/reminders/notifications";
import { deviceTimezone, type Reminder } from "../../../shared/reminders/active";
import { usePalette } from "../../../theme";
import { dateOf, plusDays, ymd, type EventException } from "./items";
import { useConfirm } from "../../../components/ConfirmProvider";

type Scope = "this" | "all";
type Repeat = ReminderRepeat | "none";

/** What the editor is open on: a new event at a time, or an existing occurrence. */
export type EditorTarget = { kind: "new"; when: EventWhen } | { kind: "edit"; occurrence: Occurrence };

const repeatOptions: { value: Repeat; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  ...(Object.keys(repeatLabel) as ReminderRepeat[]).map((r) => ({ value: r, label: repeatLabel[r] })),
];
const toast = (m: string) => Platform.OS === "android" && ToastAndroid.show(m, ToastAndroid.SHORT);

const at = (day: Date, time: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), 0, 0);

function whenFrom(v: { allDay: boolean; date: Date; lastDate: Date | null; start: Date; end: Date }): EventWhen {
  if (v.allDay) {
    const last = v.lastDate && ymd(v.lastDate) >= ymd(v.date) ? v.lastDate : v.date;
    return { allDay: true, startDate: ymd(v.date), endDate: ymd(plusDays(last, 1)) };
  }
  const start = at(v.date, v.start);
  let end = at(v.date, v.end);
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 86_400_000); // ends after midnight
  return { allDay: false, start, end, timezone: deviceTimezone() };
}

/** The reminder's reference point: the start time, or the first day for all-day. */
const dueOf = (when: EventWhen) => (when.allDay ? { dueDate: when.startDate, dueAt: null } : { dueDate: null, dueAt: when.start.toISOString() });

/**
 * Add or change an event: title, all-day or times, repeat, a reminder and
 * notes. For a repeating event, changes and deletes apply to this occurrence
 * or to all of them, exactly as on the web.
 */
export default function EventEditor({ target, onClose }: { target: EditorTarget | null; onClose: () => void }) {
  const runtime = useSyncRuntime();
  const { confirm } = useConfirm();
  const p = usePalette();
  const { records: reminders, loading } = useLocalRecords<Reminder>("reminder");
  const { records: exceptions } = useLocalRecords<EventException>("event_exception");

  const occurrence = target?.kind === "edit" ? target.occurrence : null;
  const event: LocalEvent | null = occurrence?.event ?? null;
  const own = useMemo(() => (event ? reminders.filter((r) => r.eventId === event.id) : []), [reminders, event]);
  const live = own.filter((r) => r.status !== "dismissed" && r.status !== "done");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(new Date());
  const [lastDate, setLastDate] = useState<Date | null>(null);
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [remind, setRemind] = useState<TaskReminderChoice>("none");
  const [scope, setScope] = useState<Scope>("this");

  const targetKey = occurrence?.key ?? (target?.kind === "new" ? JSON.stringify(target.when) : null);
  useEffect(() => {
    if (!target) return;
    const when: EventWhen =
      target.kind === "new"
        ? target.when
        : occurrence!.allDay
          ? { allDay: true, startDate: occurrence!.startDate!, endDate: occurrence!.endDate! }
          : { allDay: false, start: occurrence!.start, end: occurrence!.end, timezone: event!.timezone ?? deviceTimezone() };
    const base = when.allDay ? dateOf(when.startDate) : when.start;
    setTitle(occurrence?.title ?? "");
    setNotes(event?.description ?? "");
    setAllDay(when.allDay);
    setDate(base);
    setLastDate(when.allDay ? plusDays(dateOf(when.endDate), -1) : null);
    setStart(when.allDay ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9) : when.start);
    setEnd(when.allDay ? new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10) : when.end);
    setRepeat(event?.recurrenceRule ?? "none");
    setScope("this");
  }, [targetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // As in the task editor: wait for reminders before showing the choice, or saving would drop it.
  useEffect(() => {
    if (target && !loading) setRemind(event ? eventReminderChoice(event, live[0]) : "none");
  }, [targetKey, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const recurring = !!occurrence?.recurring;
  const thisOnly = recurring && scope === "this";
  const repeats = repeat !== "none";
  const choices = taskReminderChoices(dueOf(whenFrom({ allDay, date, lastDate: date, start, end: start })));
  const reminderOptions = [...choices, ...(remind === "custom" ? [{ value: "custom" as const, label: "Custom (set in Reminders)" }] : [])];
  const choiceKey = choices.map((c) => c.value).join();
  useEffect(() => {
    if (remind !== "custom" && !choiceKey.split(",").includes(remind)) setRemind("none");
  }, [remind, choiceKey]);

  // Moving the start keeps the length, like a calendar app does.
  const changeStart = (d: Date) => {
    const length = end.getTime() - start.getTime();
    setStart(d);
    setEnd(new Date(at(date, d).getTime() + (length > 0 ? length : 3_600_000)));
  };

  const writeReminder = (ev: LocalEvent, choice: TaskReminderChoice) => {
    const plan = planEventReminder(ev, choice, live, { now: new Date(), timezone: deviceTimezone(), newId: () => runtime.newId() });
    for (const r of plan.put) void runtime.write("reminder", r);
    for (const r of plan.remove) void runtime.write("reminder", r, "delete");
    if (plan.put.length) void askForNotifications();
  };

  const save = () => {
    if (!target || loading || !title.trim()) return;
    const now = new Date();
    const when = whenFrom({ allDay, date, lastDate, start, end });
    const fields = { title, description: notes || null, recurrenceRule: repeat === "none" ? null : repeat };

    if (target.kind === "new") {
      const ev = newEvent(runtime.newId(), now, fields, when);
      void runtime.write("event", ev);
      writeReminder(ev, remind);
      toast("Event added");
    } else if (thisOnly) {
      const titleChanged = title.trim() !== event!.title;
      void runtime.write("event_exception", overrideOccurrence(runtime.newId(), occurrence!, { when, title: titleChanged ? title : null }, now));
      toast("This event changed");
    } else {
      // Project and linked task are kept as they are (set on the web for now).
      const ev = editEvent(event!, fields, recurring && fields.recurrenceRule ? seriesWhen(event!, occurrence!, when) : when, now);
      void runtime.write("event", ev);
      writeReminder(ev, remind);
      toast(recurring ? "All events changed" : "Event saved");
    }
    onClose();
  };

  const remove = () => {
    if (!occurrence || !event) return;
    void confirm({ title: recurring ? (scope === "all" ? "Delete every occurrence?" : "Delete just this one?") : "Delete this event?", body: occurrence.title, confirmLabel: "Delete", destructive: true }).then((ok) => {
      if (ok) void (() => {
          const now = new Date();
          if (thisOnly) {
            void runtime.write("event_exception", cancelOccurrence(runtime.newId(), occurrence, now));
            toast("This event deleted");
          } else {
            void runtime.write("event", event, "delete");
            for (const x of exceptions.filter((x) => x.eventId === event.id)) void runtime.write("event_exception", x, "delete");
            for (const r of own) void runtime.write("reminder", r, "delete");
            toast(recurring ? "All events deleted" : "Event deleted");
          }
          onClose();
        })();
    });
  };

  return (
    <Sheet
      open={!!target}
      title={target?.kind === "new" ? "New event" : "Event"}
      onClose={onClose}
      right={
        occurrence ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Delete event" hitSlop={10} onPress={remove}>
            <Ionicons name="trash-outline" size={20} color={p.errorText} />
          </Pressable>
        ) : null
      }
    >
      {recurring ? (
        <Field label="Change">
          <Chips<Scope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "this", label: "This event" },
              { value: "all", label: "All events" },
            ]}
          />
        </Field>
      ) : null}
      <Field label="Title">
        <Input accessibilityLabel="Title" value={title} onChangeText={setTitle} maxLength={500} placeholder="e.g. Lunch with Sam" autoFocus={target?.kind === "new"} />
      </Field>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text weight="medium">All day</Text>
        <Switch
          accessibilityLabel="All day"
          value={allDay}
          onValueChange={setAllDay}
          trackColor={{ true: p.primary, false: p.borderStrong }}
          thumbColor={p.elevated}
        />
      </View>
      <Field label={allDay ? "First day" : "Date"}>
        <DateTimeButton label="Date" mode="date" value={date} onChange={setDate} />
      </Field>
      {allDay ? (
        <Field label="Last day">
          <DateTimeButton label="Last day" mode="date" value={lastDate} placeholder="Same day" onChange={setLastDate} onClear={() => setLastDate(null)} minimumDate={date} />
        </Field>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="From">
              <DateTimeButton label="From" mode="time" value={start} onChange={changeStart} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="To">
              <DateTimeButton label="To" mode="time" value={end} onChange={setEnd} />
            </Field>
          </View>
        </View>
      )}
      <Field label="Repeat" hint={thisOnly ? "Switch to “All events” to change how it repeats." : undefined}>
        {thisOnly ? <Text tone="secondary">{repeat === "none" ? "Doesn't repeat" : repeatLabel[repeat]}</Text> : <Chips value={repeat} options={repeatOptions} onChange={setRepeat} />}
      </Field>
      {thisOnly ? (
        <Text tone="secondary" style={{ fontSize: 13 }}>
          Only this occurrence changes; the rest of the series stays as it is. Its reminder moves with it.
        </Text>
      ) : (
        <>
          <Field label="Reminder" hint={repeats ? "Before every occurrence. One you move or delete on its own takes its reminder with it." : undefined}>
            <Chips value={remind} options={reminderOptions} onChange={setRemind} />
          </Field>
          <Field label="Notes">
            <Input accessibilityLabel="Notes" value={notes} onChangeText={setNotes} placeholder="Where, who, what to bring" multiline textAlignVertical="top" style={{ minHeight: 64 }} />
          </Field>
        </>
      )}
      <Button kind="primary" label={target?.kind === "new" ? "Add event" : "Save"} onPress={save} disabled={loading || !title.trim()} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
