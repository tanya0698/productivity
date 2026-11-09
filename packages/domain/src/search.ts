/**
 * Local search over everything on the device (plan §7: search works offline).
 * Pure: the caller passes the records, so the same ranking runs on web and
 * Android and is unit-tested here.
 *
 * Rules:
 *  - Case- and accent-insensitive ("cafe" finds "Café").
 *  - Every word of the query must appear somewhere in the record (AND), as the
 *    start of a word or inside one ("vo" finds "invoice").
 *  - Title matches outrank body matches; word starts outrank mid-word; the
 *    whole query as a phrase in the title ranks highest.
 *  - Finished things (done tasks, done/archived projects) sink below open ones.
 *  - Ties go to the most recently edited.
 */

export type SearchKind = "task" | "note" | "project";

export interface SearchDoc {
  kind: SearchKind;
  id: string;
  title: string;
  /** Secondary text: task details, note body, project description. */
  body: string;
  updatedAt: string;
  /** Done task, finished or archived project. */
  finished?: boolean;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** Where the words were found in the title, for highlighting: [start, end) pairs. */
  titleRanges: [number, number][];
  /** A short piece of the body around the first match ("" if the body didn't match). */
  snippet: string;
  snippetRanges: [number, number][];
}

/** Lowercase and strip accents, keeping string length so ranges map back onto the original. */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    // Keep one character per original UTF-16 unit, so indices still line up.
    out += base.length === ch.length ? base : base.slice(0, ch.length).padEnd(ch.length, " ");
  }
  return out;
}

export function queryWords(query: string): string[] {
  return [...new Set(fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
}

const isWordStart = (text: string, i: number) => i === 0 || !/[\p{L}\p{N}]/u.test(text[i - 1]!);

/** Every occurrence of `word` in folded `text`, preferring word starts. */
function find(text: string, word: string): { at: number; start: boolean }[] {
  const found: { at: number; start: boolean }[] = [];
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) found.push({ at: i, start: isWordStart(text, i) });
  return found;
}

function merge(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([...r]);
  }
  return out;
}

const SNIPPET = 90;

function snippetAround(body: string, folded: string, words: string[]): Pick<SearchHit, "snippet" | "snippetRanges"> {
  const first = Math.min(...words.map((w) => folded.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(first)) return { snippet: "", snippetRanges: [] };
  let start = Math.max(0, first - 30);
  // Start on a word boundary so the snippet doesn't open mid-word.
  if (start > 0) {
    const space = body.lastIndexOf(" ", start);
    start = space >= 0 && first - space < 45 ? space + 1 : start;
  }
  const end = Math.min(body.length, start + SNIPPET);
  const raw = body.slice(start, end);
  const lead = start > 0 ? "…" : "";
  const tail = end < body.length ? "…" : "";
  // Newlines become spaces; same length, so ranges still line up.
  const snippet = lead + raw.replace(/\s/g, " ") + tail;
  const piece = folded.slice(start, end);
  const ranges: [number, number][] = [];
  for (const w of words) for (const m of find(piece, w)) ranges.push([m.at + lead.length, m.at + lead.length + w.length]);
  return { snippet, snippetRanges: merge(ranges) };
}

/** Rank `docs` against `query`. An empty query returns nothing. */
export function search(docs: readonly SearchDoc[], query: string, limit = 30): SearchHit[] {
  const words = queryWords(query);
  if (!words.length) return [];
  const phrase = fold(query.trim());
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    const title = fold(doc.title);
    const body = fold(doc.body);
    let score = 0;
    const titleRanges: [number, number][] = [];
    let ok = true;

    for (const w of words) {
      const inTitle = find(title, w);
      const inBody = find(body, w);
      if (!inTitle.length && !inBody.length) {
        ok = false;
        break;
      }
      if (inTitle.length) {
        score += inTitle.some((m) => m.start) ? 10 : 4;
        for (const m of inTitle) titleRanges.push([m.at, m.at + w.length]);
      } else {
        score += inBody.some((m) => m.start) ? 3 : 1;
      }
    }
    if (!ok) continue;

    if (title === phrase) score += 20;
    else if (title.startsWith(phrase)) score += 12;
    else if (phrase.length > 2 && title.includes(phrase)) score += 6;
    if (doc.finished) score -= 8;

    hits.push({ doc, score, titleRanges: merge(titleRanges), ...snippetAround(doc.body, body, words) });
  }

  return hits
    .sort((a, b) => b.score - a.score || b.doc.updatedAt.localeCompare(a.doc.updatedAt))
    .slice(0, limit);
}
