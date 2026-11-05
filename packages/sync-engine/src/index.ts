/**
 * The sync engine (plan §6). Same code on web and Android; only the
 * `LocalDatabase` adapter and the `SyncTransport` differ.
 *
 *   write()  — record + outbox entry in one local transaction (§6.4 step 1)
 *   push()   — send pending operations, apply per-operation results (steps 2–4)
 *   pull()   — fetch changes after the cursor, apply, advance cursor (step 5)
 *   sync()   — push then pull, with backoff on transient failure (step 6)
 *
 * Conflict *resolution* UI is not here: the engine records conflicts and the
 * app shows them (§6.5). Per-entity merge rules are a Phase 2 addition.
 */
import type {
  EntityType,
  PullResponse,
  PushRequest,
  PushResponse,
  SyncOperation,
} from "@productivity/contracts";
import type { LocalDatabase, LocalRecord } from "@productivity/database-local";

export interface SyncTransport {
  push(body: PushRequest): Promise<PushResponse>;
  pull(cursor: number): Promise<PullResponse>;
}

export type SyncStatus =
  | { state: "idle"; lastSyncedAt: string | null }
  | { state: "syncing" }
  | { state: "offline"; pending: number }
  | { state: "needs_attention"; reason: "conflict" | "auth" | "error"; detail?: string };

export interface SyncEngineOptions {
  db: LocalDatabase;
  transport: SyncTransport;
  deviceId: string;
  newId: () => string;
  now?: () => Date;
  batchSize?: number;
  onStatus?: (status: SyncStatus) => void;
}

/** Thrown by a transport when the failure is worth retrying (network, 5xx). */
export class TransientSyncError extends Error {}
/** Thrown by a transport when the session is no longer valid. */
export class AuthSyncError extends Error {}

export class SyncEngine {
  private readonly o: Required<Omit<SyncEngineOptions, "onStatus">> & Pick<SyncEngineOptions, "onStatus">;
  private running: Promise<void> | null = null;
  private lastSyncedAt: string | null = null;

  constructor(options: SyncEngineOptions) {
    this.o = { now: () => new Date(), batchSize: 100, ...options };
  }

  /** Local write: the UI calls this; it never waits on the network. */
  async write(entityType: EntityType, record: LocalRecord, op: "upsert" | "delete" = "upsert") {
    const operation: SyncOperation = {
      operationId: this.o.newId(),
      entityType,
      entityId: record.id,
      op,
      baseVersion: record.version > 0 ? record.version : null,
      payload: op === "delete" ? null : record,
      deviceId: this.o.deviceId,
      clientTimestamp: this.o.now().toISOString(),
    };
    const stored = op === "delete" ? { ...record, deletedAt: operation.clientTimestamp } : record;
    await this.o.db.transaction(async (tx) => {
      await tx.put(entityType, stored, "pending");
      await tx.enqueue(operation);
    });
  }

  /** Push then pull. Concurrent calls share one run. */
  sync(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run() {
    this.o.onStatus?.({ state: "syncing" });
    try {
      await this.push();
      await this.pull();
      this.lastSyncedAt = this.o.now().toISOString();
      const conflicts = await this.o.db.conflicts();
      this.o.onStatus?.(
        conflicts.length
          ? { state: "needs_attention", reason: "conflict" }
          : { state: "idle", lastSyncedAt: this.lastSyncedAt },
      );
    } catch (err) {
      if (err instanceof AuthSyncError) {
        this.o.onStatus?.({ state: "needs_attention", reason: "auth" });
      } else if (err instanceof TransientSyncError) {
        const pending = (await this.o.db.pendingOperations(Number.MAX_SAFE_INTEGER)).length;
        this.o.onStatus?.({ state: "offline", pending });
      } else {
        this.o.onStatus?.({ state: "needs_attention", reason: "error", detail: String(err) });
      }
      throw err;
    }
  }

  private async push() {
    for (;;) {
      const batch = await this.o.db.pendingOperations(this.o.batchSize);
      if (!batch.length) return;

      const { results } = await this.o.transport.push({ operations: batch.map((b) => b.operation) });
      const byId = new Map(batch.map((b) => [b.operation.operationId, b.operation]));

      await this.o.db.transaction(async (tx) => {
        const done: string[] = [];
        for (const r of results) {
          const op = byId.get(r.operationId);
          if (!op) continue;
          if (r.status === "accepted") {
            const local = await tx.get(op.entityType, op.entityId);
            if (local) await tx.put(op.entityType, { ...local, version: r.version }, "synced");
            done.push(r.operationId);
          } else if (r.status === "conflict") {
            const local = await tx.get(op.entityType, op.entityId);
            if (local) {
              await tx.recordConflict({
                entityType: op.entityType,
                entityId: op.entityId,
                local,
                server: r.serverRecord as LocalRecord,
                detectedAt: this.o.now().toISOString(),
              });
              await tx.put(op.entityType, local, "conflict");
            }
            done.push(r.operationId);
          } else {
            // Rejected: the server will never accept it as-is. Drop it from the
            // outbox but keep the record, flagged, so nothing is lost silently.
            const local = await tx.get(op.entityType, op.entityId);
            if (local) await tx.put(op.entityType, local, "conflict");
            done.push(r.operationId);
          }
        }
        await tx.dequeue(done);
      });

      if (batch.length < this.o.batchSize) return;
    }
  }

  private async pull() {
    let cursor = await this.o.db.cursor();
    for (;;) {
      const res = await this.o.transport.pull(cursor);
      await this.o.db.transaction(async (tx) => {
        for (const c of res.changes) {
          const local = await tx.get(c.entityType, c.entityId);
          // Don't overwrite an unsynced local edit; push will surface the conflict.
          if (local && local.version < c.version && (await this.hasPending(c.entityId))) continue;
          if (c.op === "delete") {
            if (local) await tx.put(c.entityType, { ...local, deletedAt: local.deletedAt ?? this.o.now().toISOString(), version: c.version }, "synced");
          } else if (c.record) {
            await tx.put(c.entityType, c.record as LocalRecord, "synced");
          }
        }
        // Advance only after every change in the batch applied (§6.4 step 5).
        await tx.setCursor(res.cursor);
      });
      cursor = res.cursor;
      if (!res.hasMore) return;
    }
  }

  private async hasPending(entityId: string) {
    const pending = await this.o.db.pendingOperations(Number.MAX_SAFE_INTEGER);
    return pending.some((p) => p.operation.entityId === entityId);
  }
}

/** Exponential backoff with full jitter (§6.4 step 6). */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 5 * 60 * 1000): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}
