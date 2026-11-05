import { describe, expect, it } from "vitest";
import { MemoryDatabase } from "@productivity/database-local";
import type { PullResponse, PushRequest, PushResponse } from "@productivity/contracts";
import { SyncEngine, TransientSyncError, type SyncTransport } from "./index.ts";

let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

/** A fake server: accepts everything, keeps a change log, serves pulls from it. */
function fakeServer() {
  const log: PullResponse["changes"] = [];
  const seen = new Set<string>();
  let failNext = false;
  const transport: SyncTransport = {
    async push(body: PushRequest): Promise<PushResponse> {
      if (failNext) {
        failNext = false;
        throw new TransientSyncError("offline");
      }
      return {
        results: body.operations.map((op) => {
          if (!seen.has(op.operationId)) {
            seen.add(op.operationId);
            log.push({
              changeSeq: log.length + 1,
              entityType: op.entityType,
              entityId: op.entityId,
              op: op.op,
              version: (op.baseVersion ?? 0) + 1,
              record: op.payload ? { ...op.payload, version: (op.baseVersion ?? 0) + 1 } : null,
            });
          }
          return { operationId: op.operationId, status: "accepted" as const, version: (op.baseVersion ?? 0) + 1 };
        }),
      };
    },
    async pull(cursor: number): Promise<PullResponse> {
      const changes = log.filter((c) => c.changeSeq > cursor);
      return { changes, cursor: changes.at(-1)?.changeSeq ?? cursor, hasMore: false };
    },
  };
  return { transport, log, failOnce: () => (failNext = true) };
}

const note = (id: string) => ({ id, version: 0, deletedAt: null, title: "Groceries", bodyText: "" });

describe("SyncEngine", () => {
  it("writes locally first, then a second device receives it", async () => {
    const server = fakeServer();
    const phone = new MemoryDatabase();
    const laptop = new MemoryDatabase();
    const a = new SyncEngine({ db: phone, transport: server.transport, deviceId: newId(), newId });
    const b = new SyncEngine({ db: laptop, transport: server.transport, deviceId: newId(), newId });

    const id = newId();
    await a.write("note", note(id));
    expect(await phone.list("note")).toHaveLength(1);
    expect(await phone.pendingOperations(10)).toHaveLength(1);

    await a.sync();
    expect(await phone.pendingOperations(10)).toHaveLength(0);

    await b.sync();
    const received = await laptop.list("note");
    expect(received.map((r) => r.id)).toEqual([id]);
    expect(await laptop.cursor()).toBe(1);
  });

  it("keeps queued changes when the network fails, and sends them later", async () => {
    const server = fakeServer();
    const db = new MemoryDatabase();
    const statuses: string[] = [];
    const engine = new SyncEngine({
      db, transport: server.transport, deviceId: newId(), newId,
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
    const db = new MemoryDatabase();
    const engine = new SyncEngine({ db, transport: server.transport, deviceId: newId(), newId });
    await engine.write("note", note(newId()));
    const [entry] = await db.pendingOperations(1);
    await server.transport.push({ operations: [entry!.operation] });
    await engine.sync();
    expect(server.log).toHaveLength(1);
  });
});
