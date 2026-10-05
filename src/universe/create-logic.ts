// The pure parts of creating things from the editor (no Obsidian imports): the
// duplicate check, the link text, where a planted thread goes, which thread the
// cursor is on and how the "answered in" field is read.

import { linkTarget, parseThreads, threadComment, type ThreadMarker } from "../core/markers";
import type { Change } from "../core/note-text";
import { foldName } from "../core/names";
import type { Entry } from "./entries";

/** The longest selection the editor menu offers "Create universe entry" for. */
export const MAX_SELECTION_NAME = 60;

/** A selection that can become an entry name: one line, not blank, up to 60 characters (trimmed). */
export function nameFromSelection(selection: string): string | null {
  const s = selection.trim();
  if (s === "" || /[\r\n]/.test(s) || [...s].length > MAX_SELECTION_NAME) return null;
  return s;
}

export interface Duplicate {
  entry: Entry;
  /** "name": the entry's own name; "alias": one of its aliases */
  via: "name" | "alias";
}

/** The entry whose name or alias is `name` (accents and case ignored; a name match wins over an alias), or null. */
export function findDuplicate(entries: Entry[], name: string): Duplicate | null {
  const q = foldName(name.trim());
  if (q === "") return null;
  let alias: Duplicate | null = null;
  for (const entry of entries) {
    if (foldName(entry.name) === q) return { entry, via: "name" };
    if (!alias && entry.aliases.some((a) => foldName(a.trim()) === q)) alias = { entry, via: "alias" };
  }
  return alias;
}

/** `[[Name]]`, or `[[Name|selected]]` when the text in the story reads differently. */
export function linkFor(target: string, selected: string): string {
  const shown = selected.replace(/[[\]|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return shown === "" || shown === target ? `[[${target}]]` : `[[${target}|${shown}]]`;
}

/** The text shown on a link-less run: `\u0001` and `\u0002` fence a fragment to show as code. */
const OPEN = "\u0001";
const CLOSE = "\u0002";

/** Wrap a value so splitFenced() shows it as code. */
export function fence(value: string): string {
  return `${OPEN}${value}${CLOSE}`;
}

export interface Fragment { text: string; code: boolean }

/** Splits a translated sentence built from fence()d values into plain and code fragments. */
export function splitFenced(s: string): Fragment[] {
  const out: Fragment[] = [];
  let rest = s;
  while (rest !== "") {
    const a = rest.indexOf(OPEN);
    if (a < 0) { out.push({ text: rest, code: false }); break; }
    if (a > 0) out.push({ text: rest.slice(0, a), code: false });
    const b = rest.indexOf(CLOSE, a + 1);
    if (b < 0) { out.push({ text: rest.slice(a + 1), code: true }); break; }
    out.push({ text: rest.slice(a + 1, b), code: true });
    rest = rest.slice(b + 1);
  }
  return out;
}

export interface PlantPlan {
  change: Change;
  /** where the cursor goes afterwards (an offset in the new text) */
  cursor: number;
}

const BLOCK_LINE = /^\s*(?:\|.*|([-*_])(?:\s*\1){2,}\s*)$/;

/**
 * Where "Plant a thread" writes its marker: at the cursor (the end of the selection),
 * on the line the writer pointed at, padded with a space where it touches a word. A
 * selection is copied into the marker as its text and is never removed from the prose.
 * With no selection the cursor lands inside the marker, ready for the question.
 * Prose structure is never changed:
 *   - on an empty line it fills the line when the lines around are blank (or the note's
 *     edges); beside text it takes blank lines of its own, so a paragraph break stays one;
 *   - on a scene break or a table row it goes in a paragraph after the line, since an
 *     inline comment there would change what the line is;
 *   - a cursor inside a wikilink goes after the link.
 * Null when a thread written there would not count (frontmatter, code, a multi-line comment).
 */
export function plantThreadPlan(doc: string, from: number, to: number, keyword: string, closedWord: string): PlantPlan | null {
  if (keyword === "") return null;
  const a = Math.max(0, Math.min(from, to, doc.length));
  const b = Math.max(a, Math.min(Math.max(from, to), doc.length));
  const text = doc.slice(a, b).trim();
  const marker = text === "" ? `%% ${keyword}:  %%` : threadComment(keyword, closedWord, text, false);
  const inside = text === "" ? `%% ${keyword}: `.length : marker.length;
  // a selection that ends at the start of a line ends on the line before
  const at = b > a && doc[b - 1] === "\n" ? b - 1 : b;
  const lineStart = doc.lastIndexOf("\n", at - 1) + 1;
  const nl = doc.indexOf("\n", at);
  const lineEnd = nl < 0 ? doc.length : nl;
  const line = doc.slice(lineStart, lineEnd).replace(/\r$/, "");
  const blankAt = (start: number, end: number) => doc.slice(start, end).trim() === "";
  let change: Change;
  let markerAt: number;
  if (a === b && line.trim() === "") {
    const prevBlank = lineStart === 0 || blankAt(doc.lastIndexOf("\n", lineStart - 2) + 1, lineStart);
    const nextEnd = doc.indexOf("\n", lineEnd + 1);
    const nextBlank = lineEnd >= doc.length || blankAt(lineEnd + 1, nextEnd < 0 ? doc.length : nextEnd);
    if (prevBlank && nextBlank) {
      change = { from: lineStart, to: lineEnd, insert: marker };
      markerAt = lineStart;
    } else {
      change = { from: lineStart, to: lineEnd, insert: `\n${marker}\n` };
      markerAt = lineStart + 1;
    }
  } else if (BLOCK_LINE.test(line)) {
    // a table is one block: the paragraph goes after its last row
    let end = lineEnd;
    if (/^\s*\|/.test(line)) {
      for (;;) {
        const e = doc.indexOf("\n", end + 1);
        const stop = e < 0 ? doc.length : e;
        if (end >= doc.length || !/^\s*\|/.test(doc.slice(end + 1, stop))) break;
        end = stop;
      }
    }
    const nextEnd = doc.indexOf("\n", end + 1);
    const more = end < doc.length && !blankAt(end + 1, nextEnd < 0 ? doc.length : nextEnd);
    change = { from: end, to: end, insert: `\n\n${marker}${more ? "\n" : ""}` };
    markerAt = end + 2;
  } else {
    let pos = at;
    const before = doc.slice(lineStart, pos);
    if (before.lastIndexOf("[[") > before.lastIndexOf("]]")) {
      const close = doc.indexOf("]]", pos);
      if (close >= 0 && close < lineEnd) pos = close + 2;
    }
    const pad = pos > lineStart && !/\s/.test(doc[pos - 1]);
    const padAfter = pos < lineEnd && !/\s/.test(doc[pos]);
    change = { from: pos, to: pos, insert: `${pad ? " " : ""}${marker}${padAfter ? " " : ""}` };
    markerAt = pos + (pad ? 1 : 0);
  }
  const next = doc.slice(0, change.from) + change.insert + doc.slice(change.to);
  if (!parseThreads(next, keyword, closedWord).some((t) => t.from === markerAt)) return null;
  return { change, cursor: markerAt + inside };
}

/** The thread on a line (0-based): the one the cursor offset is inside, else the first on the line. */
export function threadAtLine(threads: ThreadMarker[], line: number, offset: number): ThreadMarker | null {
  const here = threads.filter((t) => t.line === line);
  return here.find((t) => offset >= t.from && offset <= t.to) ?? here[0] ?? null;
}

export interface WorkChoice { path: string; title: string }

export type AnswerTarget =
  | { kind: "none" }
  | { kind: "work"; work: WorkChoice }
  /** typed text that matches no known work */
  | { kind: "text"; text: string };

/** What the writer typed as a link target: brackets, alias, heading and block dropped. */
const stripLink = (s: string) => linkTarget(s.trim().replace(/^\[\[|\]\]$/g, ""));
const baseOf = (p: string) => p.slice(p.lastIndexOf("/") + 1).replace(/\.md$/i, "");

/** Reads the "answered in" field: a work by title, file name or path (accents and case ignored), else the text as typed. */
export function resolveAnswer(input: string, works: WorkChoice[]): AnswerTarget {
  const text = stripLink(input);
  if (text === "") return { kind: "none" };
  const q = foldName(text);
  const work = works.find((w) => foldName(w.title) === q || foldName(baseOf(w.path)) === q || foldName(w.path.replace(/\.md$/i, "")) === q);
  return work ? { kind: "work", work } : { kind: "text", text };
}

/** Works whose title contains the query, the ones that start with it first; an empty query keeps all. */
export function suggestWorks(works: WorkChoice[], query: string, limit = 20): WorkChoice[] {
  const q = foldName(query.trim());
  const hits = q === "" ? [...works] : works.filter((w) => foldName(w.title).includes(q));
  hits.sort((x, y) => Number(foldName(y.title).startsWith(q)) - Number(foldName(x.title).startsWith(q)) || x.title.localeCompare(y.title));
  return hits.slice(0, limit);
}
