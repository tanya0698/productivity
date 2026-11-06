import { ensureDeviceId } from "@productivity/database-local";
import { DexieDatabase } from "@productivity/database-local/dexie";
import { SyncRuntime, createHttpTransport } from "@productivity/sync-engine";

const newId = () => crypto.randomUUID();

/**
 * Opens the signed-in user's local database and the sync runtime.
 *
 * One IndexedDB database per account, so two people signing in on the same
 * browser never see each other's notes, and signing back in finds your data
 * still on the device. /api is the same origin: the Vite proxy in development,
 * the reverse proxy in production.
 */
export async function openRuntime(userId: string, getAccessToken: () => Promise<string | null>): Promise<SyncRuntime> {
  const db = new DexieDatabase(`productivity-${userId}`);
  const deviceId = await ensureDeviceId(db, newId);
  return new SyncRuntime({
    db,
    transport: createHttpTransport("/api", { getAccessToken }),
    deviceId,
    newId,
  });
}
