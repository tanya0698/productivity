import type { EntityType, OperationResult, SyncOperation } from "@productivity/contracts";
import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

/**
 * How one entity type takes part in sync. Each feature module registers one
 * for every entity it owns, so `sync/` stays generic (plan §11.6).
 */
export interface SyncHandler {
  readonly entityType: EntityType;
  /** Validate and apply one operation. Ownership and version checks live here. */
  apply(tx: Tx, userId: string, op: SyncOperation): Promise<OperationResult & { version?: number }>;
  /** Load current records (in contract shape) for a pull. */
  load(tx: Tx, userId: string, ids: string[]): Promise<Map<string, Record<string, unknown>>>;
}

export const SYNC_HANDLERS = Symbol("SYNC_HANDLERS");

/** Minimal surface of a Prisma model delegate used by `versionedHandler`. */
interface Delegate {
  findUnique(args: { where: { id: string } }): Promise<Row | null>;
  findMany(args: { where: { id: { in: string[] }; userId: string } }): Promise<Row[]>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Row>;
}
type Row = { id: string; userId: string; version: bigint } & Record<string, unknown>;

/**
 * The standard handler for a versioned record: optimistic concurrency on
 * `version`, tombstone deletes, ownership enforced. Entities with special
 * merge rules (plan §6.5) can wrap or replace it.
 */
export function versionedHandler(opts: {
  entityType: EntityType;
  delegate: (tx: Tx) => Delegate;
  /** Contract payload → Prisma data. Must parse/validate; throw to reject. */
  toData: (payload: Record<string, unknown>) => Record<string, unknown>;
  /** Prisma row → contract record. */
  toRecord: (row: Row) => Record<string, unknown>;
  /**
   * Last look at the data before it's written, with the user known: check
   * references point at the user's own records. Never throw for a bad
   * reference: a database error would fail the whole push and the client
   * would retry it forever.
   */
  prepare?: (tx: Tx, userId: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
}): SyncHandler {
  return {
    entityType: opts.entityType,

    async apply(tx, userId, op) {
      const d = opts.delegate(tx);
      const existing = await d.findUnique({ where: { id: op.entityId } });

      if (existing && existing.userId !== userId) {
        return { operationId: op.operationId, status: "rejected", reason: "not_found" };
      }
      if (existing && op.baseVersion !== Number(existing.version)) {
        return {
          operationId: op.operationId,
          status: "conflict",
          serverVersion: Number(existing.version),
          serverRecord: opts.toRecord(existing),
        };
      }

      if (op.op === "delete") {
        if (!existing) return { operationId: op.operationId, status: "rejected", reason: "not_found" };
        const row = await d.update({
          where: { id: op.entityId },
          data: { deletedAt: new Date(), version: existing.version + 1n },
        });
        return { operationId: op.operationId, status: "accepted", version: Number(row.version) };
      }

      let data: Record<string, unknown>;
      try {
        data = opts.toData(op.payload ?? {});
      } catch (err) {
        return { operationId: op.operationId, status: "rejected", reason: `invalid: ${String(err)}` };
      }
      if (opts.prepare) data = await opts.prepare(tx, userId, data);

      const row = existing
        ? await d.update({ where: { id: op.entityId }, data: { ...data, version: existing.version + 1n } })
        : await d.create({ data: { ...data, id: op.entityId, userId, version: 1n } });
      return { operationId: op.operationId, status: "accepted", version: Number(row.version) };
    },

    async load(tx, userId, ids) {
      const rows = await opts.delegate(tx).findMany({ where: { id: { in: ids }, userId } });
      return new Map(rows.map((r) => [r.id, opts.toRecord(r)]));
    },
  };
}

/**
 * Keeps `projectId` only if it's one of the user's own projects (deleted ones
 * included, so an offline edit can still land). Anything else becomes "no
 * project" instead of a foreign-key error or a link into someone else's data.
 */
export async function ownProjectOrNull(tx: Tx, userId: string, data: Record<string, unknown>) {
  const projectId = data.projectId;
  if (typeof projectId !== "string") return data;
  const project = await tx.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  return project ? data : { ...data, projectId: null };
}

/** Same rule for a reminder's task or note: the user's own, or no link (a standalone reminder). */
export async function ownLinksOrNull(tx: Tx, userId: string, data: Record<string, unknown>) {
  const out = { ...data };
  if (typeof out.taskId === "string" && !(await tx.task.findFirst({ where: { id: out.taskId, userId }, select: { id: true } }))) {
    out.taskId = null;
  }
  if (typeof out.noteId === "string" && !(await tx.note.findFirst({ where: { id: out.noteId, userId }, select: { id: true } }))) {
    out.noteId = null;
  }
  return out;
}

/** `"2026-10-21"` ↔ a Date at UTC midnight, for `@db.Date` columns. */
export const dateOnly = {
  toDb: (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00.000Z`) : null),
  fromDb: (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : null),
};
export const instant = {
  toDb: (v: string | null | undefined) => (v ? new Date(v) : null),
  fromDb: (v: unknown) => (v instanceof Date ? v.toISOString() : null),
};
