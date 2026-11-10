/**
 * The sync engine (plan §6). Same code on web and Android; only the
 * `LocalDatabase` implementation differs.
 *
 *   write()  — record + outbox entry in one local transaction (§6.4 step 1)
 *   push()   — send pending operations, apply per-operation results (steps 2–4)
 *   pull()   — fetch changes after the cursor, apply, advance cursor (step 5)
 *   sync()   — push then pull
 *
 * Two rules keep offline edits from fighting each other:
 *
 *  - Only the oldest pending operation per record is sent in a round. When it
 *    is accepted, the record's later operations are rebased onto the version
 *    the server returned. Otherwise two edits made offline would both claim the
 *    same base version and the second would conflict with the first.
 *  - A pull never overwrites a record that still has pending operations: the
 *    local copy is newer, and the push decides whether it really conflicts.
 *    Nor one with an open conflict: that waits for resolveConflict().
 *
 * Conflict *resolution* UI is not here: the engine records conflicts and the
 * app shows them (§6.5).
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

/** The states the app shows (plan §6.6). */
export type SyncStatus =
  | { state: "idle"; lastSyncedAt: string | null }
  | { state: "pending"; pending: number }
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

  /**
   * Local write: the UI calls this; it never waits on the network. The version
   * comes from the stored record, not the caller's copy, because a sync may have
   * moved it on since the screen read it.
   */
  async write(entityType: EntityType, record: LocalRecord, op: "upsert" | "delete" = "upsert") {
    const clientTimestamp = this.o.now().toISOString();
    await this.o.db.transaction(async (tx) => {
      const current = await tx.get(entityType, record.id);
      const version = current?.version ?? record.version;
      const stored: LocalRecord = {
        ...record,
        version,
        deletedAt: op === "delete" ? clientTimestamp : record.deletedAt,
      };
      const operation: SyncOperation = {
        operationId: this.o.newId(),
        entityType,
        entityId: record.id,
        op,
        baseVersion: version > 0 ? version : null,
        payload: op === "delete" ? null : stored,
        deviceId: this.o.deviceId,
        clientTimestamp,
      };
      await tx.put(entityType, stored, "pending");
      await tx.enqueue(operation);
    });
  }

  /**
   * Settle a recorded conflict (plan §6.5):
   *  - "mine":   this device's version wins. It's resent on top of the server's
   *              current version, so it applies cleanly instead of conflicting again.
   *  - "theirs": the server's version replaces this device's, and any queued
   *              edits to it are dropped.
   *  - "both":   the server's version stays, and this device's is saved as a new
   *              separate record (titled "… (copy from this device)").
   * Returns the id of the copy for "both". A no-op if the conflict is already gone.
   */
  async resolveConflict(entityType: EntityType, entityId: string, choice: "mine" | "theirs" | "both"): Promise<string | null> {
    const clientTimestamp = this.o.now().toISOString();
    return this.o.db.transaction(async (tx) => {
      const conflict = (await this.o.db.conflicts()).find((c) => c.entityType === entityType && c.entityId === entityId);
      if (!conflict) return null;
      const server = conflict.server;
      // Anything edited since the conflict was found counts as "mine" too.
      const mine = (await tx.get(entityType, entityId)) ?? conflict.local;
      const queued = await tx.pendingFor(entityId);
      await tx.dequeue(queued.map((o) => o.operationId));
      await tx.clearConflict(entityType, entityId);

      const enqueue = async (record: LocalRecord, op: "upsert" | "delete", baseVersion: number | null) => {
        await tx.put(entityType, record, "pending");
        await tx.enqueue({
          operationId: this.o.newId(),
          entityType,
          entityId: record.id,
          op,
          baseVersion,
          payload: op === "delete" ? null : record,
          deviceId: this.o.deviceId,
          clientTimestamp,
        });
      };

      if (choice === "mine") {
        const record: LocalRecord = { ...mine, version: server.version };
        await enqueue(record, mine.deletedAt ? "delete" : "upsert", server.version);
        return null;
      }

      await tx.put(entityType, server, "synced");
      if (choice === "theirs") return null;

      const copyId = this.o.newId();
      const title = typeof mine.title === "string" && mine.title.trim() ? mine.title : "Untitled";
      await enqueue(
        { ...mine, id: copyId, version: 0, deletedAt: null, title: `${title} (copy from this device)`, createdAt: clientTimestamp, updatedAt: clientTimestamp },
        "upsert",
        null,
      );
      return copyId;
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
      const pending = (await this.o.db.pendingOperations(Number.MAX_SAFE_INTEGER)).length;
      this.o.onStatus?.(
        conflicts.length
          ? { state: "needs_attention", reason: "conflict" }
          : pending
            ? { state: "pending", pending }
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
      const queued = await this.o.db.pendingOperations(this.o.batchSize);
      if (!queued.length) return;

      // Oldest operation per record only; the rest wait to be rebased.
      const seen = new Set<string>();
      const batch: SyncOperation[] = [];
      for (const { operation } of queued) {
        if (seen.has(operation.entityId)) continue;
        seen.add(operation.entityId);
        batch.push(operation);
      }

      const { results } = await this.o.transport.push({ operations: batch });
      const byId = new Map(batch.map((op) => [op.operationId, op]));

      const settled = await this.o.db.transaction(async (tx) => {
        let count = 0;
        for (const r of results) {
          const op = byId.get(r.operationId);
          if (!op) continue;
          count++;
          const local = await tx.get(op.entityType, op.entityId);
          const later = (await tx.pendingFor(op.entityId)).filter((o) => o.operationId !== op.operationId);

          if (r.status === "accepted") {
            for (const next of later) await tx.replaceOperation({ ...next, baseVersion: r.version });
            if (local) {
              await tx.put(op.entityType, { ...local, version: r.version }, later.length ? "pending" : "synced");
            }
            await tx.dequeue([op.operationId]);
            continue;
          }

          // Conflict or rejected. The later edits build on this one and can't
          // succeed either; the local record keeps their content, flagged, and
          // the conflict entry holds both sides, so nothing is lost silently.
          await tx.dequeue([op.operationId, ...later.map((o) => o.operationId)]);
          if (!local) continue;
          if (r.status === "conflict") {
            await tx.recordConflict({
              entityType: op.entityType,
              entityId: op.entityId,
              local,
              server: r.serverRecord as LocalRecord,
              detectedAt: this.o.now().toISOString(),
            });
          }
          await tx.put(op.entityType, local, "conflict");
        }
        return count;
      });

      if (settled === 0) throw new Error("The server returned no result for any pushed operation.");
    }
  }

  private async pull() {
    let cursor = await this.o.db.cursor();
    for (;;) {
      const res = await this.o.transport.pull(cursor);
      const conflicts = new Map((await this.o.db.conflicts()).map((c) => [`${c.entityType}:${c.entityId}`, c]));
      await this.o.db.transaction(async (tx) => {
        for (const c of res.changes) {
          if ((await tx.pendingFor(c.entityId)).length) continue;
          // A conflicted record keeps this device's copy until the user decides;
          // only the server side of the conflict moves on.
          const open = conflicts.get(`${c.entityType}:${c.entityId}`);
          if (open) {
            if (c.record) await tx.recordConflict({ ...open, server: c.record as LocalRecord });
            continue;
          }
          const local = await tx.get(c.entityType, c.entityId);
          if (c.op === "delete") {
            const record = (c.record as LocalRecord | null) ?? local;
            if (record) {
              await tx.put(
                c.entityType,
                { ...record, version: c.version, deletedAt: record.deletedAt ?? this.o.now().toISOString() },
                "synced",
              );
            }
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
}

/** Exponential backoff with full jitter (§6.4 step 6). */
export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 5 * 60 * 1000): number {
  const cap = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * cap);
}
