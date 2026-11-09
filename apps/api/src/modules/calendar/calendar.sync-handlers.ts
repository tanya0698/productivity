import { calendarEventObject, calendarEventShape, eventExceptionObject } from "@productivity/contracts";
import {
  RejectOperation,
  dateOnly,
  instant,
  ownLinksOrNull,
  ownProjectOrNull,
  versionedHandler,
  wallClock,
} from "../../sync/sync-handler";

const omitSync = { id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true } as const;
const editableEvent = calendarEventObject.omit(omitSync);
const editableException = eventExceptionObject.omit(omitSync);

export const eventsSyncHandler = versionedHandler({
  entityType: "event",
  delegate: (tx) => tx.calendarEvent as never,
  toData: (payload) => {
    const e = editableEvent.parse(payload);
    // Same rule as the database CHECK, so a bad shape is a rejection, not a 500.
    if (!calendarEventShape({ ...e, id: "", userId: "", createdAt: "", updatedAt: "", version: 0, deletedAt: null })) {
      throw new Error("all-day needs startDate < endDate; timed needs local times, a timezone and startsAt < endsAt");
    }
    if (e.timezone) new Intl.DateTimeFormat("en-US", { timeZone: e.timezone }); // RangeError if unknown
    return {
      projectId: e.projectId,
      taskId: e.taskId,
      title: e.title,
      description: e.description,
      allDay: e.allDay,
      localStart: wallClock.toDb(e.localStart),
      localEnd: wallClock.toDb(e.localEnd),
      timezone: e.timezone,
      startsAt: instant.toDb(e.startsAt),
      endsAt: instant.toDb(e.endsAt),
      startDate: dateOnly.toDb(e.startDate),
      endDate: dateOnly.toDb(e.endDate),
      recurrenceRule: e.recurrenceRule,
    };
  },
  prepare: async (tx, userId, data) => ownLinksOrNull(tx, userId, await ownProjectOrNull(tx, userId, data)),
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    projectId: r.projectId,
    taskId: r.taskId,
    title: r.title,
    description: r.description,
    allDay: r.allDay,
    localStart: wallClock.fromDb(r.localStart),
    localEnd: wallClock.fromDb(r.localEnd),
    timezone: r.timezone,
    startsAt: instant.fromDb(r.startsAt),
    endsAt: instant.fromDb(r.endsAt),
    startDate: dateOnly.fromDb(r.startDate),
    endDate: dateOnly.fromDb(r.endDate),
    recurrenceRule: r.recurrenceRule,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});

export const eventExceptionsSyncHandler = versionedHandler({
  entityType: "event_exception",
  delegate: (tx) => tx.calendarEventException as never,
  toData: (payload) => {
    const x = editableException.parse(payload);
    return {
      eventId: x.eventId,
      originalOccurrence: wallClock.toDb(x.originalOccurrence),
      cancelled: x.cancelled,
      overrideLocalStart: wallClock.toDb(x.overrideLocalStart),
      overrideLocalEnd: wallClock.toDb(x.overrideLocalEnd),
      overrideTitle: x.overrideTitle,
    };
  },
  // An exception needs its event (the user's own), and only one per occurrence:
  // two devices changing the same occurrence offline would otherwise hit the
  // unique index and fail the whole push. The second one is rejected instead.
  prepare: async (tx, userId, data, op) => {
    const eventId = data.eventId as string;
    const event = await tx.calendarEvent.findFirst({ where: { id: eventId, userId }, select: { id: true } });
    if (!event) throw new RejectOperation("event_not_found");
    const clash = await tx.calendarEventException.findFirst({
      where: { eventId, originalOccurrence: data.originalOccurrence as Date, id: { not: op.entityId } },
      select: { id: true },
    });
    if (clash) throw new RejectOperation("occurrence_already_changed");
    return data;
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    eventId: r.eventId,
    originalOccurrence: wallClock.fromDb(r.originalOccurrence),
    cancelled: r.cancelled,
    overrideLocalStart: wallClock.fromDb(r.overrideLocalStart),
    overrideLocalEnd: wallClock.fromDb(r.overrideLocalEnd),
    overrideTitle: r.overrideTitle,
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
