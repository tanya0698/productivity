import { describe, expect, it } from "vitest";
import { note as noteSchema } from "@productivity/contracts";
import { editNote, newNote, noteDisplayTitle, noteText, sortNotes } from "./notes.ts";

const t0 = new Date("2026-11-05T10:00:00.000Z");
const t1 = new Date("2026-11-05T11:00:00.000Z");
const id = "00000000-0000-4000-8000-000000000001";

describe("notes", () => {
  it("creates a note the server's schema accepts", () => {
    const note = newNote(id, t0, { title: "Groceries", text: "milk" });
    const editable = noteSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true, version: true, deletedAt: true });
    expect(editable.safeParse(note).success).toBe(true);
    expect(note.version).toBe(0);
    expect(note.bodyText).toBe("milk");
  });

  it("keeps the search text in step with the body when edited", () => {
    const edited = editNote(newNote(id, t0, { text: "milk" }), { text: "eggs" }, t1);
    expect(noteText(edited)).toBe("eggs");
    expect(edited.bodyText).toBe("eggs");
    expect(edited.updatedAt).toBe(t1.toISOString());
  });

  it("leaves fields that weren't changed", () => {
    const edited = editNote(newNote(id, t0, { title: "Keep", text: "milk" }), { text: "eggs" }, t1);
    expect(edited.title).toBe("Keep");
    expect(noteText(editNote(edited, { title: "New" }, t1))).toBe("eggs");
  });

  it("sorts pinned first, then newest", () => {
    const a = { pinned: false, updatedAt: "2026-11-05T09:00:00.000Z" };
    const b = { pinned: false, updatedAt: "2026-11-05T10:00:00.000Z" };
    const c = { pinned: true, updatedAt: "2026-11-01T10:00:00.000Z" };
    expect(sortNotes([a, b, c])).toEqual([c, b, a]);
  });

  it("falls back to the first line, then Untitled", () => {
    expect(noteDisplayTitle({ title: "T", bodyText: "x" })).toBe("T");
    expect(noteDisplayTitle({ title: " ", bodyText: "first\nsecond" })).toBe("first");
    expect(noteDisplayTitle({ title: "", bodyText: "" })).toBe("Untitled");
  });
});
