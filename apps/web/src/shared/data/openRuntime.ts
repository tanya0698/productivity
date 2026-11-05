import { ensureDeviceId } from "@productivity/database-local";
import { DexieDatabase } from "@productivity/database-local/dexie";
import { SyncRuntime, createHttpTransport } from "@productivity/sync-engine";

const newId = () => crypto.randomUUID();

/**
 * Opens this browser's local database and the sync runtime. /api is the same
 * origin: the Vite proxy in development, the reverse proxy in production.
 * Stable reference, as SyncProvider requires.
 */
export async function openRuntime(): Promise<SyncRuntime> {
  const db = new DexieDatabase();
  const deviceId = await ensureDeviceId(db, newId);
  return new SyncRuntime({ db, transport: createHttpTransport("/api"), deviceId, newId });
}
