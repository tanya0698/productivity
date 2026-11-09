import { useEffect } from "react";
import { App as AntApp, Button, DatePicker, Drawer, Flex, Form, Input, Popconfirm, Segmented, Select, Switch, TimePicker, Typography } from "antd";
import { BellOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import {
  cancelOccurrence,
  editEvent,
  isDone,
  newEvent,
  overrideOccurrence,
  planTaskReminder,
  repeatLabel,
  seriesWhen,
  taskReminderChoice,
  taskReminderChoices,
  type EventWhen,
  type LocalEvent,
  type Occurrence,
  type TaskReminderChoice,
} from "@productivity/domain";
import type { ReminderRepeat } from "@productivity/contracts";
import { ProjectSelect, deviceTimezone, useLocalRecords, useReminders, useSyncRuntime, type Project, type Task } from "@/shared";
import type { EventException } from "./items";

type Scope = "this" | "all";

interface Values {
  title: string;
  description?: string;
  allDay: boolean;
  date: Dayjs;
  /** All-day: last day, inclusive. */
  lastDate?: Dayjs | null;
  start?: Dayjs | null;
  end?: Dayjs | null;
  repeat: ReminderRepeat | "none";
  projectId?: string | null;
  taskId?: string | null;
  remind: TaskReminderChoice;
  scope: Scope;
}

/** What the editor is open on: a new event at a time, or an existing occurrence. */
export type EditorTarget = { kind: "new"; when: EventWhen } | { kind: "edit"; occurrence: Occurrence };

const repeatOptions = [
  { value: "none", label: "Doesn't repeat" },
  ...(Object.keys(repeatLabel) as ReminderRepeat[]).map((r) => ({ value: r, label: repeatLabel[r] })),
];

function whenFrom(v: Pick<Values, "allDay" | "date" | "lastDate" | "start" | "end">): EventWhen {
  if (v.allDay) {
    const last = v.lastDate && !v.lastDate.isBefore(v.date, "day") ? v.lastDate : v.date;
    return { allDay: true, startDate: v.date.format("YYYY-MM-DD"), endDate: last.add(1, "day").format("YYYY-MM-DD") };
  }
  const at = (t: Dayjs | null | undefined, fallback: Dayjs) =>
    v.date.hour((t ?? fallback).hour()).minute((t ?? fallback).minute()).second(0).millisecond(0);
  const start = at(v.start, v.date.hour(9));
  let end = at(v.end, start.add(1, "hour"));
  if (!end.isAfter(start)) end = end.add(1, "day"); // ends after midnight
  return { allDay: false, start: start.toDate(), end: end.toDate(), timezone: deviceTimezone() };
}

/** The reminder's reference point: the start time, or the first day for all-day. */
const dueOf = (when: EventWhen) =>
  when.allDay ? { dueDate: when.startDate, dueAt: null } : { dueDate: null, dueAt: when.start.toISOString() };

/**
 * Add or change an event: title, all-day or times, repeat, project, the task
 * it makes time for, a reminder (one-off events), and notes. For a repeating
 * event, changes and deletes apply to this occurrence or to all of them.
 */
export function EventEditor({
  target,
  projects,
  onClose,
}: {
  target: EditorTarget | null;
  projects: readonly Project[];
  onClose: () => void;
}) {
  const [form] = Form.useForm<Values>();
  const runtime = useSyncRuntime();
  const { message } = AntApp.useApp();
  const { records: reminders, loading: remindersLoading } = useReminders();
  const { records: exceptions } = useLocalRecords<EventException>("event_exception");
  const { records: tasks } = useLocalRecords<Task>("task");

  const occurrence = target?.kind === "edit" ? target.occurrence : null;
  const event: LocalEvent | null = occurrence?.event ?? null;
  const own = event ? reminders.filter((r) => r.eventId === event.id) : [];
  const live = own.filter((r) => r.status !== "dismissed" && r.status !== "done");

  const allDay = Form.useWatch("allDay", form);
  const repeat = Form.useWatch("repeat", form);
  const scope = Form.useWatch("scope", form);
  const date = Form.useWatch("date", form);
  const start = Form.useWatch("start", form);
  const remind = Form.useWatch("remind", form);

  const targetKey = occurrence?.key ?? (target?.kind === "new" ? JSON.stringify(target.when) : null);
  useEffect(() => {
    if (!target) return;
    const when: EventWhen | null =
      target.kind === "new"
        ? target.when
        : occurrence!.allDay
          ? { allDay: true, startDate: occurrence!.startDate!, endDate: occurrence!.endDate! }
          : { allDay: false, start: occurrence!.start, end: occurrence!.end, timezone: event!.timezone ?? deviceTimezone() };
    const base = when!.allDay ? dayjs(when!.startDate) : dayjs(when!.start);
    form.setFieldsValue({
      title: occurrence?.title ?? "",
      description: event?.description ?? "",
      allDay: when!.allDay,
      date: base,
      lastDate: when!.allDay ? dayjs(when!.endDate).subtract(1, "day") : null,
      start: when!.allDay ? base.hour(9).minute(0) : dayjs(when!.start),
      end: when!.allDay ? base.hour(10).minute(0) : dayjs(when!.end),
      repeat: event?.recurrenceRule ?? "none",
      projectId: event?.projectId ?? null,
      taskId: event?.taskId ?? null,
      scope: "this",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, form]);

  // The reminder choice waits for reminders to load, as in the task editor:
  // showing "No reminder" early and saving would delete the event's reminder.
  useEffect(() => {
    if (!target || remindersLoading) return;
    const when = occurrence
      ? occurrence.allDay
        ? ({ allDay: true, startDate: occurrence.startDate!, endDate: occurrence.endDate! } as const)
        : ({ allDay: false, start: occurrence.start, end: occurrence.end, timezone: deviceTimezone() } as const)
      : target.kind === "new"
        ? target.when
        : null;
    form.setFieldValue("remind", when ? taskReminderChoice(dueOf(when), live[0]) : "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, remindersLoading, form]);

  const recurring = !!occurrence?.recurring;
  const thisOnly = recurring && scope === "this";
  const repeats = repeat && repeat !== "none";
  const reminderChoices = date ? taskReminderChoices(dueOf(whenFrom({ allDay: !!allDay, date, start, end: start, lastDate: date }))) : [];
  const reminderOptions = [...reminderChoices, ...(remind === "custom" ? [{ value: "custom" as const, label: "Custom (set on the Reminders page)" }] : [])];

  // A choice that no longer fits (switched to all-day, say) falls back to none.
  const choiceKey = reminderChoices.map((c) => c.value).join();
  useEffect(() => {
    const allowed = choiceKey.split(",");
    if (remind && remind !== "custom" && choiceKey && !allowed.includes(remind)) form.setFieldValue("remind", "none");
  }, [remind, choiceKey, form]);

  const writeReminder = (ev: LocalEvent, when: EventWhen, choice: TaskReminderChoice, repeatsNow: boolean) => {
    // Reminders on repeating events aren't offered yet: one moved or cancelled
    // occurrence would still alert at its old time (plan: cancelled never fire).
    const plan = planTaskReminder({ id: ev.id, title: ev.title, ...dueOf(when) }, repeatsNow ? "none" : choice, live, {
      now: new Date(),
      timezone: deviceTimezone(),
      newId: () => runtime.newId(),
    }, { eventId: ev.id });
    for (const r of plan.put) void runtime.write("reminder", r);
    for (const r of plan.remove) void runtime.write("reminder", r, "delete");
  };

  const save = (v: Values) => {
    if (!target || remindersLoading) return;
    const now = new Date();
    const when = whenFrom(v);
    const fields = {
      title: v.title,
      description: v.description ?? null,
      projectId: v.projectId ?? null,
      taskId: v.taskId ?? null,
      recurrenceRule: v.repeat === "none" ? null : v.repeat,
    };

    if (target.kind === "new") {
      const ev = newEvent(runtime.newId(), now, fields, when);
      void runtime.write("event", ev);
      writeReminder(ev, when, v.remind, !!fields.recurrenceRule);
      void message.success("Event added");
    } else if (recurring && v.scope === "this") {
      const titleChanged = v.title.trim() !== event!.title;
      const x = overrideOccurrence(runtime.newId(), occurrence!, { when, title: titleChanged ? v.title : null }, now);
      void runtime.write("event_exception", x);
      void message.success("This event changed");
    } else {
      const ev = editEvent(event!, fields, recurring && fields.recurrenceRule ? seriesWhen(event!, occurrence!, when) : when, now);
      void runtime.write("event", ev);
      writeReminder(ev, when, v.remind, !!fields.recurrenceRule);
      void message.success(recurring ? "All events changed" : "Event saved");
    }
    onClose();
  };

  const remove = () => {
    if (!occurrence || !event) return;
    const now = new Date();
    if (recurring && scope === "this") {
      void runtime.write("event_exception", cancelOccurrence(runtime.newId(), occurrence, now));
      void message.success("This event deleted");
    } else {
      void runtime.write("event", event, "delete");
      for (const x of exceptions.filter((x) => x.eventId === event.id)) void runtime.write("event_exception", x, "delete");
      for (const r of own) void runtime.write("reminder", r, "delete");
      void message.success(recurring ? "All events deleted" : "Event deleted");
    }
    onClose();
  };

  const openTasks = tasks.filter((t) => !isDone(t) || t.id === event?.taskId).map((t) => ({ value: t.id, label: t.title }));

  return (
    <Drawer
      open={!!target}
      onClose={onClose}
      title={<span className="pp-label">{target?.kind === "new" ? "New event" : "Event"}</span>}
      size={460}
      destroyOnHidden
      extra={
        occurrence ? (
          <Popconfirm
            title={recurring ? (scope === "all" ? "Delete every occurrence?" : "Delete just this one?") : "Delete this event?"}
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={remove}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete event" />
          </Popconfirm>
        ) : null
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save} initialValues={{ remind: "none", scope: "this", allDay: false, repeat: "none" }}>
        {recurring ? (
          <Form.Item name="scope" label="Change">
            <Segmented<Scope>
              block
              options={[
                { value: "this", label: "This event" },
                { value: "all", label: "All events" },
              ]}
            />
          </Form.Item>
        ) : null}
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: "Give the event a title." }]}>
          <Input maxLength={500} autoFocus={target?.kind === "new"} placeholder="e.g. Lunch with Sam" />
        </Form.Item>
        <Flex gap={12} align="center" style={{ marginBottom: 12 }}>
          <Form.Item name="allDay" valuePropName="checked" noStyle>
            <Switch size="small" id="pp-all-day" />
          </Form.Item>
          <label htmlFor="pp-all-day">All day</label>
        </Flex>
        <Flex gap={12} wrap>
          <Form.Item name="date" label={allDay ? "First day" : "Date"} style={{ flex: "1 1 160px" }} rules={[{ required: true, message: "Pick a date." }]}>
            <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" allowClear={false} />
          </Form.Item>
          {allDay ? (
            <Form.Item name="lastDate" label="Last day" style={{ flex: "1 1 160px" }}>
              <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" placeholder="Same day" />
            </Form.Item>
          ) : (
            <>
              <Form.Item name="start" label="From" style={{ flex: "1 1 90px" }}>
                <TimePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} needConfirm={false} allowClear={false} />
              </Form.Item>
              <Form.Item name="end" label="To" style={{ flex: "1 1 90px" }}>
                <TimePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} needConfirm={false} allowClear={false} />
              </Form.Item>
            </>
          )}
        </Flex>

        <Form.Item name="repeat" label="Repeat" extra={thisOnly ? "Switch to “All events” to change how it repeats." : undefined}>
          <Select options={repeatOptions} disabled={thisOnly} />
        </Form.Item>
        {thisOnly ? null : (
          <Form.Item
            name="remind"
            label="Reminder"
            extra={repeats ? "Reminders on repeating events are coming; add a repeating reminder on the Reminders page for now." : undefined}
          >
            <Select options={reminderOptions} suffixIcon={<BellOutlined />} disabled={!!repeats} aria-label="Event reminder" />
          </Form.Item>
        )}
        {thisOnly ? null : (
          <Flex gap={12} wrap>
            <Form.Item name="projectId" label="Project" style={{ flex: "1 1 160px" }}>
              <ProjectSelect projects={projects} />
            </Form.Item>
            <Form.Item name="taskId" label="Time for a task" style={{ flex: "1 1 160px" }}>
              <Select allowClear showSearch={{ optionFilterProp: "label" }} placeholder="No task" options={openTasks} />
            </Form.Item>
          </Flex>
        )}
        {thisOnly ? null : (
          <Form.Item name="description" label="Notes">
            <Input.TextArea autoSize={{ minRows: 2 }} placeholder="Where, who, what to bring" />
          </Form.Item>
        )}
        {thisOnly ? (
          <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
            Only this occurrence changes; the rest of the series stays as it is.
          </Typography.Paragraph>
        ) : null}
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={remindersLoading}>
            {target?.kind === "new" ? "Add event" : "Save"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
