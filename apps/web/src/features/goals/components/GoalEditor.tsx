import { useEffect } from "react";
import { Button, DatePicker, Drawer, Flex, Form, Input, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { editGoal, goalStatusLabel, type LocalGoal } from "@productivity/domain";
import type { Goal } from "./useGoals";

interface Values {
  title: string;
  description?: string;
  targetDate?: Dayjs | null;
  reviewCadence: "none" | "weekly" | "monthly";
  status: LocalGoal["status"];
}

/** Create or edit a goal: the outcome, why it matters, by when, and how often to review it. */
export function GoalEditor({ goal, isNew, onClose, onSave }: { goal: Goal | null; isNew?: boolean; onClose: () => void; onSave: (g: Goal) => void }) {
  const [form] = Form.useForm<Values>();
  const id = goal?.id;
  useEffect(() => {
    if (!goal) return;
    form.setFieldsValue({
      title: goal.title,
      description: goal.description ?? "",
      targetDate: goal.targetDate ? dayjs(goal.targetDate) : null,
      reviewCadence: goal.reviewCadence ?? "none",
      status: goal.status,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, form]);

  const save = (v: Values) => {
    if (!goal) return;
    onSave(
      editGoal(
        goal,
        {
          title: v.title,
          description: v.description ?? null,
          targetDate: v.targetDate ? v.targetDate.format("YYYY-MM-DD") : null,
          reviewCadence: v.reviewCadence === "none" ? null : v.reviewCadence,
          status: v.status,
        },
        new Date(),
      ),
    );
  };

  return (
    <Drawer open={!!goal} onClose={onClose} title={<span className="pp-label">{isNew ? "New goal" : "Goal"}</span>} size={440} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
        <Form.Item name="title" label="Goal" rules={[{ required: true, whitespace: true, message: "Say what you want to achieve." }]}>
          <Input maxLength={200} autoFocus={isNew} placeholder="e.g. Run a half marathon" />
        </Form.Item>
        <Form.Item name="description" label="Why it matters">
          <Input.TextArea autoSize={{ minRows: 2 }} placeholder="You'll see this each time you review it" />
        </Form.Item>
        <Flex gap={12} wrap>
          <Form.Item name="targetDate" label="By" style={{ flex: "1 1 160px" }}>
            <DatePicker style={{ width: "100%" }} format="D MMM YYYY" placeholder="No date" />
          </Form.Item>
          <Form.Item name="reviewCadence" label="Review" style={{ flex: "1 1 140px" }}>
            <Select
              options={[
                { value: "none", label: "No reviews" },
                { value: "weekly", label: "Every week" },
                { value: "monthly", label: "Every month" },
              ]}
            />
          </Form.Item>
        </Flex>
        {isNew ? null : (
          <Form.Item name="status" label="Status">
            <Select options={(Object.keys(goalStatusLabel) as LocalGoal["status"][]).map((s) => ({ value: s, label: goalStatusLabel[s] }))} />
          </Form.Item>
        )}
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            {isNew ? "Add goal" : "Save"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
