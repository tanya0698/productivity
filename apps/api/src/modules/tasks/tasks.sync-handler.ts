import { task } from "@productivity/contracts";
import { dateOnly, instant, ownProjectOrNull, versionedHandler } from "../../sync/sync-handler";

const editable = task.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });

export const tasksSyncHandler = versionedHandler({
  entityType: "task",
  delegate: (tx) => tx.task as never,
  prepare: ownProjectOrNull,
  toData: (payload) => {
    const t = editable.parse(payload);
    if (t.dueDate && t.dueAt) throw new Error("set dueDate or dueAt, not both");
    return {
      projectId: t.projectId,
      parentTaskId: t.parentTaskId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: dateOnly.toDb(t.dueDate),
      dueAt: instant.toDb(t.dueAt),
      startDate: dateOnly.toDb(t.startDate),
      completedAt: instant.toDb(t.completedAt),
      recurrenceRule: t.recurrenceRule,
      recurrenceTimezone: t.recurrenceTimezone,
    };
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    projectId: r.projectId,
    parentTaskId: r.parentTaskId,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: dateOnly.fromDb(r.dueDate),
    dueAt: instant.fromDb(r.dueAt),
    startDate: dateOnly.fromDb(r.startDate),
    completedAt: instant.fromDb(r.completedAt),
    recurrenceRule: r.recurrenceRule,
    recurrenceTimezone: r.recurrenceTimezone,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
