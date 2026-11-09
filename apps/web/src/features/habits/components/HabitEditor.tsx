import { useEffect } from "react";
import { Button, Checkbox, Drawer, Flex, Form, Input, InputNumber, Popconfirm, Segmented, Select } from "antd";
import { DeleteOutlined, InboxOutlined } from "@ant-design/icons";
import { WEEKDAY_NAMES, editHabit, type LocalGoal } from "@productivity/domain";
import { useLocalRecords } from "@/shared";
import type { Habit } from "./useHabits";
import { IconButton } from "@/components/ui/IconButton";

interface Values {
  title: string;
  description?: string;
  cadence: "daily" | "weekly";
  days: number[];
  targetCount: number;
  goalId?: string | null;
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Create or edit a habit: what, how often, how many times, and the goal it serves. */
export function HabitEditor({
  habit,
  isNew,
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
  const [form] = Form.useForm<Values>();
  const cadence = Form.useWatch("cadence", form);
  const { records: goals } = useLocalRecords<LocalGoal & { deletedAt: string | null }>("goal");

  const id = habit?.id;
  useEffect(() => {
    if (!habit) return;
    form.setFieldsValue({
      title: habit.title,
      description: habit.description ?? "",
      cadence: habit.cadence,
      days: habit.daysOfWeek ?? ALL_DAYS,
      targetCount: habit.targetCount,
      goalId: habit.goalId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, form]);

  const save = (v: Values) => {
    if (!habit) return;
    onSave(
      editHabit(
        habit,
        { title: v.title, description: v.description ?? null, cadence: v.cadence, daysOfWeek: v.days, targetCount: v.targetCount, goalId: v.goalId ?? null },
        new Date(),
      ),
    );
  };

  const goalOptions = goals.filter((g) => g.status === "active" || g.id === habit?.goalId).map((g) => ({ value: g.id, label: g.title }));

  return (
    <Drawer
      open={!!habit}
      onClose={onClose}
      title={<span className="pp-label">{isNew ? "New habit" : "Habit"}</span>}
      size={420}
      destroyOnHidden
      extra={
        habit && !isNew ? (
          <Flex gap={4}>
            {onArchive ? (
              <IconButton icon={<InboxOutlined />} tip="Archive: hide it, keep its history" label="Archive habit" onClick={() => onArchive(habit)} />
            ) : null}
            {onDelete ? (
              <Popconfirm title="Delete this habit and its history?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => onDelete(habit)}>
                <IconButton danger icon={<DeleteOutlined />} tip="Delete habit" />
              </Popconfirm>
            ) : null}
          </Flex>
        ) : null
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
        <Form.Item name="title" label="Habit" rules={[{ required: true, whitespace: true, message: "Name the habit." }]}>
          <Input maxLength={200} autoFocus={isNew} placeholder="e.g. Read 20 pages" />
        </Form.Item>
        <Form.Item name="cadence" label="How often">
          <Segmented
            block
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </Form.Item>
        {cadence === "daily" ? (
          <Form.Item name="days" label="On" rules={[{ type: "array", min: 1, message: "Pick at least one day." }]}>
            <Checkbox.Group options={ALL_DAYS.map((d) => ({ value: d, label: WEEKDAY_NAMES[d - 1] }))} />
          </Form.Item>
        ) : null}
        <Form.Item name="targetCount" label={cadence === "weekly" ? "Times a week" : "Times a day"} extra={cadence === "weekly" ? "e.g. gym 3 times a week, any days." : "More than 1 for things you count, like glasses of water."}>
          <InputNumber min={1} max={100} style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="goalId" label="Towards a goal">
          <Select allowClear placeholder="No goal" options={goalOptions} notFoundContent="No goals yet" />
        </Form.Item>
        <Form.Item name="description" label="Notes">
          <Input.TextArea autoSize={{ minRows: 2 }} placeholder="Why, or how" />
        </Form.Item>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            {isNew ? "Add habit" : "Save"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
