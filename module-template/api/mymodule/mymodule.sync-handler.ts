/**
 * Sync handler for this module's entity. `versionedHandler` gives optimistic
 * concurrency, tombstone deletes and ownership checks; replace it only for
 * entities with special merge rules (plan §6.5).
 *
 * Uncomment once the entity exists in contracts and Prisma:
 *
 * import { myItem } from "@productivity/contracts";
 * import { instant, versionedHandler } from "../../sync/sync-handler";
 *
 * const editable = myItem.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });
 *
 * export const myModuleSyncHandler = versionedHandler({
 *   entityType: "my_item",
 *   delegate: (tx) => tx.myItem as never,
 *   toData: (payload) => editable.parse(payload),
 *   toRecord: (r) => ({
 *     ...r,
 *     createdAt: instant.fromDb(r.createdAt),
 *     updatedAt: instant.fromDb(r.updatedAt),
 *     deletedAt: instant.fromDb(r.deletedAt),
 *     version: Number(r.version),
 *   }),
 * });
 */
export {};
