import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { MemoryDatabase, type LocalDatabase, type LocalRecord } from "@productivity/database-local";
import { DexieDatabase } from "@productivity/database-local/dexie";
import { SqliteDatabase } from "@productivity/database-local/sqlite";
import { openNodeSqlite } from "@productivity/database-local/node-sqlite";
import type { PullResponse, PushRequest, PushResponse } from "@productivity/contracts";
import { SyncEngine, TransientSyncError, createHttpTransport, type SyncTransport } from "./index.ts";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/**
 * A fake server with the real one's rules: idempotent operation ids, optimistic
 * versions, a change log, and pulls returning each record's current state.
 */
function fakeServer() {
  const records = new Map<string, Record<string, unknown> & { version: number }>();
  const log: { seq: number; entityType: PullResponse["changes"][number]["entityType"]; entityId: string }[] = [];
  const applied = new Map<string, number>();
  let failNext = false;

  const transport: SyncTransport = {
    async push(body: PushRequest): Promise<PushResponse> {
      if (failNext) {
        failNext = false;
        throw new TransientSyncError("offline");
      }
      return {
        results: body.operations.map((op) => {
          const seen = applied.get(op.operationId);
          if (seen !== undefined) return { operationId: op.operationId, status: "accepted" as const, version: seen };
          const existing = records.get(op.entityId);
          if (existing && op.baseVersion !== existing.version) {
            return {
              operationId: op.operationId,
              status: "conflict" as const,
              serverVersion: existing.version,
              serverRecord: existing,
            };
          }
          const version = (existing?.version ?? 0) + 1;
          records.set(
            op.entityId,
            op.op === "delete"
              ? { ...existing!, version, deletedAt: op.clientTimestamp }
              : { ...op.payload, id: op.entityId, version },
          );
          applied.set(op.operationId, version);
          log.push({ seq: log.length + 1, entityType: op.entityType, entityId: op.entityId });
          return { operationId: op.operationId, status: "accepted" as const, version };
        }),
      };
    },
    async pull(cursor: number): Promise<PullResponse> {
      const newer = log.filter((c) => c.seq > cursor);
      const latest = new Map(newer.map((c) => [c.entityId, c]));
      const changes = [...latest.values()].map((c) => {
        const record = records.get(c.entityId)!;
        return {
          changeSeq: c.seq,
          entityType: c.entityType,
          entityId: c.entityId,
          op: (record.deletedAt ? "delete" : "upsert") as "delete" | "upsert",
          version: record.version,
          record,
        };
      });
      return { changes, cursor: newer.at(-1)?.seq ?? cursor, hasMore: false };
    },
  };
  return { transport, log, records, failOnce: () => (failNext = true) };
}

const note = (id: string, title = "Groceries"): LocalRecord => ({ id, version: 0, deletedAt: null, title, bodyText: "" });

const device = (db: LocalDatabase, transport: SyncTransport) =>
  new SyncEngine({ db, transport, deviceId: newId(), newId });

const openBackends: Array<[string, () => Promise<LocalDatabase>]> = [
  ["memory", async () => new MemoryDatabase()],
  ["IndexedDB", async () => new DexieDatabase(`engine-${++n}`)],
  ["SQLite", async () => SqliteDatabase.open(openNodeSqlite())],
];

describe.each(openBackends)("SyncEngine on %s", (_name, open) => {
  it("writes locally first, then a second device receives it", async () => {
    const server = fakeServer();
    const [phone, laptop] = [await open(), await open()];
    const a = device(phone, server.transport);
    const b = device(laptop, server.transport);

    const id = newId();
    await a.write("note", note(id));
    expect(await phone.list("note")).toHaveLength(1);
    expect(await phone.pendingOperations(10)).toHaveLength(1);

    await a.sync();
    expect(await phone.pendingOperations(10)).toHaveLength(0);

    await b.sync();
    expect((await laptop.list("note")).map((r) => r.id)).toEqual([id]);
    expect(await laptop.cursor()).toBe(1);
  });

  it("keeps queued changes when the network fails, and sends them later", async () => {
    const server = fakeServer();
    const db = await open();
    const statuses: string[] = [];
    const engine = new SyncEngine({
      db,
      transport: server.transport,
      deviceId: newId(),
      newId,
      onStatus: (s) => statuses.push(s.state),
    });

    await engine.write("note", note(newId()));
    server.failOnce();
    await expect(engine.sync()).rejects.toBeInstanceOf(TransientSyncError);
    expect(statuses.at(-1)).toBe("offline");
    expect(await db.pendingOperations(10)).toHaveLength(1);

    await engine.sync();
    expect(await db.pendingOperations(10)).toHaveLength(0);
    expect(server.log).toHaveLength(1);
  });

  it("does not duplicate a change when the same operation is pushed twice", async () => {
    const server = fakeServer();
    const db = await open();
    const engine = device(db, server.transport);
    await engine.write("note", note(newId()));
    const [entry] = await db.pendingOperations(1);
    await server.transport.push({ operations: [entry!.operation] });
    await engine.sync();
    expect(server.log).toHaveLength(1);
  });

  it("several offline edits to one record don't conflict with each other", async () => {
    const server = fakeServer();
    const db = await open();
    const engine = device(db, server.transport);
    const id = newId();

    await engine.write("note", note(id, "first"));
    await engine.write("note", note(id, "second"));
    await engine.write("note", note(id, "third"));
    await engine.sync();

    expect(await db.conflicts()).toHaveLength(0);
    expect(await db.pendingOperations(10)).toHaveLength(0);
    expect(server.records.get(id)).toMatchObject({ title: "third", version: 3 });
    expect((await db.get("note", id))?.version).toBe(3);
  });

  it("an edit made after syncing is based on the synced version, even from a stale copy", async () => {
    const server = fakeServer();
    const db = await open();
    const engine = device(db, server.transport);
    const id = newId();
    const staleCopy = note(id, "first");

    await engine.write("note", staleCopy);
    await engine.sync();
    await engine.write("note", { ...staleCopy, title: "second" });
    await engine.sync();

    expect(await db.conflicts()).toHaveLength(0);
    expect(server.records.get(id)).toMatchObject({ title: "second", version: 2 });
  });

  it("a pull does not overwrite a newer unsynced edit", async () => {
    const server = fakeServer();
    const db = await open();
    const engine = device(db, server.transport);
    const id = newId();

    await engine.write("note", note(id, "first"));
    // Applied on the server, but its response is lost, so it's still queued.
    const [entry] = await db.pendingOperations(1);
    await server.transport.push({ operations: [entry!.operation] });
    await engine.write("note", note(id, "newer"));

    // Pull alone: the server's "first" must not replace the local "newer".
    const pulled = await server.transport.pull(0);
    expect(pulled.changes).toHaveLength(1);
    await engine.sync();
    expect((await db.get("note", id))?.title).toBe("newer");
    expect(server.records.get(id)).toMatchObject({ title: "newer" });
  });

  it("real concurrent edits become a recorded conflict with both sides kept", async () => {
    const server = fakeServer();
    const [phone, laptop] = [await open(), await open()];
    const a = device(phone, server.transport);
    const b = device(laptop, server.transport);
    const id = newId();

    await a.write("note", note(id, "original"));
    await a.sync();
    await b.sync();

    await a.write("note", { ...(await phone.get("note", id))!, title: "from phone" });
    await b.write("note", { ...(await laptop.get("note", id))!, title: "from laptop" });
    await a.sync();
    await b.sync();

    const [conflict] = await laptop.conflicts();
    expect(conflict?.local.title).toBe("from laptop");
    expect(conflict?.server.title).toBe("from phone");
    expect(await laptop.pendingOperations(10)).toHaveLength(0);
    expect(server.records.get(id)).toMatchObject({ title: "from phone" });
  });

  it("a delete reaches the other device and stays deleted", async () => {
    const server = fakeServer();
    const [phone, laptop] = [await open(), await open()];
    const a = device(phone, server.transport);
    const b = device(laptop, server.transport);
    const id = newId();

    await a.write("note", note(id));
    await a.sync();
    await b.sync();
    expect(await laptop.list("note")).toHaveLength(1);

    await a.write("note", (await phone.get("note", id))!, "delete");
    await a.sync();
    await b.sync();
    expect(await laptop.list("note")).toHaveLength(0);
    expect(await phone.list("note")).toHaveLength(0);
  });

  it("a record created and deleted offline syncs cleanly", async () => {
    const server = fakeServer();
    const db = await open();
    const engine = device(db, server.transport);
    const id = newId();

    await engine.write("note", note(id));
    await engine.write("note", (await db.get("note", id))!, "delete");
    await engine.sync();

    expect(await db.conflicts()).toHaveLength(0);
    expect(server.records.get(id)?.deletedAt).toBeTruthy();
  });
});

describe("createHttpTransport", () => {
  const reply = (status: number, body: unknown = {}) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("treats a network failure and a 5xx as retryable", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(createHttpTransport("/api", down).pull(0)).rejects.toBeInstanceOf(TransientSyncError);
    await expect(createHttpTransport("/api", reply(503)).pull(0)).rejects.toBeInstanceOf(TransientSyncError);
  });

  it("treats a 400 as a bug, not something to retry", async () => {
    await expect(createHttpTransport("/api", reply(400)).pull(0)).rejects.not.toBeInstanceOf(TransientSyncError);
  });

  it("rejects a response that doesn't match the contract", async () => {
    await expect(createHttpTransport("/api", reply(200, { nope: 1 })).pull(0)).rejects.toThrow();
  });
});
