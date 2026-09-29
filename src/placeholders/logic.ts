// Pure placeholder logic (no Obsidian imports, unit tested in tests/placeholders.test.ts).
//
//   %% XXX: conferir se o porão tem janela %%
//
// The marker word comes from settings. Parsing itself lives in core/markers.ts;
// this file adds what the placeholders module needs on top: spans for editor
// decorations, insertion, safe removal, navigation and ordering.

import { parsePlaceholders, placeholderRegex, type PlaceholderMarker } from "../core/markers";

/** A placeholder with the exact source text it was parsed from. */
export interface IndexedMarker extends PlaceholderMarker {
  /** the whole `%% XXX: … %%` text as it appears in the file */
  raw: string;
}

/** Parse placeholders and keep their raw text, so later edits can verify it's still there. */
export function scan(text: string, marker: string): IndexedMarker[] {
  if (!marker) return [];
  return parsePlaceholders(text, marker).map((m) => ({ ...m, raw: text.slice(m.from, m.to) }));
}

// ---------------------------------------------------------------------------
// Decoration spans

export interface PlaceholderSpan {
  /** start of the opening `%%` */
  from: number;
  /** end of the closing `%%` */
  to: number;
  /** where the note text starts (== noteTo when there's no note) */
  noteFrom: number;
  noteTo: number;
  note: string;
}

/**
 * Placeholders in `text` (usually one editor line) with the offsets needed to
 * hide the syntax around the note. `offset` is added to every position.
 */
export function placeholderSpans(text: string, marker: string, offset = 0): PlaceholderSpan[] {
  if (!marker || !text.includes("%%")) return [];
  const out: PlaceholderSpan[] = [];
  const re = placeholderRegex(marker);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const whole = m[0];
    const note = m[1] ?? "";
    // The note never has leading/trailing blanks (greedy [ \t]* before, lazy note + [ \t]* after),
    // so it ends where the blanks before the closing %% begin.
    const inner = whole.slice(0, -2).replace(/[ \t]+$/, "");
    const noteTo = m.index + inner.length;
    const noteFrom = noteTo - note.length;
    out.push({ from: offset + m.index, to: offset + m.index + whole.length, noteFrom: offset + noteFrom, noteTo: offset + noteTo, note });
    if (whole.length === 0) re.lastIndex++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insertion

/** Make any text safe as a single-line placeholder note. */
export function sanitizeNote(s: string): string {
  let out = s.replace(/\s+/g, " ");
  while (out.includes("%%")) out = out.replace(/%%/g, "%");
  return out.trim();
}

/** `%% XXX: note %%`, or `%% XXX:  %%` (two spaces, cursor goes between them) with no note. */
export function placeholderText(marker: string, note: string): string {
  return `%% ${marker}: ${note} %%`;
}

export interface InsertPlan {
  /** text to insert at the insertion point */
  text: string;
  /** where the cursor goes, as an offset into `text` */
  cursor: number;
}

const OPENERS = /[([{“‘«‹„‚¿¡—–\-/]/;
const WORDISH = /[\p{L}\p{N}]/u;

/**
 * What to insert for "Insert placeholder".
 * - No selection (or a blank one): an empty placeholder, cursor right after `XXX: `.
 * - With a selection: a placeholder whose note is the selected text, inserted right
 *   after the selection (the selection itself is kept), cursor after the placeholder.
 * `before`/`after` are the characters around the insertion point ("" at a line edge);
 * a space is added so the marker doesn't glue itself to a word.
 */
export function planInsert(marker: string, selection: string, before: string, after: string): InsertPlan {
  const note = sanitizeNote(selection);
  const lead = before !== "" && !/\s/.test(before) && !OPENERS.test(before) ? " " : "";
  const trail = after !== "" && WORDISH.test(after) ? " " : "";
  const body = placeholderText(marker, note);
  const cursor = note
    ? lead.length + body.length
    : lead.length + `%% ${marker}: `.length;
  return { text: lead + body + trail, cursor };
}

// ---------------------------------------------------------------------------
// Finding and removing

export interface Range { from: number; to: number }

/** How many lines away from its recorded line a moved placeholder is still "nearby". */
const NEAR_LINES = 3;

/**
 * Where `m` is in `text` now. First checks the exact raw text at its recorded
 * offset. Otherwise looks for the same raw text elsewhere, anchored on the
 * recorded line (offsets drift when `text` differs slightly from what was indexed,
 * e.g. CRLF on disk vs LF in the editor, or unsaved edits): an occurrence that is
 * the only one on that line, or the only one within a few lines, is taken. Failing
 * that, in `strict` mode only an occurrence that is unique in the whole text is
 * accepted (safe for edits); otherwise the nearest one (fine for navigation).
 * Null when it's gone.
 */
export function locate(
  text: string,
  m: { from: number; to: number; raw: string; line?: number },
  marker: string,
  strict: boolean,
): Range | null {
  if (m.raw && text.slice(m.from, m.to) === m.raw) return { from: m.from, to: m.to };
  const same = scan(text, marker).filter((c) => c.raw === m.raw);
  if (same.length === 0) return null;
  const pick = (c: IndexedMarker): Range => ({ from: c.from, to: c.to });
  const byOffset = (cs: IndexedMarker[]): IndexedMarker => {
    let best = cs[0];
    for (const c of cs) if (Math.abs(c.from - m.from) < Math.abs(best.from - m.from)) best = c;
    return best;
  };
  if (typeof m.line === "number") {
    const line = m.line;
    const onLine = same.filter((c) => c.line === line);
    if (onLine.length === 1) return pick(onLine[0]);
    if (onLine.length > 1) return strict ? null : pick(byOffset(onLine));
    const near = same.filter((c) => Math.abs(c.line - line) <= NEAR_LINES);
    if (near.length === 1) return pick(near[0]);
    if (!strict) {
      const pool = near.length > 0 ? near : same;
      let best = pool[0];
      for (const c of pool) {
        const d = Math.abs(c.line - line) - Math.abs(best.line - line);
        if (d < 0 || (d === 0 && Math.abs(c.from - m.from) < Math.abs(best.from - m.from))) best = c;
      }
      return pick(best);
    }
  }
  if (strict) return same.length === 1 ? pick(same[0]) : null;
  return pick(byOffset(same));
}

const CLOSING_PUNCT = /^[.,;:!?…)\]}”’»›]/;

function lineBounds(text: string, from: number, to: number): { start: number; end: number; contentEnd: number } {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const nl = text.indexOf("\n", to);
  const end = nl === -1 ? text.length : nl;
  const contentEnd = end > start && text[end - 1] === "\r" && nl !== -1 ? end - 1 : end;
  return { start, end, contentEnd };
}

function isBlankLine(text: string, start: number, end: number): boolean {
  return text.slice(start, end).trim() === "";
}

/**
 * The range to delete to remove the placeholder at [from, to) cleanly. Beyond the
 * placeholder itself it only ever removes whitespace: a line holding nothing but the
 * placeholder goes away (without leaving a doubled blank line), and an inline one
 * takes one neighboring run of spaces with it so no double space is left.
 */
export function removalRange(text: string, from: number, to: number): Range {
  const { start, end, contentEnd } = lineBounds(text, from, to);
  const before = text.slice(start, from);
  const after = text.slice(to, contentEnd);
  const beforeBlank = before.trim() === "";
  const afterBlank = after.trim() === "";

  if (beforeBlank && afterBlank) {
    if (end < text.length) {
      // Remove the line and its line break.
      let rTo = end + 1;
      const prevStart = start < 2 ? 0 : text.lastIndexOf("\n", start - 2) + 1;
      const prevBlank = start === 0 || isBlankLine(text, prevStart, start - 1);
      const nextEnd = text.indexOf("\n", rTo);
      const nextLineEnd = nextEnd === -1 ? text.length : nextEnd;
      if (prevBlank && isBlankLine(text, rTo, nextLineEnd)) {
        // "a\n\n%% XXX %%\n\nb" → "a\n\nb", and no leading blank line at the top.
        rTo = nextEnd === -1 ? text.length : nextEnd + 1;
      }
      return { from: start, to: rTo };
    }
    // Last line without a trailing newline: take the preceding line break instead.
    if (start === 0) return { from: 0, to: text.length };
    const brk = start >= 2 && text[start - 2] === "\r" ? start - 2 : start - 1;
    return { from: brk, to: text.length };
  }

  if (beforeBlank) {
    // At the start of the line's content: eat the spaces that followed it.
    const lead = /^[ \t]*/.exec(after)?.[0].length ?? 0;
    return { from, to: to + lead };
  }
  const wsBefore = /[ \t]*$/.exec(before)?.[0].length ?? 0;
  if (afterBlank) {
    // At the end of the line: drop the spaces around it too.
    return { from: from - wsBefore, to: contentEnd };
  }
  const wsAfter = /^[ \t]*/.exec(after)?.[0].length ?? 0;
  if (wsBefore > 0 && (wsAfter > 0 || CLOSING_PUNCT.test(after))) {
    return { from: from - wsBefore, to };
  }
  return { from, to };
}

/**
 * Remove placeholder `m` from `text` if it is verifiably still there (see `locate`,
 * strict). Returns the new text and the removed range, or null to change nothing.
 */
export function resolvePlaceholder(
  text: string,
  m: { from: number; to: number; raw: string; line?: number },
  marker: string,
): { text: string; from: number; to: number } | null {
  const at = locate(text, m, marker, true);
  if (!at) return null;
  // The raw text must still parse as a placeholder with this marker (guards stale data).
  const reparsed = scan(text.slice(at.from, at.to), marker);
  if (reparsed.length !== 1 || reparsed[0].raw !== m.raw) return null;
  const r = removalRange(text, at.from, at.to);
  return { text: text.slice(0, r.from) + text.slice(r.to), from: r.from, to: r.to };
}

// ---------------------------------------------------------------------------
// Navigation

/**
 * Index of the next (dir 1) or previous (dir -1) placeholder relative to `cursor`,
 * wrapping around the note. `starts` must be sorted. -1 when there are none.
 */
export function stepIndex(starts: number[], cursor: number, dir: 1 | -1): number {
  if (starts.length === 0) return -1;
  if (dir === 1) {
    const i = starts.findIndex((s) => s > cursor);
    return i === -1 ? 0 : i;
  }
  for (let i = starts.length - 1; i >= 0; i--) if (starts[i] < cursor) return i;
  return starts.length - 1;
}

// ---------------------------------------------------------------------------
// Files

/** True when `path` is `folder` itself or inside it. An empty folder means the whole vault. */
export function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  return f === "" || path === f || path.startsWith(`${f}/`);
}

/** Markdown files outside every excluded folder get indexed. */
export function isIndexable(path: string, exclude: string[]): boolean {
  return /\.md$/i.test(path) && !exclude.some((f) => f.trim() !== "" && inFolder(path, f));
}

/**
 * Order files for the placeholders view: those in `chapterOrder` first, in that
 * order, then the rest by path (natural sort). Paths not in `paths` are ignored.
 */
export function orderPaths(paths: string[], chapterOrder: string[]): string[] {
  const set = new Set(paths);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of chapterOrder) {
    if (set.has(p) && !seen.has(p)) { out.push(p); seen.add(p); }
  }
  const rest = paths.filter((p) => !seen.has(p));
  rest.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) || (a < b ? -1 : a > b ? 1 : 0));
  for (const p of rest) if (!seen.has(p)) { out.push(p); seen.add(p); }
  return out;
}

/** Display name of a file from its path: basename without `.md`. */
export function displayName(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.md$/i, "");
}

/** Parent folder of a path ("" at the vault root). */
export function parentPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}
