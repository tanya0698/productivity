/**
 * The plan's Phase 0 check: an item edited offline on one device appears on the
 * other after reconnecting, and vice versa (plan §13).
 *
 * Two simulated devices use the real storage code — IndexedDB (Dexie, on
 * fake-indexeddb) for the browser and SQLite for the phone — and the real sync
 * engine, talking to the real API and database. Needs the API running:
 *
 *   npm run dev:api      (in another terminal)
 *   npm run sync:check
 *
 * Removes every record it creates.
 */
import "fake-indexeddb/auto";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DexieDatabase } from "@productivity/database-local/dexie";
import { SqliteDatabase } from "@productivity/database-local/sqlite";
import { openNodeSqlite } from "@productivity/database-local/node-sqlite";
import type { LocalDatabase } from "@productivity/database-local";
import { SyncEngine, TransientSyncError, createHttpTransport, type SyncTransport } from "@productivity/sync-engine";
import { editNote, newNote, type LocalNote } from "@productivity/domain";

const root = resolve(import.meta.dirname, "..");
process.loadEnvFile(join(root, ".env"));
const API = process.env.API_URL ?? "http://localhost:3000/api";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

/** A device with a network switch. */
function device(db: LocalDatabase) {
  const real = createHttpTransport(API);
  let online = true;
  const transport: SyncTransport = {
    push: (b) => (online ? real.push(b) : Promise.reject(new TransientSyncError("offline"))),
    pull: (c) => (online ? real.pull(c) : Promise.reject(new TransientSyncError("offline"))),
  };
  const engine = new SyncEngine({ db, transport, deviceId: randomUUID(), newId: randomUUID });
  return {
    db,
    engine,
    setOnline: (v: boolean) => void (online = v),
    note: async (id: string) => (await db.get("note", id)) as (LocalNote & { deletedAt: string | null }) | undefined,
  };
}

const sqlitePath = join(mkdtempSync(join(tmpdir(), "pp-phone-")), "phone.db");
const browser = device(new DexieDatabase(`two-devices-${randomUUID()}`));
let phone = device(await SqliteDatabase.open(openNodeSqlite(sqlitePath)));

const created: string[] = [];
const newNoteId = () => {
  const id = randomUUID();
  created.push(id);
  return id;
};

try {
  // Both devices start caught up.
  await browser.engine.sync();
  await phone.engine.sync();

  // ── Offline on the phone → appears in the browser ──
  const fromPhone = newNoteId();
  phone.setOnline(false);
  await phone.engine.write("note", newNote(fromPhone, new Date(), { title: "Written offline", text: "first" }));
  await phone.engine.write("note", editNote((await phone.note(fromPhone))!, { text: "first, then edited" }, new Date()));
  await phone.engine.sync().catch(() => undefined);
  check("phone: note readable while offline", (await phone.note(fromPhone))?.bodyText === "first, then edited");
  check("phone: both edits queued", (await phone.db.pendingOperations(10)).length === 2);

  // Restart the app while still offline: the queue must survive.
  await phone.db.close();
  phone = device(await SqliteDatabase.open(openNodeSqlite(sqlitePath)));
  check("phone: queue survives an app restart", (await phone.db.pendingOperations(10)).length === 2);

  await phone.engine.sync();
  check("phone: queue empty after reconnecting", (await phone.db.pendingOperations(10)).length === 0);
  check("phone: no self-conflict from two offline edits", (await phone.db.conflicts()).length === 0);
  await browser.engine.sync();
  check("browser: receives the phone's note", (await browser.note(fromPhone))?.bodyText === "first, then edited");

  // ── Offline in the browser → appears on the phone ──
  browser.setOnline(false);
  const current = (await browser.note(fromPhone))!;
  await browser.engine.write("note", editNote(current, { title: "Edited in the browser" }, new Date()));
  const fromBrowser = newNoteId();
  await browser.engine.write("note", newNote(fromBrowser, new Date(), { title: "Browser note" }));
  await browser.engine.sync().catch(() => undefined);
  check("browser: edits queued while offline", (await browser.db.pendingOperations(10)).length === 2);
  browser.setOnline(true);
  await browser.engine.sync();
  await phone.engine.sync();
  check("phone: receives the browser's edit", (await phone.note(fromPhone))?.title === "Edited in the browser");
  check("phone: receives the browser's new note", (await phone.note(fromBrowser))?.title === "Browser note");

  // ── Same note edited offline on both → a recorded conflict, nothing lost ──
  phone.setOnline(false);
  browser.setOnline(false);
  await phone.engine.write("note", editNote((await phone.note(fromPhone))!, { text: "phone version" }, new Date()));
  await browser.engine.write("note", editNote((await browser.note(fromPhone))!, { text: "browser version" }, new Date()));
  phone.setOnline(true);
  browser.setOnline(true);
  await phone.engine.sync();
  await browser.engine.sync();
  const [conflict] = await browser.db.conflicts();
  check("browser: conflict recorded", conflict?.entityId === fromPhone);
  check(
    "both sides of the conflict are kept",
    conflict?.local.bodyText === "browser version" && conflict?.server.bodyText === "phone version",
  );

  // ── Delete on one device → gone on the other ──
  await phone.engine.write("note", (await phone.note(fromBrowser))!, "delete");
  await phone.engine.sync();
  await browser.engine.sync();
  check("browser: deleted note is gone", !(await browser.db.list("note")).some((n) => n.id === fromBrowser));
} catch (err) {
  failed++;
  console.log("ERROR", String(err));
} finally {
  // Hard-delete this script's rows, through Prisma, since sync only tombstones.
  const req = createRequire(join(root, "apps", "api", "package.json"));
  const { PrismaClient } = req("@prisma/client");
  const prisma = new PrismaClient();
  const a = await prisma.syncChange.deleteMany({ where: { entityId: { in: created } } });
  const b = await prisma.note.deleteMany({ where: { id: { in: created } } });
  console.log(`cleanup: removed ${a.count} log rows, ${b.count} notes`);
  await prisma.$disconnect();
  await browser.db.close();
  await phone.db.close();
}

console.log(failed ? `RESULT: ${failed} failed` : "RESULT: all passed");
process.exit(failed ? 1 : 0);
