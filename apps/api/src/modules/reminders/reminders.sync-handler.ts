import { reminderObject } from "@productivity/contracts";
import { instant, ownLinksOrNull, versionedHandler } from "../../sync/sync-handler";

const editable = reminderObject.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });

export const remindersSyncHandler = versionedHandler({
  entityType: "reminder",
  delegate: (tx) => tx.reminder as never,
  toData: (payload) => {
    const r = editable.parse(payload);
    if ([r.taskId, r.noteId, r.eventId].filter(Boolean).length > 1) throw new Error("link one task, note or event at most");
    // Throws RangeError for a zone the runtime doesn't know.
    new Intl.DateTimeFormat("en-US", { timeZone: r.timezone });
    return {
      taskId: r.taskId,
      noteId: r.noteId,
      eventId: r.eventId,
      title: r.title,
      remindAt: instant.toDb(r.remindAt),
      timezone: r.timezone,
      recurrenceRule: r.recurrenceRule,
      status: r.status,
      snoozedUntil: instant.toDb(r.snoozedUntil),
      lastHandledAt: instant.toDb(r.lastHandledAt),
    };
  },
  prepare: ownLinksOrNull,
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    taskId: r.taskId,
    noteId: r.noteId,
    eventId: r.eventId,
    title: r.title,
    remindAt: instant.fromDb(r.remindAt),
    timezone: r.timezone,
    recurrenceRule: r.recurrenceRule,
    status: r.status,
    snoozedUntil: instant.fromDb(r.snoozedUntil),
    lastHandledAt: instant.fromDb(r.lastHandledAt),
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
