/**
 * The local database, as one interface (plan §5.1, §6.3).
 *
 * The web app implements it on IndexedDB (Dexie) and the Android app on
 * expo-sqlite. Everything above this line — the sync engine, each module's
 * `data/` hooks — is written once against `LocalDatabase` and never knows which
 * one it is running on.
 *
 * The one hard requirement on an adapter: `transaction` must be atomic across
 * a record write and its outbox entry. If the app is killed between the two,
 * either both happened or neither did (plan §6.4, step 1).
 *
 * Adapters are a Phase 0 spike; `MemoryDatabase` below is the reference
 * behaviour and is what the sync-engine tests run against.
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
  recordConflict(conflict: ConflictEntry): Promise<void>;
  setCursor(cursor: number): Promise<void>;
}

export interface LocalDatabase {
  transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T>;
  list(entity: EntityType): Promise<LocalRecord[]>;
  pendingOperations(limit: number): Promise<OutboxEntry[]>;
  markAttemptFailed(operationId: string, error: string): Promise<void>;
  conflicts(): Promise<ConflictEntry[]>;
  cursor(): Promise<number>;
  /** Notify subscribers (UI hooks) that `entity` changed. Returns an unsubscribe. */
  subscribe(entity: EntityType, listener: () => void): () => void;
}

/**
 * In-memory reference implementation. Not persisted — use it for tests and as
 * the behaviour the Dexie and expo-sqlite adapters must match.
 */
export class MemoryDatabase implements LocalDatabase {
  private records = new Map<string, Map<string, { record: LocalRecord; state: RecordSyncState }>>();
  private outbox: OutboxEntry[] = [];
  private conflictList: ConflictEntry[] = [];
  private pullCursor = 0;
  private listeners = new Map<string, Set<() => void>>();

  private table(entity: EntityType) {
    let t = this.records.get(entity);
    if (!t) this.records.set(entity, (t = new Map()));
    return t;
  }

  async transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T> {
    // Stage every write, then commit all at once, so a throw leaves nothing behind.
    const puts: Array<[EntityType, LocalRecord, RecordSyncState]> = [];
    const enqueued: SyncOperation[] = [];
    const dequeued = new Set<string>();
    const conflicts: ConflictEntry[] = [];
    let cursor: number | undefined;

    const tx: LocalTx = {
      get: async (entity, id) =>
        [...puts].reverse().find(([e, r]) => e === entity && r.id === id)?.[1] ?? this.table(entity).get(id)?.record,
      put: async (entity, record, state) => void puts.push([entity, record, state]),
      enqueue: async (op) => void enqueued.push(op),
      dequeue: async (ids) => ids.forEach((id) => dequeued.add(id)),
      recordConflict: async (c) => void conflicts.push(c),
      setCursor: async (c) => void (cursor = c),
    };

    const result = await fn(tx);

    const touched = new Set<string>();
    for (const [entity, record, state] of puts) {
      this.table(entity).set(record.id, { record, state });
      touched.add(entity);
    }
    this.outbox = this.outbox.filter((e) => !dequeued.has(e.operation.operationId));
    this.outbox.push(...enqueued.map((operation) => ({ operation, attempts: 0, lastError: null })));
    this.conflictList.push(...conflicts);
    if (cursor !== undefined) this.pullCursor = cursor;
    touched.forEach((e) => this.listeners.get(e)?.forEach((l) => l()));
    return result;
  }

  async list(entity: EntityType) {
    return [...this.table(entity).values()].map((v) => v.record).filter((r) => !r.deletedAt);
  }

  async pendingOperations(limit: number) {
    return this.outbox.slice(0, limit);
  }

  async markAttemptFailed(operationId: string, error: string) {
    const entry = this.outbox.find((e) => e.operation.operationId === operationId);
    if (entry) {
      entry.attempts += 1;
      entry.lastError = error;
    }
  }

  async conflicts() {
    return [...this.conflictList];
  }

  async cursor() {
    return this.pullCursor;
  }

  subscribe(entity: EntityType, listener: () => void) {
    let set = this.listeners.get(entity);
    if (!set) this.listeners.set(entity, (set = new Set()));
    set.add(listener);
    return () => void set.delete(listener);
  }
}
