import { useEffect } from "react";
import { Button, DatePicker, Drawer, Flex, Form, Input, Popconfirm, Select, TimePicker } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { repeatLabel, rescheduleReminder } from "@productivity/domain";
import type { ReminderRepeat } from "@productivity/contracts";
import type { Reminder } from "@/shared";

interface Values {
  title?: string;
  date: Dayjs;
  time: Dayjs;
  repeat: ReminderRepeat | "none";
}

const repeatOptions = [
  { value: "none", label: "Doesn't repeat" },
  ...(Object.keys(repeatLabel) as ReminderRepeat[]).map((r) => ({ value: r, label: repeatLabel[r] })),
];

/**
 * Create or edit a reminder: what, when, how often. A reminder on a task shows
 * the task's title instead of its own, so its title field is hidden.
 */
export function ReminderEditor({
  reminder,
  isNew,
  linkedTitle,
  onClose,
  onSave,
  onDelete,
}: {
  reminder: Reminder | null;
  isNew?: boolean;
  /** The task's or note's title, for a linked reminder. */
  linkedTitle?: string;
  onClose: () => void;
  onSave: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
}) {
  const [form] = Form.useForm<Values>();

  const id = reminder?.id;
  useEffect(() => {
    if (!reminder) return;
    const at = dayjs(reminder.remindAt);
    form.setFieldsValue({ title: reminder.title ?? "", date: at, time: at, repeat: reminder.recurrenceRule ?? "none" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, form]);

  const save = (v: Values) => {
    if (!reminder) return;
    const at = v.date.hour(v.time.hour()).minute(v.time.minute()).second(0).millisecond(0).toDate();
    onSave(
      rescheduleReminder(
        reminder,
        { remindAt: at, recurrenceRule: v.repeat === "none" ? null : v.repeat, title: linkedTitle ? reminder.title : (v.title ?? "") },
        new Date(),
      ),
    );
  };

  return (
    <Drawer
      open={!!reminder}
      onClose={onClose}
      title={<span className="pp-label">{isNew ? "New reminder" : "Reminder"}</span>}
      size={420}
      destroyOnHidden
      extra={
        reminder && !isNew && onDelete ? (
          <Popconfirm title="Delete this reminder?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(reminder)}>
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete reminder" />
          </Popconfirm>
        ) : null
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
        {linkedTitle ? (
          <Form.Item label="About">
            <Input value={linkedTitle} disabled />
          </Form.Item>
        ) : (
          <Form.Item name="title" label="Remind me to" rules={[{ required: true, whitespace: true, message: "Say what to remind you about." }]}>
            <Input maxLength={500} autoFocus placeholder="e.g. Call the bank" />
          </Form.Item>
        )}
        <Flex gap={12}>
          <Form.Item name="date" label="Date" style={{ flex: 3 }} rules={[{ required: true, message: "Pick a date." }]}>
            <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" allowClear={false} />
          </Form.Item>
          <Form.Item name="time" label="Time" style={{ flex: 2 }} rules={[{ required: true, message: "Pick a time." }]}>
            <TimePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} needConfirm={false} allowClear={false} />
          </Form.Item>
        </Flex>
        <Form.Item name="repeat" label="Repeat">
          <Select options={repeatOptions} />
        </Form.Item>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            {isNew ? "Add reminder" : "Save"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
