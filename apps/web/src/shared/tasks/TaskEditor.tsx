import { useEffect } from "react";
import { Button, DatePicker, Drawer, Flex, Form, Input, Popconfirm, Select } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { editTask } from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import type { Task } from "./TaskRow";
import { priorityOptions } from "./priorityOptions";
import { ProjectSelect } from "../projects/ProjectSelect";
import type { Project } from "../projects/useProjects";

interface Values {
  title: string;
  description?: string;
  due?: Dayjs | null;
  priority: TaskPriority;
  projectId?: string | null;
}

/** Edit a task in a side panel: title, notes, due date, priority, project, or delete it. */
export function TaskEditor({
  task,
  projects,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  projects: readonly Project[];
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!task) return;
    form.setFieldsValue({
      title: task.title,
      description: task.description ?? "",
      due: task.dueDate ? dayjs(task.dueDate) : null,
      priority: task.priority,
      projectId: task.projectId,
    });
  }, [task, form]);

  const save = (v: Values) => {
    if (!task) return;
    onSave(
      editTask(
        task,
        {
          title: v.title,
          description: v.description?.trim() ? v.description.trim() : null,
          dueDate: v.due ? v.due.format("YYYY-MM-DD") : null,
          priority: v.priority,
          projectId: v.projectId ?? null,
        },
        new Date(),
      ),
    );
  };

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      title={<span className="pp-label">Task</span>}
      size={420}
      destroyOnHidden
      extra={
        task ? (
          <Popconfirm
            title="Delete this task?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onDelete(task)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete task" />
          </Popconfirm>
        ) : null
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save}>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: "Give the task a title." }]}>
          <Input maxLength={500} />
        </Form.Item>
        <Form.Item name="description" label="Notes">
          <Input.TextArea autoSize={{ minRows: 3 }} placeholder="Details, links, anything to remember" />
        </Form.Item>
        <Flex gap={12}>
          <Form.Item name="due" label="Due" style={{ flex: 1 }}>
            <DatePicker style={{ width: "100%" }} format="ddd D MMM YYYY" placeholder="No date" />
          </Form.Item>
          <Form.Item name="priority" label="Priority" style={{ flex: 1 }}>
            <Select options={priorityOptions} />
          </Form.Item>
        </Flex>
        <Form.Item name="projectId" label="Project">
          <ProjectSelect projects={projects} />
        </Form.Item>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </Flex>
      </Form>
    </Drawer>
  );
}
