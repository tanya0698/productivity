/**
 * LocalDatabase on SQLite, for the Android app. It talks to a small driver
 * rather than expo-sqlite directly, so these same SQL paths run in Node's tests
 * (`nodeSqliteDriver.ts`) and on the phone (`apps/mobile/src/shared/data`).
 */
import type { EntityType, SyncOperation } from "@productivity/contracts";
import type { ConflictEntry, LocalDatabase, LocalRecord, LocalTx, OutboxEntry } from "./index.ts";

export type SqlValue = string | number | null;

export interface SqlRunner {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
}

export interface SqliteDriver extends SqlRunner {
  exec(sql: string): Promise<void>;
  /** Commit if `fn` resolves, roll back if it rejects. One transaction at a time. */
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS records (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    record TEXT NOT NULL,
    state TEXT NOT NULL,
    PRIMARY KEY (entity, id)
  );
  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id TEXT NOT NULL UNIQUE,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_entity ON outbox (entity_id);
  CREATE TABLE IF NOT EXISTS conflicts (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    conflict TEXT NOT NULL,
    PRIMARY KEY (entity, id)
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

const CURSOR_KEY = "cursor";
const SET_META = "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value";

async function readRecord(db: SqlRunner, entity: EntityType, id: string): Promise<LocalRecord | undefined> {
  const rows = await db.all<{ record: string }>("SELECT record FROM records WHERE entity = ? AND id = ?", [entity, id]);
  return rows[0] ? (JSON.parse(rows[0].record) as LocalRecord) : undefined;
}

export class SqliteDatabase implements LocalDatabase {
  private readonly driver: SqliteDriver;
  private readonly listeners = new Map<string, Set<() => void>>();

  private constructor(driver: SqliteDriver) {
    this.driver = driver;
  }

  static async open(driver: SqliteDriver): Promise<SqliteDatabase> {
    await driver.exec(SCHEMA);
    return new SqliteDatabase(driver);
  }

  async transaction<T>(fn: (tx: LocalTx) => Promise<T>): Promise<T> {
    const touched = new Set<string>();
    const result = await this.driver.transaction((db) => {
      const tx: LocalTx = {
        get: (entity, id) => readRecord(db, entity, id),
        put: async (entity, record, state) => {
          await db.run(
            `INSERT INTO records (entity, id, record, state) VALUES (?, ?, ?, ?)
             ON CONFLICT (entity, id) DO UPDATE SET record = excluded.record, state = excluded.state`,
            [entity, record.id, JSON.stringify(record), state],
          );
          touched.add(entity);
        },
        enqueue: (op) =>
          db.run("INSERT INTO outbox (operation_id, entity_id, operation) VALUES (?, ?, ?)", [
            op.operationId,
            op.entityId,
            JSON.stringify(op),
          ]),
        dequeue: async (ids) => {
          for (const id of ids) await db.run("DELETE FROM outbox WHERE operation_id = ?", [id]);
        },
        pendingFor: async (entityId) => {
          const rows = await db.all<{ operation: string }>(
            "SELECT operation FROM outbox WHERE entity_id = ? ORDER BY seq",
            [entityId],
          );
          return rows.map((r) => JSON.parse(r.operation) as SyncOperation);
        },
        replaceOperation: (op) =>
          db.run("UPDATE outbox SET operation = ? WHERE operation_id = ?", [JSON.stringify(op), op.operationId]),
        recordConflict: (c) =>
          db.run(
            `INSERT INTO conflicts (entity, id, conflict) VALUES (?, ?, ?)
             ON CONFLICT (entity, id) DO UPDATE SET conflict = excluded.conflict`,
            [c.entityType, c.entityId, JSON.stringify(c)],
          ),
        clearConflict: (entityType, entityId) =>
          db.run("DELETE FROM conflicts WHERE entity = ? AND id = ?", [entityType, entityId]),
        setCursor: (c) => db.run(SET_META, [CURSOR_KEY, String(c)]),
      };
      return fn(tx);
    });
    // Only after the commit, so a rolled-back write never notifies anyone.
    touched.forEach((e) => this.listeners.get(e)?.forEach((l) => l()));
    return result;
  }

  get(entity: EntityType, id: string) {
    return readRecord(this.driver, entity, id);
  }

  async list(entity: EntityType) {
    const rows = await this.driver.all<{ record: string }>("SELECT record FROM records WHERE entity = ?", [entity]);
    return rows.map((r) => JSON.parse(r.record) as LocalRecord).filter((r) => !r.deletedAt);
  }

  async pendingOperations(limit: number): Promise<OutboxEntry[]> {
    const rows = await this.driver.all<{ operation: string; attempts: number; last_error: string | null }>(
      "SELECT operation, attempts, last_error FROM outbox ORDER BY seq LIMIT ?",
      [limit],
    );
    return rows.map((r) => ({
      operation: JSON.parse(r.operation) as SyncOperation,
      attempts: r.attempts,
      lastError: r.last_error,
    }));
  }

  markAttemptFailed(operationId: string, error: string) {
    return this.driver.run("UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE operation_id = ?", [
      error,
      operationId,
    ]);
  }

  async conflicts() {
    const rows = await this.driver.all<{ conflict: string }>("SELECT conflict FROM conflicts");
    return rows.map((r) => JSON.parse(r.conflict) as ConflictEntry);
  }

  async cursor() {
    return Number((await this.getMeta(CURSOR_KEY)) ?? 0);
  }

  async getMeta(key: string) {
    const rows = await this.driver.all<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
    return rows[0]?.value;
  }

  setMeta(key: string, value: string) {
    return this.driver.run(SET_META, [key, value]);
  }

  subscribe(entity: EntityType, listener: () => void) {
    let set = this.listeners.get(entity);
    if (!set) this.listeners.set(entity, (set = new Set()));
    set.add(listener);
    return () => void set.delete(listener);
  }

  close() {
    return this.driver.close();
  }
}
