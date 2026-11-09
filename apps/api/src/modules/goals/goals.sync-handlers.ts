import { goal, goalMilestone } from "@productivity/contracts";
import { RejectOperation, dateOnly, instant, versionedHandler } from "../../sync/sync-handler";

const omitSync = { id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true } as const;
const editableGoal = goal.omit(omitSync);
const editableMilestone = goalMilestone.omit(omitSync);

export const goalsSyncHandler = versionedHandler({
  entityType: "goal",
  delegate: (tx) => tx.goal as never,
  toData: (payload) => {
    const g = editableGoal.parse(payload);
    return {
      title: g.title,
      description: g.description,
      status: g.status,
      targetDate: dateOnly.toDb(g.targetDate),
      reviewCadence: g.reviewCadence,
      lastReviewedAt: instant.toDb(g.lastReviewedAt),
    };
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    title: r.title,
    description: r.description,
    status: r.status,
    targetDate: dateOnly.fromDb(r.targetDate),
    reviewCadence: r.reviewCadence,
    lastReviewedAt: instant.fromDb(r.lastReviewedAt),
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});

export const goalMilestonesSyncHandler = versionedHandler({
  entityType: "goal_milestone",
  delegate: (tx) => tx.goalMilestone as never,
  toData: (payload) => {
    const m = editableMilestone.parse(payload);
    return { goalId: m.goalId, title: m.title, dueDate: dateOnly.toDb(m.dueDate), doneAt: instant.toDb(m.doneAt), position: m.position };
  },
  prepare: async (tx, userId, data) => {
    const owner = await tx.goal.findFirst({ where: { id: data.goalId as string, userId }, select: { id: true } });
    if (!owner) throw new RejectOperation("goal_not_found");
    return data;
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    goalId: r.goalId,
    title: r.title,
    dueDate: dateOnly.fromDb(r.dueDate),
    doneAt: instant.fromDb(r.doneAt),
    position: r.position,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
