import type { Note } from "@productivity/contracts";

/**
 * A note as stored on a device. `userId` is absent until the server has seen
 * it; the server sets the owner from the signed-in user, never from the client.
 */
export type LocalNote = Omit<Note, "userId"> & { userId?: string };

/** The note's text. A plain-text body for now; the rich-text editor replaces it in Phase 2. */
export const noteText = (note: Pick<LocalNote, "body">): string =>
  typeof note.body.text === "string" ? note.body.text : "";

export function newNote(
  id: string,
  now: Date,
  fields: { title?: string; text?: string; projectId?: string | null } = {},
): LocalNote {
  const text = fields.text ?? "";
  const at = now.toISOString();
  return {
    id,
    createdAt: at,
    updatedAt: at,
    version: 0,
    deletedAt: null,
    projectId: fields.projectId ?? null,
    folderId: null,
    title: fields.title ?? "",
    body: { type: "plain", text },
    bodyText: text,
    pinned: false,
    archivedAt: null,
  };
}

export function editNote(note: LocalNote, changes: { title?: string; text?: string }, now: Date): LocalNote {
  const text = changes.text ?? noteText(note);
  return {
    ...note,
    title: changes.title ?? note.title,
    body: { type: "plain", text },
    bodyText: text,
    updatedAt: now.toISOString(),
  };
}

/** Pinned first, then most recently edited. */
export function sortNotes<T extends Pick<LocalNote, "pinned" | "updatedAt">>(notes: readonly T[]): T[] {
  return [...notes].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

export const noteDisplayTitle = (note: Pick<LocalNote, "title" | "bodyText">): string =>
  note.title.trim() || note.bodyText.trim().split("\n")[0]?.slice(0, 60) || "Untitled";
