import React, { useEffect, useState } from "react";
import { editProject, localDate, projectStatusLabel, type ProjectStatus } from "@productivity/domain";
import Sheet from "../../../components/Sheet";
import { Button, Chips, DateTimeButton, Field, Input } from "../../../components/Field";
import type { Project } from "../../../shared/projects";
import { dateOf } from "../../calendar/components/items";

const statusOptions = (Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => ({ value: s, label: projectStatusLabel[s] }));

/**
 * Create or edit a project. A new project (`isNew`) isn't saved until
 * "Create project" is pressed, so cancelling leaves nothing behind.
 */
export default function ProjectEditor({
  project,
  isNew = false,
  onClose,
  onSave,
}: {
  project: Project | null;
  isNew?: boolean;
  onClose: () => void;
  onSave: (project: Project) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState<Date | null>(null);
  const [status, setStatus] = useState<ProjectStatus>("active");

  const id = project?.id;
  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description ?? "");
    setDue(project.dueDate ? dateOf(project.dueDate) : null);
    setStatus(project.status);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    if (!project || !title.trim()) return;
    onSave(
      editProject(project, { title, description: description || null, dueDate: due ? localDate(due) : null, status }, new Date()),
    );
  };

  return (
    <Sheet open={!!project} title={isNew ? "New project" : "Project"} onClose={onClose}>
      <Field label="Name">
        <Input accessibilityLabel="Name" value={title} onChangeText={setTitle} maxLength={200} placeholder="e.g. Kitchen renovation" autoFocus={isNew} />
      </Field>
      <Field label="What does done look like?">
        <Input
          accessibilityLabel="What does done look like?"
          value={description}
          onChangeText={setDescription}
          placeholder="The outcome, in a sentence or two"
          multiline
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
      </Field>
      <Field label="Target date">
        <DateTimeButton label="Target date" mode="date" value={due} placeholder="No date" onChange={setDue} onClear={() => setDue(null)} />
      </Field>
      <Field label="Status">
        <Chips value={status} options={statusOptions} onChange={setStatus} />
      </Field>
      <Button kind="primary" label={isNew ? "Create project" : "Save"} onPress={save} disabled={!title.trim()} />
      <Button label="Cancel" onPress={onClose} />
    </Sheet>
  );
}
