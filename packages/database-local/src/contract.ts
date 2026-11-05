/**
 * The behaviour every LocalDatabase must have. Each implementation runs this
 * same suite, so the browser and the phone can't quietly disagree.
 */
import { describe, expect, it } from "vitest";
import type { SyncOperation } from "@productivity/contracts";
import type { LocalDatabase, LocalRecord } from "./index.ts";

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const record = (over: Partial<LocalRecord> = {}): LocalRecord => ({
  id: id(),
  version: 0,
  deletedAt: null,
  title: "Groceries",
  ...over,
});

const operation = (entityId: string, over: Partial<SyncOperation> = {}): SyncOperation => ({
  operationId: id(),
  entityType: "note",
  entityId,
  op: "upsert",
  baseVersion: null,
  payload: { title: "Groceries" },
  deviceId: "00000000-0000-4000-8000-000000000000",
  clientTimestamp: "2026-11-05T10:00:00.000Z",
  ...over,
});

export interface Harness {
  db: LocalDatabase;
  /** Close and reopen the same storage, as an app restart would. Absent if not persistent. */
  reopen?: () => Promise<LocalDatabase>;
}

export function describeLocalDatabase(name: string, open: () => Promise<Harness>) {
  describe(`LocalDatabase: ${name}`, () => {
    it("commits a record and its outbox entry together", async () => {
      const { db } = await open();
      const r = record();
      await db.transaction(async (tx) => {
        await tx.put("note", r, "pending");
        await tx.enqueue(operation(r.id));
      });
      expect(await db.get("note", r.id)).toEqual(r);
      expect(await db.pendingOperations(10)).toHaveLength(1);
    });

    it("keeps neither when the transaction throws", async () => {
      const { db } = await open();
      const r = record();
      await expect(
        db.transaction(async (tx) => {
          await tx.put("note", r, "pending");
          await tx.enqueue(operation(r.id));
          throw new Error("killed mid-write");
        }),
      ).rejects.toThrow("killed mid-write");
      expect(await db.get("note", r.id)).toBeUndefined();
      expect(await db.pendingOperations(10)).toHaveLength(0);
    });

    it("sees its own writes inside a transaction", async () => {
      const { db } = await open();
      const r = record();
      await db.transaction(async (tx) => {
        await tx.put("note", r, "pending");
        expect(await tx.get("note", r.id)).toEqual(r);
        await tx.enqueue(operation(r.id));
        expect(await tx.pendingFor(r.id)).toHaveLength(1);
      });
    });

    it("returns the queue oldest first, and honours the limit", async () => {
      const { db } = await open();
      const r = record();
      const ops = [operation(r.id), operation(r.id), operation(r.id)];
      await db.transaction(async (tx) => {
        for (const op of ops) await tx.enqueue(op);
      });
      const all = await db.pendingOperations(10);
      expect(all.map((e) => e.operation.operationId)).toEqual(ops.map((o) => o.operationId));
      expect(await db.pendingOperations(2)).toHaveLength(2);
      expect(await db.pendingOperations(Number.MAX_SAFE_INTEGER)).toHaveLength(3);
    });

    it("dequeues and replaces operations, keeping queue order", async () => {
      const { db } = await open();
      const r = record();
      const [a, b, c] = [operation(r.id), operation(r.id), operation(r.id)];
      await db.transaction(async (tx) => {
        await tx.enqueue(a);
        await tx.enqueue(b);
        await tx.enqueue(c);
      });
      await db.transaction(async (tx) => {
        await tx.replaceOperation({ ...b, baseVersion: 7 });
        await tx.dequeue([a.operationId]);
      });
      const left = await db.transaction((tx) => tx.pendingFor(r.id));
      expect(left.map((o) => o.operationId)).toEqual([b.operationId, c.operationId]);
      expect(left[0]!.baseVersion).toBe(7);
    });

    it("only reports pending operations for the record asked about", async () => {
      const { db } = await open();
      const [x, y] = [record(), record()];
      await db.transaction(async (tx) => {
        await tx.enqueue(operation(x.id));
        await tx.enqueue(operation(y.id));
      });
      expect(await db.transaction((tx) => tx.pendingFor(x.id))).toHaveLength(1);
    });

    it("lists live records of one type, hiding tombstones", async () => {
      const { db } = await open();
      const [live, dead, task] = [record(), record({ deletedAt: "2026-11-05T10:00:00.000Z" }), record()];
      await db.transaction(async (tx) => {
        await tx.put("note", live, "synced");
        await tx.put("note", dead, "synced");
        await tx.put("task", task, "synced");
      });
      expect((await db.list("note")).map((r) => r.id)).toEqual([live.id]);
      expect((await db.get("note", dead.id))?.deletedAt).toBeTruthy();
    });

    it("records one conflict per record, the newest winning", async () => {
      const { db } = await open();
      const r = record();
      const conflict = (detectedAt: string) => ({
        entityType: "note" as const,
        entityId: r.id,
        local: r,
        server: { ...r, version: 2 },
        detectedAt,
      });
      await db.transaction((tx) => tx.recordConflict(conflict("2026-11-05T10:00:00.000Z")));
      await db.transaction((tx) => tx.recordConflict(conflict("2026-11-05T11:00:00.000Z")));
      const all = await db.conflicts();
      expect(all).toHaveLength(1);
      expect(all[0]!.detectedAt).toBe("2026-11-05T11:00:00.000Z");
    });

    it("tracks the cursor and metadata", async () => {
      const { db } = await open();
      expect(await db.cursor()).toBe(0);
      await db.transaction((tx) => tx.setCursor(42));
      expect(await db.cursor()).toBe(42);
      expect(await db.getMeta("deviceId")).toBeUndefined();
      await db.setMeta("deviceId", "abc");
      expect(await db.getMeta("deviceId")).toBe("abc");
    });

    it("counts failed attempts on an operation", async () => {
      const { db } = await open();
      const op = operation(record().id);
      await db.transaction((tx) => tx.enqueue(op));
      await db.markAttemptFailed(op.operationId, "boom");
      const [entry] = await db.pendingOperations(1);
      expect(entry).toMatchObject({ attempts: 1, lastError: "boom" });
    });

    it("notifies subscribers of committed writes, until unsubscribed", async () => {
      const { db } = await open();
      let calls = 0;
      const stop = db.subscribe("note", () => calls++);
      // Implementations may fire once on subscribe; only the increase matters.
      await new Promise((r) => setTimeout(r, 30));
      const before = calls;
      await db.transaction((tx) => tx.put("note", record(), "synced"));
      await expect.poll(() => calls, { timeout: 2000 }).toBeGreaterThan(before);
      stop();
      await new Promise((r) => setTimeout(r, 30));
      const after = calls;
      await db.transaction((tx) => tx.put("note", record(), "synced"));
      await new Promise((r) => setTimeout(r, 50));
      expect(calls).toBe(after);
    });

    it("survives an app restart, if persistent", async () => {
      const { db, reopen } = await open();
      if (!reopen) return;
      const r = record();
      await db.transaction(async (tx) => {
        await tx.put("note", r, "pending");
        await tx.enqueue(operation(r.id));
        await tx.setCursor(9);
      });
      await db.setMeta("deviceId", "abc");
      const again = await reopen();
      expect(await again.get("note", r.id)).toEqual(r);
      expect(await again.pendingOperations(10)).toHaveLength(1);
      expect(await again.cursor()).toBe(9);
      expect(await again.getMeta("deviceId")).toBe("abc");
    });
  });
}
