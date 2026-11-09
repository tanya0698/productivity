import { note } from "@productivity/contracts";
import { instant, ownProjectOrNull, versionedHandler } from "../../sync/sync-handler";

const editable = note.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });

export const notesSyncHandler = versionedHandler({
  entityType: "note",
  delegate: (tx) => tx.note as never,
  prepare: ownProjectOrNull,
  toData: (payload) => {
    const n = editable.parse(payload);
    return {
      projectId: n.projectId,
      folderId: n.folderId,
      title: n.title,
      body: n.body,
      bodyText: n.bodyText,
      pinned: n.pinned,
      archivedAt: instant.toDb(n.archivedAt),
    };
  },
  toRecord: (r) => ({
    id: r.id,
    userId: r.userId,
    projectId: r.projectId,
    folderId: r.folderId,
    title: r.title,
    body: r.body,
    bodyText: r.bodyText,
    pinned: r.pinned,
    archivedAt: instant.fromDb(r.archivedAt),
    createdAt: instant.fromDb(r.createdAt),
    updatedAt: instant.fromDb(r.updatedAt),
    deletedAt: instant.fromDb(r.deletedAt),
    version: Number(r.version),
  }),
});
