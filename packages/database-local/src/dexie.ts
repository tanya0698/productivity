/**
 * LocalDatabase on IndexedDB, for the web app. Dexie transactions roll back on
 * a throw, and `liveQuery` also fires for writes from other tabs of the PWA.
 */
import { Dexie, liveQuery, type Table } from "dexie";
import type { EntityType, SyncOperation } from "@productivity/contracts";
import type {
  ConflictEntry,
  LocalDatabase,
  LocalRecord,
  LocalTx,
  OutboxEntry,
  RecordSyncState,
} from "./index.ts";

interface RecordRow {
  entity: EntityType;
  id: string;
  record: LocalRecord;
  state: RecordSyncState;
}
interface OutboxRow extends OutboxEntry {
  seq?: number;
  operationId: string;
  entityId: string;
}
interface MetaRow {
  key: string;
  value: string;
}

const CURSOR_KEY = "cursor";

class Schema extends Dexie {
  records!: Table<RecordRow, [EntityType, string]>;
  outbox!: Table<OutboxRow, number>;
  conflicts!: Table<ConflictEntry, [EntityType, string]>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      records: "[entity+id], entity",
      outbox: "++seq, &operationId, entityId",
      conflicts: "[entityType+entityId]",
      meta: "key",
    });
  }
}

export class DexieDatabase implements LocalDatabase {
  private readonly db: Schema;

  constructor(name = "productivity") {
    this.db = new Schema(name);
  }

  transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T> {
    const { records, outbox, conflicts, meta } = this.db;
    return this.db.transaction("rw", [records, outbox, conflicts, meta], () => {
      const tx: LocalTx = {
        get: async (entity, id) => (await records.get([entity, id]))?.record,
        put: async (entity, record, state) => void (await records.put({ entity, id: record.id, record, state })),
        enqueue: async (operation) =>
          void (await outbox.add({
            operation,
            operationId: operation.operationId,
            entityId: operation.entityId,
            attempts: 0,
            lastError: null,
          })),
        dequeue: async (ids) => void (await outbox.where("operationId").anyOf([...ids]).delete()),
        pendingFor: async (entityId) => {
          const rows = await outbox.where("entityId").equals(entityId).sortBy("seq");
          return rows.map((r) => r.operation);
        },
        replaceOperation: async (operation: SyncOperation) =>
          void (await outbox.where("operationId").equals(operation.operationId).modify({ operation })),
        recordConflict: async (c) => void (await conflicts.put(c)),
        setCursor: async (c) => void (await meta.put({ key: CURSOR_KEY, value: String(c) })),
      };
      return fn(tx);
    }) as Promise<T>;
  }

  async get(entity: EntityType, id: string) {
    return (await this.db.records.get([entity, id]))?.record;
  }

  async list(entity: EntityType) {
    const rows = await this.db.records.where("entity").equals(entity).toArray();
    return rows.map((r) => r.record).filter((r) => !r.deletedAt);
  }

  async pendingOperations(limit: number) {
    // IndexedDB's getAll takes a 32-bit count and throws a TypeError above it.
    const rows = await this.db.outbox.orderBy("seq").limit(Math.min(limit, 2 ** 31 - 1)).toArray();
    return rows.map(({ operation, attempts, lastError }) => ({ operation, attempts, lastError }));
  }

  async markAttemptFailed(operationId: string, error: string) {
    await this.db.outbox
      .where("operationId")
      .equals(operationId)
      .modify((row) => {
        row.attempts += 1;
        row.lastError = error;
      });
  }

  conflicts() {
    return this.db.conflicts.toArray();
  }

  async cursor() {
    return Number((await this.db.meta.get(CURSOR_KEY))?.value ?? 0);
  }

  async getMeta(key: string) {
    return (await this.db.meta.get(key))?.value;
  }

  async setMeta(key: string, value: string) {
    await this.db.meta.put({ key, value });
  }

  subscribe(entity: EntityType, listener: () => void) {
    const sub = liveQuery(() => this.db.records.where("entity").equals(entity).toArray()).subscribe({
      next: () => listener(),
      error: (err) => console.error("[local-db] subscription failed", err),
    });
    return () => sub.unsubscribe();
  }

  async close() {
    this.db.close();
  }
}
