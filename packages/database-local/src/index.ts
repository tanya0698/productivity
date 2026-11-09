/**
 * The local database, as one interface (plan §5.1, §6.3).
 *
 * The web app runs it on IndexedDB (`./dexie`) and the Android app on SQLite
 * (`./sqlite`). Everything above this line — the sync engine, each module's
 * screens — is written once against `LocalDatabase` and never knows which one
 * it is running on. `contract.ts` holds the tests all implementations must pass.
 *
 * The one hard requirement: `transaction` is atomic across a record write and
 * its outbox entry. If the app is killed between the two, either both happened
 * or neither did (plan §6.4, step 1).
 */
import type { EntityType, SyncOperation } from "@productivity/contracts";

export type LocalRecord = { id: string; version: number; deletedAt: string | null } & Record<string, unknown>;

export type RecordSyncState = "synced" | "pending" | "conflict";

export interface OutboxEntry {
  operation: SyncOperation;
  attempts: number;
  lastError: string | null;
}

export interface ConflictEntry {
  entityType: EntityType;
  entityId: string;
  local: LocalRecord;
  server: LocalRecord;
  detectedAt: string;
}

/** Operations available inside one atomic transaction. */
export interface LocalTx {
  get(entity: EntityType, id: string): Promise<LocalRecord | undefined>;
  put(entity: EntityType, record: LocalRecord, state: RecordSyncState): Promise<void>;
  enqueue(operation: SyncOperation): Promise<void>;
  dequeue(operationIds: readonly string[]): Promise<void>;
  /** Pending operations for one record, oldest first. */
  pendingFor(entityId: string): Promise<SyncOperation[]>;
  /** Replace a pending operation in place, keeping its position in the queue. */
  replaceOperation(operation: SyncOperation): Promise<void>;
  /** One conflict per record: a newer one replaces the older. */
  recordConflict(conflict: ConflictEntry): Promise<void>;
  /** Forget a record's conflict once it has been resolved. */
  clearConflict(entityType: EntityType, entityId: string): Promise<void>;
  setCursor(cursor: number): Promise<void>;
}

export interface LocalDatabase {
  transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T>;
  get(entity: EntityType, id: string): Promise<LocalRecord | undefined>;
  /** Live records only: tombstones are kept for sync but never listed. */
  list(entity: EntityType): Promise<LocalRecord[]>;
  /** Pending operations, oldest first. */
  pendingOperations(limit: number): Promise<OutboxEntry[]>;
  markAttemptFailed(operationId: string, error: string): Promise<void>;
  conflicts(): Promise<ConflictEntry[]>;
  cursor(): Promise<number>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  /** Called after `entity` changes. Returns an unsubscribe function. */
  subscribe(entity: EntityType, listener: () => void): () => void;
  close(): Promise<void>;
}

/** This install's stable device id, created on first use. */
export async function ensureDeviceId(db: LocalDatabase, newId: () => string): Promise<string> {
  const existing = await db.getMeta("deviceId");
  if (existing) return existing;
  const id = newId();
  await db.setMeta("deviceId", id);
  return id;
}

interface MemoryState {
  records: Map<string, { entity: EntityType; record: LocalRecord; state: RecordSyncState }>;
  outbox: OutboxEntry[];
  conflicts: Map<string, ConflictEntry>;
  cursor: number;
}

const recordKey = (entity: string, id: string) => `${entity}:${id}`;

/** In-memory implementation, for tests. Nothing survives a restart. */
export class MemoryDatabase implements LocalDatabase {
  private state: MemoryState = { records: new Map(), outbox: [], conflicts: new Map(), cursor: 0 };
  private meta = new Map<string, string>();
  private listeners = new Map<string, Set<() => void>>();
  private queue: Promise<unknown> = Promise.resolve();

  transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T> {
    // One at a time, on a copy that replaces the real state only on success.
    const run = this.queue.then(() => this.runTransaction(fn));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async runTransaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T> {
    const draft: MemoryState = {
      records: new Map(this.state.records),
      outbox: [...this.state.outbox],
      conflicts: new Map(this.state.conflicts),
      cursor: this.state.cursor,
    };
    const touched = new Set<string>();
    const tx: LocalTx = {
      get: async (entity, id) => draft.records.get(recordKey(entity, id))?.record,
      put: async (entity, record, state) => {
        draft.records.set(recordKey(entity, record.id), { entity, record, state });
        touched.add(entity);
      },
      enqueue: async (operation) => void draft.outbox.push({ operation, attempts: 0, lastError: null }),
      dequeue: async (ids) => {
        draft.outbox = draft.outbox.filter((e) => !ids.includes(e.operation.operationId));
      },
      pendingFor: async (entityId) =>
        draft.outbox.filter((e) => e.operation.entityId === entityId).map((e) => e.operation),
      replaceOperation: async (operation) => {
        draft.outbox = draft.outbox.map((e) =>
          e.operation.operationId === operation.operationId ? { ...e, operation } : e,
        );
      },
      recordConflict: async (c) => void draft.conflicts.set(recordKey(c.entityType, c.entityId), c),
      clearConflict: async (entityType, entityId) => void draft.conflicts.delete(recordKey(entityType, entityId)),
      setCursor: async (c) => void (draft.cursor = c),
    };

    const result = await fn(tx);
    this.state = draft;
    touched.forEach((e) => this.listeners.get(e)?.forEach((l) => l()));
    return result;
  }

  async get(entity: EntityType, id: string) {
    return this.state.records.get(recordKey(entity, id))?.record;
  }

  async list(entity: EntityType) {
    return [...this.state.records.values()]
      .filter((v) => v.entity === entity && !v.record.deletedAt)
      .map((v) => v.record);
  }

  async pendingOperations(limit: number) {
    return this.state.outbox.slice(0, limit);
  }

  async markAttemptFailed(operationId: string, error: string) {
    this.state.outbox = this.state.outbox.map((e) =>
      e.operation.operationId === operationId ? { ...e, attempts: e.attempts + 1, lastError: error } : e,
    );
  }

  async conflicts() {
    return [...this.state.conflicts.values()];
  }

  async cursor() {
    return this.state.cursor;
  }

  async getMeta(key: string) {
    return this.meta.get(key);
  }

  async setMeta(key: string, value: string) {
    this.meta.set(key, value);
  }

  subscribe(entity: EntityType, listener: () => void) {
    let set = this.listeners.get(entity);
    if (!set) this.listeners.set(entity, (set = new Set()));
    set.add(listener);
    return () => void set.delete(listener);
  }

  async close() {}
}
