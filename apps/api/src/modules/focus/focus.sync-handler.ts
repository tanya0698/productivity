import { focusSession } from "@productivity/contracts";
import { instant, ownLinksOrNull, ownProjectOrNull, versionedHandler } from "../../sync/sync-handler";

const editable = focusSession.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });

export const focusSessionsSyncHandler = versionedHandler({
  entityType: "focus_session",
  delegate: (tx) => tx.focusSession as never,
  toData: (payload) => {
    const s = editable.parse(payload);
    if (s.endedAt < s.startedAt) throw new Error("a session can't end before it starts");
    return {
      taskId: s.taskId,
      projectId: s.projectId,
      kind: s.kind,
      startedAt: instant.toDb(s.startedAt),
      endedAt: instant.toDb(s.endedAt),
      plannedMinutes: s.plannedMinutes,
      durationSeconds: s.durationSeconds,
      completed: s.completed,
    };
  },
  prepare: async (tx, userId, data) => ownLinksOrNull(tx, userId, await ownProjectOrNull(tx, userId, data)),
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    taskId: r.taskId,
    projectId: r.projectId,
    kind: r.kind,
    startedAt: instant.fromDb(r.startedAt),
    endedAt: instant.fromDb(r.endedAt),
    plannedMinutes: r.plannedMinutes,
    durationSeconds: r.durationSeconds,
    completed: r.completed,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
