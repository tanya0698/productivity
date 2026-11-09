import { habit, habitLog } from "@productivity/contracts";
import { RejectOperation, dateOnly, instant, ownGoalOrNull, versionedHandler } from "../../sync/sync-handler";

const omitSync = { id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true } as const;
const editableHabit = habit.omit(omitSync);
const editableLog = habitLog.omit(omitSync);

export const habitsSyncHandler = versionedHandler({
  entityType: "habit",
  delegate: (tx) => tx.habit as never,
  toData: (payload) => {
    const h = editableHabit.parse(payload);
    return {
      goalId: h.goalId,
      title: h.title,
      description: h.description,
      cadence: h.cadence,
      // Stored as an array; empty means every day (null in the contract).
      daysOfWeek: h.cadence === "daily" && h.daysOfWeek ? [...new Set(h.daysOfWeek)].sort((a, b) => a - b) : [],
      targetCount: h.targetCount,
      archivedAt: instant.toDb(h.archivedAt),
    };
  },
  prepare: ownGoalOrNull,
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    goalId: r.goalId,
    title: r.title,
    description: r.description,
    cadence: r.cadence,
    daysOfWeek: Array.isArray(r.daysOfWeek) && r.daysOfWeek.length ? r.daysOfWeek : null,
    targetCount: r.targetCount,
    archivedAt: instant.fromDb(r.archivedAt),
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});

export const habitLogsSyncHandler = versionedHandler({
  entityType: "habit_log",
  delegate: (tx) => tx.habitLog as never,
  toData: (payload) => {
    const l = editableLog.parse(payload);
    return { habitId: l.habitId, date: dateOnly.toDb(l.date), count: l.count };
  },
  // A log needs its habit, and the user's own: otherwise a foreign-key error
  // would fail the whole push.
  prepare: async (tx, userId, data) => {
    const owner = await tx.habit.findFirst({ where: { id: data.habitId as string, userId }, select: { id: true } });
    if (!owner) throw new RejectOperation("habit_not_found");
    return data;
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    habitId: r.habitId,
    date: dateOnly.fromDb(r.date),
    count: r.count,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
