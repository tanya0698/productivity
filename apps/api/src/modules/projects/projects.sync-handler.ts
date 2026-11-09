import { project } from "@productivity/contracts";
import { dateOnly, instant, ownGoalOrNull, versionedHandler } from "../../sync/sync-handler";

const editable = project.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });

export const projectsSyncHandler = versionedHandler({
  entityType: "project",
  delegate: (tx) => tx.project as never,
  toData: (payload) => {
    const p = editable.parse(payload);
    return {
      title: p.title,
      description: p.description,
      status: p.status,
      startDate: dateOnly.toDb(p.startDate),
      dueDate: dateOnly.toDb(p.dueDate),
      goalId: p.goalId,
    };
  },
  prepare: ownGoalOrNull,
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    description: r.description,
    status: r.status,
    startDate: dateOnly.fromDb(r.startDate),
    dueDate: dateOnly.fromDb(r.dueDate),
    goalId: r.goalId,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
