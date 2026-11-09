import { describe, expect, it } from "vitest";
import { fold, queryWords, search, type SearchDoc } from "./search.ts";

let n = 0;
const doc = (title: string, body = "", over: Partial<SearchDoc> = {}): SearchDoc => ({
  kind: "note",
  id: String(++n),
  title,
  body,
  updatedAt: "2026-11-01T00:00:00.000Z",
  ...over,
});
const titles = (docs: SearchDoc[], q: string) => search(docs, q).map((h) => h.doc.title);

describe("search", () => {
  it("ignores case and accents, keeping positions", () => {
    expect(fold("Café ÉTÉ")).toBe("cafe ete");
    expect(fold("Café").length).toBe("Café".length);
    expect(queryWords("  Send, the INVOICE!  send ")).toEqual(["send", "the", "invoice"]);
  });

  it("returns nothing for an empty query", () => {
    expect(search([doc("Anything")], "   ")).toEqual([]);
  });

  it("needs every word, in the title or the body", () => {
    const docs = [doc("Send invoice", "to Acme"), doc("Send flowers"), doc("Pay invoice")];
    expect(titles(docs, "send invoice")).toEqual(["Send invoice"]);
    expect(titles(docs, "invoice acme")).toEqual(["Send invoice"]);
  });

  it("finds words inside words, but ranks word starts higher", () => {
    const docs = [doc("Novocaine stock"), doc("Volunteer rota")];
    expect(titles(docs, "vo")).toEqual(["Volunteer rota", "Novocaine stock"]);
  });

  it("ranks title over body, and an exact title highest", () => {
    const docs = [doc("Meeting notes", "budget review"), doc("Budget", ""), doc("Budget review for Q4")];
    expect(titles(docs, "budget")).toEqual(["Budget", "Budget review for Q4", "Meeting notes"]);
  });

  it("sinks finished things below open ones", () => {
    const docs = [doc("Book flights", "", { finished: true }), doc("Book dentist")];
    expect(titles(docs, "book")).toEqual(["Book dentist", "Book flights"]);
  });

  it("breaks ties by most recently edited", () => {
    const docs = [doc("Groceries", "", { updatedAt: "2026-10-01T00:00:00.000Z" }), doc("Groceries", "", { id: "new", updatedAt: "2026-11-05T00:00:00.000Z" })];
    expect(search(docs, "groceries")[0]!.doc.id).toBe("new");
  });

  it("gives ranges for highlighting the title", () => {
    const [hit] = search([doc("Send the Invoice")], "invoice send");
    expect(hit!.titleRanges).toEqual([
      [0, 4],
      [9, 16],
    ]);
  });

  it("cuts a snippet around the first body match, with ranges inside it", () => {
    const body = "A long preamble about many unrelated things that go on and on before we finally mention the plumber's number and more after it.";
    const [hit] = search([doc("Contacts", body)], "plumber");
    expect(hit!.snippet.startsWith("…")).toBe(true);
    const [[s, e]] = hit!.snippetRanges as [[number, number]];
    expect(hit!.snippet.slice(s, e)).toBe("plumber");
  });

  it("leaves the snippet empty when only the title matched", () => {
    const [hit] = search([doc("Plumber", "call on Monday")], "plumber");
    expect(hit!.snippet).toBe("");
  });
});
