/**
 * SqliteDriver on Node's built-in SQLite. For tests and dev scripts only: it
 * lets the SQL the phone runs be exercised on a real SQLite engine in Node.
 */
import { createRequire } from "node:module";
import type { SqliteDriver, SqlRunner, SqlValue } from "./sqlite.ts";

// Through require, because Vite's resolver doesn't know the node:sqlite builtin.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

export function openNodeSqlite(path = ":memory:"): SqliteDriver {
  const db = new DatabaseSync(path);
  const runner: SqlRunner = {
    run: async (sql, params: SqlValue[] = []) => void db.prepare(sql).run(...params),
    all: async <T>(sql: string, params: SqlValue[] = []) => db.prepare(sql).all(...params) as T[],
  };
  let queue: Promise<unknown> = Promise.resolve();

  return {
    ...runner,
    exec: async (sql) => db.exec(sql),
    transaction<T>(fn: (tx: SqlRunner) => Promise<T>) {
      const run = queue.then(async () => {
        db.exec("BEGIN");
        try {
          const result = await fn(runner);
          db.exec("COMMIT");
          return result;
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
    close: async () => db.close(),
  };
}
