import type { EntityType } from "@productivity/contracts";
import type { LocalDatabase, LocalRecord } from "@productivity/database-local";
import { SyncEngine, TransientSyncError, backoffDelay, type SyncStatus, type SyncTransport } from "./engine.ts";

const SYNCED_ONCE = "syncedOnce";

export interface SyncRuntimeOptions {
  db: LocalDatabase;
  transport: SyncTransport;
  deviceId: string;
  newId: () => string;
  /** Wait after a write before syncing, so a burst of edits goes out together. */
  debounceMs?: number;
  /** Periodic sync while running; catches changes made on other devices. */
  intervalMs?: number;
}

/**
 * Decides *when* to sync (plan §6.4 step 7): on start, shortly after local
 * writes, periodically, on `syncNow()` (the apps call it when the network
 * returns or the app comes to the foreground), and with backoff after a
 * network failure. It also holds the status the UI shows.
 */
export class SyncRuntime {
  readonly db: LocalDatabase;
  private readonly engine: SyncEngine;
  private readonly debounceMs: number;
  private readonly intervalMs: number;
  private readonly newIdFn: () => string;
  private readonly listeners = new Set<() => void>();
  private status: SyncStatus = { state: "idle", lastSyncedAt: null };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private failures = 0;
  private started = false;

  constructor(o: SyncRuntimeOptions) {
    this.db = o.db;
    this.newIdFn = o.newId;
    this.debounceMs = o.debounceMs ?? 800;
    this.intervalMs = o.intervalMs ?? 60_000;
    this.engine = new SyncEngine({
      db: o.db,
      transport: o.transport,
      deviceId: o.deviceId,
      newId: o.newId,
      onStatus: (s) => this.setStatus(s),
    });
    // Remembered per device, so only the very first visit waits for a sync.
    void o.db.getMeta(SYNCED_ONCE).then((v) => {
      if (v && !this.syncedOnce) {
        this.syncedOnce = true;
        this.listeners.forEach((l) => l());
      }
    });
  }

  /**
   * Whether this device has ever finished a sync. Until it has, an empty local
   * database may just mean "not downloaded yet", so screens show a skeleton
   * rather than "nothing here".
   */
  hasSyncedOnce = (): boolean => this.syncedOnce;
  private syncedOnce = false;

  newId(): string {
    return this.newIdFn();
  }

  getStatus = (): SyncStatus => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** When a sync last finished cleanly in this session, whatever the status says now. */
  getLastSyncedAt = (): string | null => this.lastSyncedAt;
  private lastSyncedAt: string | null = null;

  private setStatus(status: SyncStatus) {
    this.status = status;
    if (status.state === "idle" && status.lastSyncedAt) this.lastSyncedAt = status.lastSyncedAt;
    this.listeners.forEach((l) => l());
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.interval = setInterval(() => void this.syncNow(), this.intervalMs);
    void this.syncNow();
  }

  stop() {
    this.started = false;
    if (this.interval) clearInterval(this.interval);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.interval = this.debounceTimer = this.retryTimer = null;
  }

  /** Saves locally straight away; the sync follows in the background. */
  async write(entity: EntityType, record: LocalRecord, op: "upsert" | "delete" = "upsert") {
    await this.engine.write(entity, record, op);
    const pending = (await this.db.pendingOperations(Number.MAX_SAFE_INTEGER)).length;
    if (this.status.state !== "syncing") this.setStatus({ state: "pending", pending });
    if (!this.started) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.scheduleSoon();
  }

  private scheduleSoon() {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow();
    }, this.debounceMs);
  }

  /** Settle a conflict, then sync the result straight away. See SyncEngine.resolveConflict. */
  async resolveConflict(entity: EntityType, id: string, choice: "mine" | "theirs" | "both"): Promise<string | null> {
    const copyId = await this.engine.resolveConflict(entity, id, choice);
    this.setStatus({ state: "pending", pending: (await this.db.pendingOperations(Number.MAX_SAFE_INTEGER)).length });
    void this.syncNow();
    return copyId;
  }

  /** Never rejects: failures become status, and network ones schedule a retry. */
  async syncNow(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    try {
      await this.engine.sync();
      this.failures = 0;
      if (!this.syncedOnce) {
        this.syncedOnce = true;
        await this.db.setMeta(SYNCED_ONCE, new Date().toISOString());
        this.listeners.forEach((l) => l());
      }
      // Edits made while that sync was running still need to go out.
      if (this.started && (await this.db.pendingOperations(1)).length) this.scheduleSoon();
    } catch (err) {
      if (err instanceof TransientSyncError && this.started) {
        this.retryTimer = setTimeout(() => void this.syncNow(), backoffDelay(this.failures++, 2000));
      } else if (!(err instanceof TransientSyncError)) {
        console.error("[sync]", err);
      }
    }
  }
}
