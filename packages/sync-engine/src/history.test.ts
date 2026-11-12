import { describe, expect, it } from "vitest";
import { parseHistory, recordSync, syncHistoryStats, type SyncEvent } from "./history.ts";

const now = new Date("2026-11-12T12:00:00Z");
const ago = (min: number, ok = true, queued = 0): SyncEvent => ({ at: new Date(now.getTime() - min * 60_000).toISOString(), ok, queued });

describe("sync history", () => {
  it("keeps a day, newest last", () => {
    const h = recordSync([ago(25 * 60), ago(30)], ago(0));
    expect(h.map((e) => e.at)).toEqual([ago(30).at, ago(0).at]);
  });

  it("reads back what it wrote, and ignores junk", () => {
    expect(parseHistory(JSON.stringify([ago(5)]))).toEqual([ago(5)]);
    expect(parseHistory("not json")).toEqual([]);
    expect(parseHistory(JSON.stringify([{ at: 1 }]))).toEqual([]);
    expect(parseHistory(null)).toEqual([]);
  });

  it("compares the last hour with the hour before", () => {
    const h = [ago(100, true, 4), ago(70, false, 3), ago(50, true, 2), ago(20, true, 1), ago(5, false, 1)];
    expect(syncHistoryStats(h, now)).toEqual({
      synced: { now: 2, before: 1 },
      successRate: { now: 67, before: 50 },
      queuedHourAgo: 3,
    });
  });

  it("has nothing to compare with on a fresh device", () => {
    expect(syncHistoryStats([], now)).toEqual({ synced: { now: 0, before: 0 }, successRate: { now: null, before: null }, queuedHourAgo: null });
  });
});
