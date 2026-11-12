/**
 * A short history of this device's syncs, so the Sync page can compare now
 * with an hour ago (the trend pill on its cards). Kept on the device only, in
 * the local database's meta table: the last 24 hours, at most 500 entries.
 */

export interface SyncEvent {
  /** When the attempt ended (ISO). */
  at: string;
  /** Whether it finished cleanly. */
  ok: boolean;
  /** Changes still waiting to send afterwards. */
  queued: number;
}

export const SYNC_HISTORY_KEY = "sync.history";
const KEEP_MS = 24 * 60 * 60_000;
const MAX = 500;
const HOUR = 60 * 60_000;

/** The history with `event` added, older than a day dropped. */
export function recordSync(history: readonly SyncEvent[], event: SyncEvent): SyncEvent[] {
  const cutoff = new Date(event.at).getTime() - KEEP_MS;
  return [...history.filter((e) => new Date(e.at).getTime() >= cutoff), event].slice(-MAX);
}

export function parseHistory(raw: string | undefined | null): SyncEvent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((e): e is SyncEvent => !!e && typeof e.at === "string" && typeof e.ok === "boolean" && typeof e.queued === "number") : [];
  } catch {
    return [];
  }
}

export interface SyncHistoryStats {
  /** Clean syncs in the last hour, and the hour before. */
  synced: { now: number; before: number };
  /** Share of attempts that succeeded (0–100), last hour vs the hour before; null with no attempts. */
  successRate: { now: number | null; before: number | null };
  /** Changes waiting an hour ago (the last record at or before then); null if none that old. */
  queuedHourAgo: number | null;
}

export function syncHistoryStats(history: readonly SyncEvent[], now: Date): SyncHistoryStats {
  const t = now.getTime();
  const inHour = (e: SyncEvent, from: number, to: number) => {
    const at = new Date(e.at).getTime();
    return at > from && at <= to;
  };
  const last = history.filter((e) => inHour(e, t - HOUR, t));
  const prev = history.filter((e) => inHour(e, t - 2 * HOUR, t - HOUR));
  const rate = (es: SyncEvent[]) => (es.length ? Math.round((es.filter((e) => e.ok).length / es.length) * 100) : null);
  const older = history.filter((e) => new Date(e.at).getTime() <= t - HOUR);
  return {
    synced: { now: last.filter((e) => e.ok).length, before: prev.filter((e) => e.ok).length },
    successRate: { now: rate(last), before: rate(prev) },
    queuedHourAgo: older.length ? older[older.length - 1]!.queued : null,
  };
}
