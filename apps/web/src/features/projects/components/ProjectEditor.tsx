import { useEffect } from "react";
import { Button, DatePicker, Drawer, Flex, Form, Input, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { editProject, type ProjectStatus } from "@productivity/domain";
import type { Project } from "@/shared";
import { statusOptions } from "./status";

interface Values {
  title: string;
  description?: string;
  due?: Dayjs | null;
  status: ProjectStatus;
}

/**
 * Create or edit a project in a side panel. A new project (`isNew`) isn't
 * saved until Save is pressed, so cancelling leaves nothing behind.
 */
export function ProjectEditor({
  project,
  isNew,
  onClose,
  onSave,
}: {
  project: Project | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
}) {
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!project) return;
    form.setFieldsValue({
      title: project.title,
      description: project.description ?? "",
      due: project.dueDate ? dayjs(project.dueDate) : null,
      status: project.status,
    });
  }, [project, form]);

  const save = (v: Values) => {
    if (!project) return;
    onSave(
      editProject(
        project,
        {
          title: v.title,
          description: v.description ?? null,
          dueDate: v.due ? v.due.format("YYYY-MM-DD") : null,
          status: v.status,
        },
        new Date(),
      ),
    );
  };

  return (
    <Drawer
      open={!!project}
      onClose={onClose}
      title={<span className="pp-label">{isNew ? "New project" : "Project"}</span>}
      size={440}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
        <Form.Item name="title" label="Name" rules={[{ required: true, whitespace: true, message: "Give the project a name." }]}>
          <Input maxLength={200} autoFocus placeholder="e.g. Kitchen renovation" />
        </Form.Item>
        <Form.Item name="description" label="What does done look like?">
          <Input.TextArea autoSize={{ minRows: 3 }} placeholder="The outcome, in a sentence or two" />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item name="due" label="Target date" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" placeholder="No date" />
          </Form.Item>
          <Form.Item name="status" label="Status" style={{ flex: 1 }}>
            <Select options={statusOptions} />
          </Form.Item>
        </Flex>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            {isNew ? "Create project" : "Save"}
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
