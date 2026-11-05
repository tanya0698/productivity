import "fake-indexeddb/auto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeLocalDatabase } from "./contract.ts";
import { MemoryDatabase } from "./index.ts";
import { DexieDatabase } from "./dexie.ts";
import { SqliteDatabase } from "./sqlite.ts";
import { openNodeSqlite } from "./nodeSqliteDriver.ts";

let n = 0;

describeLocalDatabase("memory", async () => ({ db: new MemoryDatabase() }));

describeLocalDatabase("IndexedDB (Dexie)", async () => {
  const name = `test-${++n}`;
  const db = new DexieDatabase(name);
  return {
    db,
    reopen: async () => {
      await db.close();
      return new DexieDatabase(name);
    },
  };
});

describeLocalDatabase("SQLite", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "pp-sqlite-")), "test.db");
  const db = await SqliteDatabase.open(openNodeSqlite(path));
  return {
    db,
    reopen: async () => {
      await db.close();
      return SqliteDatabase.open(openNodeSqlite(path));
    },
  };
});
