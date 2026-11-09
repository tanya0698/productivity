import { useState } from "react";
import { Button, DatePicker, Flex, Input, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { newTask } from "@productivity/domain";
import type { TaskPriority } from "@productivity/contracts";
import { useSyncRuntime } from "@productivity/sync-engine/react";
import { priorityOptions } from "./priorityOptions";
import { ProjectSelect } from "../projects/ProjectSelect";
import type { Project } from "../projects/useProjects";

/**
 * Type a task, optionally pick a date, priority and project, press Enter.
 * With `projectId` fixed (on a project's page) the project picker is hidden.
 */
export function QuickAdd({ projects, projectId: fixedProject }: { projects: readonly Project[]; projectId?: string }) {
  const runtime = useSyncRuntime();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<Dayjs | null>(null);
  const [priority, setPriority] = useState<TaskPriority>(3);
  const [projectId, setProjectId] = useState<string | null>(null);

  const add = async () => {
    if (!title.trim()) return;
    await runtime.write(
      "task",
      newTask(runtime.newId(), new Date(), {
        title,
        dueDate: due ? due.format("YYYY-MM-DD") : null,
        priority,
        projectId: fixedProject ?? projectId,
      }),
    );
    setTitle("");
    setDue(null);
    setPriority(3);
  };

  return (
    <Flex gap={8} wrap>
      <Input
        size="large"
        prefix={<PlusOutlined />}
        placeholder="Add a task"
        aria-label="New task"
        value={title}
        maxLength={500}
        onChange={(e) => setTitle(e.target.value)}
        onPressEnter={() => void add()}
        style={{ flex: "1 1 320px" }}
      />
      <DatePicker
        size="large"
        value={due}
        onChange={setDue}
        placeholder="Due date"
        format="ddd D MMM"
        aria-label="Due date"
        style={{ width: 160 }}
      />
      <Select size="large" value={priority} onChange={setPriority} options={priorityOptions} aria-label="Priority" style={{ width: 140 }} />
      {fixedProject || !projects.length ? null : (
        <ProjectSelect size="large" projects={projects} value={projectId} onChange={setProjectId} aria-label="Project" style={{ width: 180 }} />
      )}
      <Button size="large" type="primary" onClick={() => void add()} disabled={!title.trim()}>
        Add
      </Button>
    </Flex>
  );
}
