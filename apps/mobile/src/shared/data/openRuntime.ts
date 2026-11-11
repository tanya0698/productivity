import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import { ensureDeviceId } from "@productivity/database-local";
import { SqliteDatabase, type SqliteDriver, type SqlRunner, type SqlValue } from "@productivity/database-local/sqlite";
import { SyncRuntime, createHttpTransport } from "@productivity/sync-engine";

/**
 * Where the API is. 10.0.2.2 is the host machine as seen from the Android
 * emulator. On a real phone, set EXPO_PUBLIC_API_URL in apps/mobile/.env to your
 * computer's LAN address (see .env.example).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:3000/api";

const newId = () => Crypto.randomUUID();

function runnerFor(db: Pick<SQLite.SQLiteDatabase, "runAsync" | "getAllAsync">): SqlRunner {
  return {
    run: async (sql: string, params: SqlValue[] = []) => void (await db.runAsync(sql, params)),
    all: <T>(sql: string, params: SqlValue[] = []) => db.getAllAsync<T>(sql, params),
  };
}

async function openDriver(fileName: string): Promise<SqliteDriver> {
  const db = await SQLite.openDatabaseAsync(fileName);
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  let queue: Promise<unknown> = Promise.resolve();
  return {
    ...runnerFor(db),
    exec: (sql) => db.execAsync(sql),
    transaction<T>(fn: (tx: SqlRunner) => Promise<T>) {
      // One at a time: exclusive transactions on separate connections would otherwise contend.
      const run = queue.then(() => {
        let result!: T;
        return db
          .withExclusiveTransactionAsync(async (txn) => {
            result = await fn(runnerFor(txn));
          })
          .then(() => result);
      });
      queue = run.catch(() => undefined);
      return run;
    },
    close: () => db.closeAsync(),
  };
}

/**
 * Opens the signed-in user's local database and the sync runtime. One SQLite
 * file per account, so a second account on the same phone never sees the
 * first one's notes.
 */
export async function openRuntime(userId: string, getAccessToken: () => Promise<string | null>): Promise<SyncRuntime> {
  const db = await SqliteDatabase.open(await openDriver(`productivity-${userId}.db`));
  const deviceId = await ensureDeviceId(db, newId);
  return new SyncRuntime({ db, transport: createHttpTransport(API_URL, { getAccessToken }), deviceId, newId });
}
