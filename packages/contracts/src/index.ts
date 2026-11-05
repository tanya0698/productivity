/**
 * Shared contracts: the shapes web, mobile, api and worker all agree on.
 *
 * Every syncable record carries the fields in `syncFields` (plan §6.1), and
 * every change travels as a `SyncOperation` (plan §6.4). Validate at every
 * boundary — client before writing to the outbox, server before applying.
 */
import { z } from "zod";

export const syncFields = {
  id: z.uuid(),
  userId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Server-incremented; used only for conflict detection, never as a cursor. */
  version: z.number().int().nonnegative(),
  /** Tombstone. Set instead of deleting so offline devices can't resurrect it. */
  deletedAt: z.iso.datetime().nullable(),
};

// ─── Entities (Phase 2) ──────────────────────────────────────────────────────

export const taskStatus = z.enum(["inbox", "todo", "in_progress", "done", "cancelled"]);
export type TaskStatus = z.infer<typeof taskStatus>;

/** 1 = highest. Shown as icon + label, never colour alone (plan §4.4). */
export const taskPriority = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export type TaskPriority = z.infer<typeof taskPriority>;

export const task = z.object({
  ...syncFields,
  projectId: z.uuid().nullable(),
  parentTaskId: z.uuid().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().nullable(),
  status: taskStatus,
  priority: taskPriority,
  /** Due "on a day" and due "at a time" are different things; at most one is set. */
  dueDate: z.iso.date().nullable(),
  dueAt: z.iso.datetime().nullable(),
  startDate: z.iso.date().nullable(),
  completedAt: z.iso.datetime().nullable(),
  recurrenceRule: z.string().nullable(),
  recurrenceTimezone: z.string().nullable(),
});
export type Task = z.infer<typeof task>;

export const note = z.object({
  ...syncFields,
  projectId: z.uuid().nullable(),
  folderId: z.uuid().nullable(),
  title: z.string().max(500),
  /** Rich-text editor document. */
  body: z.record(z.string(), z.unknown()),
  /** Plain text extracted on save, for search. */
  bodyText: z.string(),
  pinned: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
});
export type Note = z.infer<typeof note>;

export const project = z.object({
  ...syncFields,
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  status: z.enum(["active", "paused", "done", "archived"]),
  startDate: z.iso.date().nullable(),
  dueDate: z.iso.date().nullable(),
});
export type Project = z.infer<typeof project>;

/** Every entity type sync knows about. Modules register theirs here. */
export const entityType = z.enum(["task", "note", "project"]);
export type EntityType = z.infer<typeof entityType>;

// ─── Sync protocol (plan §6.4) ───────────────────────────────────────────────

export const syncOperation = z.object({
  /** Stable client-generated ID; a retried push with the same ID is not re-applied. */
  operationId: z.uuid(),
  entityType,
  entityId: z.uuid(),
  op: z.enum(["upsert", "delete"]),
  /** The version the client based its change on; null for a new record. */
  baseVersion: z.number().int().nonnegative().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  deviceId: z.uuid(),
  clientTimestamp: z.iso.datetime(),
});
export type SyncOperation = z.infer<typeof syncOperation>;

export const pushRequest = z.object({ operations: z.array(syncOperation).max(500) });
export type PushRequest = z.infer<typeof pushRequest>;

export const operationResult = z.discriminatedUnion("status", [
  z.object({ operationId: z.uuid(), status: z.literal("accepted"), version: z.number().int() }),
  z.object({ operationId: z.uuid(), status: z.literal("rejected"), reason: z.string() }),
  z.object({
    operationId: z.uuid(),
    status: z.literal("conflict"),
    serverVersion: z.number().int(),
    serverRecord: z.record(z.string(), z.unknown()),
  }),
]);
export type OperationResult = z.infer<typeof operationResult>;

export const pushResponse = z.object({ results: z.array(operationResult) });
export type PushResponse = z.infer<typeof pushResponse>;

export const pulledChange = z.object({
  changeSeq: z.number().int(),
  entityType,
  entityId: z.uuid(),
  op: z.enum(["upsert", "delete"]),
  version: z.number().int(),
  record: z.record(z.string(), z.unknown()).nullable(),
});
export type PulledChange = z.infer<typeof pulledChange>;

export const pullResponse = z.object({
  changes: z.array(pulledChange),
  /** The `changeSeq` to send as `cursor` next time. */
  cursor: z.number().int(),
  hasMore: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponse>;

// ─── API errors (one shape everywhere) ───────────────────────────────────────

export const apiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiError>;
