// Pure format of the darlings note (no Obsidian imports).
//
// Each cut passage is stored as:
//
//   ### [[03 O porão]] · 2026-09-29
//   %% escrita-darling {"id":"k3j2x","from":"Novels/A Casa/Chapters/03 O porão.md",...} %%
//   <the passage, verbatim>
//   %% /escrita-darling %%
//
// The JSON never contains `%` (escaped as \u0025) or newlines, so it can't close
// the comment early. A passage line that looks like one of the markers is
// escaped with one leading backslash (and unescaped on parse), mbox-style, so
// every passage round-trips exactly.
import { CONTEXT, contextAt, findRestoreOffset } from "../core/anchor";


import { matchLineEndings } from "../core/note-text";

export interface DarlingMeta {
  id: string;
  /** vault path of the note the passage was cut from */
  from: string;
  /** YYYY-MM-DD */
  date: string;
  /** up to CONTEXT chars of text right before the cut */
  before: string;
  /** up to CONTEXT chars of text right after the cut */
  after: string;
  /** whitespace removed right before the passage while tidying (restored with it) */
  pre?: string;
  /** whitespace removed right after the passage while tidying (restored with it) */
  post?: string;
}

export interface DarlingEntry extends DarlingMeta {
  /** the passage, verbatim */
  text: string;
  /** link target from the heading, if any (follows renames, unlike `from`) */
  link: string | null;
  /** offset of the entry's first character (its heading when present) */
  start: number;
  /** offset just past the closing marker (its line break is not included) */
  end: number;
}

export { CONTEXT, findRestoreOffset };

const OPEN_LINE = /^%%[ \t]*escrita-darling[ \t]+(\{.*\})[ \t]*%%[ \t]*$/;
const CLOSE_LINE = /^%%[ \t]*\/escrita-darling[ \t]*%%[ \t]*$/;
const CLOSE = "%% /escrita-darling %%";
/** a passage line that could be mistaken for a marker (possibly already escaped) */
const MARKER_LIKE = /^(\\*)(%%[ \t]*\/?escrita-darling\b)/;
const HEADING = /^###[ \t]+(.*?)[ \t]*$/;

export function escapePassage(text: string): string {
  return text.split("\n").map((l) => l.replace(MARKER_LIKE, "\\$1$2")).join("\n");
}

export function unescapePassage(text: string): string {
  return text.split("\n").map((l) => l.replace(/^\\(\\*%%[ \t]*\/?escrita-darling\b)/, "$1")).join("\n");
}

/** JSON on one line with no `%` (so no `%%`) and no raw line breaks. */
export function encodeMeta(meta: DarlingMeta): string {
  const clean: Record<string, string> = {
    id: meta.id, from: meta.from, date: meta.date, before: meta.before, after: meta.after,
  };
  if (meta.pre) clean.pre = meta.pre;
  if (meta.post) clean.post = meta.post;
  return JSON.stringify(clean)
    .replace(/%/g, "\\u0025")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function decodeMeta(json: string): DarlingMeta | null {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    if (!o || typeof o !== "object" || typeof o.id !== "string" || !o.id) return null;
    const meta: DarlingMeta = {
      id: o.id, from: str(o.from), date: str(o.date), before: str(o.before), after: str(o.after),
    };
    if (str(o.pre)) meta.pre = str(o.pre);
    if (str(o.post)) meta.post = str(o.post);
    return meta;
  } catch {
    return null;
  }
}

/** Base name without folders or `.md`: "Novels/A/03 O porão.md" → "03 O porão". */
export function baseName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/i, "");
}

/**
 * One entry, without surrounding blank lines. `link` is the wiki link target
 * for the heading (defaults to the source's base name).
 */
export function formatEntry(meta: DarlingMeta, text: string, link?: string): string {
  const target = (link ?? baseName(meta.from)).replace(/[[\]|\r\n]/g, " ").trim();
  const heading = target ? `### [[${target}]] · ${meta.date}` : `### ${meta.date}`;
  return `${heading}\n%% escrita-darling ${encodeMeta(meta)} %%\n${escapePassage(text)}\n${CLOSE}`;
}

interface Line { text: string; start: number; end: number }

function splitLines(text: string): Line[] {
  const out: Line[] = [];
  let pos = 0;
  while (pos <= text.length) {
    const nl = text.indexOf("\n", pos);
    const end = nl === -1 ? text.length : nl;
    const raw = text.slice(pos, end);
    // a CR before the LF belongs to the line break, not the content
    out.push({ text: raw.endsWith("\r") ? raw.slice(0, -1) : raw, start: pos, end: raw.endsWith("\r") ? end - 1 : end });
    if (nl === -1) break;
    pos = nl + 1;
  }
  return out;
}

export function parseEntries(text: string): DarlingEntry[] {
  const lines = splitLines(text);
  const out: DarlingEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = OPEN_LINE.exec(lines[i].text);
    if (!m) continue;
    const meta = decodeMeta(m[1]);
    if (!meta) continue;
    let close = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (CLOSE_LINE.test(lines[j].text)) { close = j; break; }
      if (OPEN_LINE.test(lines[j].text)) break; // unterminated entry: skip it
    }
    if (close === -1) continue;

    const bodyStart = i + 1 < lines.length ? lines[i + 1].start : lines[i].end;
    // content ends at the line break just before the closing marker
    let bodyEnd = lines[close].start - 1;
    const crlf = text[lines[i].end] === "\r";
    if (crlf && bodyEnd > 0 && text[bodyEnd - 1] === "\r") bodyEnd--;
    const passage = close === i + 1 ? "" : unescapePassage(text.slice(bodyStart, Math.max(bodyStart, bodyEnd)));

    let start = lines[i].start;
    let link: string | null = null;
    const h = i > 0 ? HEADING.exec(lines[i - 1].text) : null;
    if (h) {
      start = lines[i - 1].start;
      const lm = /\[\[([^\]|#^]+)/.exec(h[1]);
      if (lm) link = lm[1].trim() || null;
    }
    out.push({ ...meta, text: passage, link, start, end: lines[close].end });
    i = close;
  }
  return out;
}

/** Append an entry at the end of the note, separated by one blank line. */
export function appendEntry(note: string, entry: string): string {
  const body = note.replace(/\s+$/, "");
  return body ? `${body}\n\n${entry}\n` : `${entry}\n`;
}

/** Remove the entry with `id` (and the blank lines it leaves). Unchanged if absent. */
export function removeEntry(text: string, id: string): string {
  const e = parseEntries(text).find((x) => x.id === id);
  if (!e) return text;
  const head = text.slice(0, e.start);
  const tail = text.slice(e.end).replace(/^[ \t]*(\r?\n)*/, "");
  if (!tail) {
    const trimmed = head.replace(/\s+$/, "");
    return trimmed ? `${trimmed}${/\r\n/.test(text) ? "\r\n" : "\n"}` : "";
  }
  if (!head.trim()) return tail;
  const nl = /\r\n/.test(text) ? "\r\n" : "\n";
  return `${head.replace(/\s+$/, "")}${nl}${nl}${tail}`;
}

/** A short id not in `taken`. `rand` returns [0, 1). */
export function newId(taken: Set<string>, rand: () => number = Math.random): string {
  for (let len = 5; ; len++) {
    for (let tries = 0; tries < 20; tries++) {
      let s = "";
      for (let k = 0; k < len; k++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(rand() * 36) % 36];
      if (!taken.has(s)) return s;
    }
    if (len > 32) return `${Date.now().toString(36)}${taken.size}`;
  }
}

/** Newest first: by date, then later in the note first. */
export function newestFirst(entries: DarlingEntry[]): DarlingEntry[] {
  return [...entries].sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1));
}

/** First `max` characters of a passage on one line, with an ellipsis when cut. */
export function excerpt(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).replace(/\s+\S*$/, "") || flat.slice(0, max)}…`;
}

// ---------------------------------------------------------------------------
// Cutting

export interface CutPlan {
  /** range actually removed from the document */
  from: number;
  to: number;
  /** extra whitespace removed before/after the selection */
  pre: string;
  post: string;
  before: string;
  after: string;
}

const SPACE = /[ \t]/;
const CLOSING_PUNCT = /[.,;:!?…)\]}»”’]/;

function newlinesBefore(doc: string, at: number): { count: number; len: number } {
  let i = at, count = 0;
  while (i > 0) {
    if (doc[i - 1] === "\n") { count++; i--; if (i > 0 && doc[i - 1] === "\r") i--; }
    else break;
  }
  return { count, len: at - i };
}

function newlinesAfter(doc: string, at: number): { count: number; lens: number[] } {
  let i = at;
  const lens: number[] = [];
  while (i < doc.length) {
    if (doc[i] === "\n") { i++; lens.push(1); }
    else if (doc[i] === "\r" && doc[i + 1] === "\n") { i += 2; lens.push(2); }
    else break;
  }
  return { count: lens.length, lens };
}

/**
 * Decide what to remove for a selection [from, to) so the text left behind
 * reads cleanly: no doubled space, no space before punctuation or at a line
 * edge, no run of blank lines longer than the ones that were there. The
 * whitespace removed is recorded so restoring puts back exactly the original.
 */
export function planCut(doc: string, from: number, to: number): CutPlan {
  if (from > to) [from, to] = [to, from];
  from = Math.max(0, Math.min(from, doc.length));
  to = Math.max(0, Math.min(to, doc.length));
  let pre = "", post = "";
  const L = from > 0 ? doc[from - 1] : "";
  const R = to < doc.length ? doc[to] : "";
  const lineStartL = from === 0 || L === "\n";
  const lineEndR = to === doc.length || R === "\n" || R === "\r";

  if (SPACE.test(L) && SPACE.test(R)) post = R;
  else if (lineStartL && SPACE.test(R) && from !== to) {
    // "Foo bar" cutting "Foo " is fine; cutting "Foo" leaves " bar"
    post = R;
  } else if (SPACE.test(L) && (lineEndR || CLOSING_PUNCT.test(R))) {
    // trailing space, or a space before punctuation
    let i = from;
    while (i > 0 && SPACE.test(doc[i - 1])) i--;
    if (i > 0 && doc[i - 1] !== "\n") pre = doc.slice(i, from);
  }

  if (!pre && !post) {
    const nb = newlinesBefore(doc, from);
    const na = newlinesAfter(doc, to);
    if (na.count > 0 && from === 0) {
      post = doc.slice(to, to + na.lens.reduce((s, n) => s + n, 0));
    } else if (nb.count > 0 && na.count > 0) {
      const keep = Math.max(nb.count, na.count);
      const drop = nb.count + na.count - keep;
      if (drop > 0) post = doc.slice(to, to + na.lens.slice(0, drop).reduce((s, n) => s + n, 0));
    }
  }

  const f = from - pre.length, t = to + post.length;
  return {
    from: f, to: t, pre, post,
    before: contextAt(doc, f).before,
    after: contextAt(doc, t).after,
  };
}

/** The document after applying a cut plan. */
export function applyCut(doc: string, plan: CutPlan): string {
  return doc.slice(0, plan.from) + doc.slice(plan.to);
}

// ---------------------------------------------------------------------------
// Restoring

/**
 * True when the passage already sits at the restore point `at` (for example
 * after the cut was undone in the chapter): starting or ending at `at`, or
 * between its recorded context. Blank passages never count.
 */
export function alreadyRestored(
  source: string,
  e: Pick<DarlingMeta, "before" | "after" | "pre" | "post"> & { text: string },
  at: number,
): boolean {
  if (!e.text.trim()) return false;
  const full = matchLineEndings(restoreText(e), source);
  if (source.startsWith(full, at) || source.slice(0, at).endsWith(full)) return true;
  return (e.before + e.after).length > 0 && source.includes(e.before + full + e.after);
}

// matchLineEndings lives in core/note-text (the note text port); re-exported for existing callers.
export { matchLineEndings };

/** The text to insert when restoring: the passage with the whitespace tidied away around it. */
export function restoreText(e: Pick<DarlingMeta, "pre" | "post"> & { text: string }): string {
  return `${e.pre ?? ""}${e.text}${e.post ?? ""}`;
}

/** Text to append at the end of a note when the passage's context is gone. */
export function appendText(source: string, passage: string): string {
  if (!source.trim()) return passage;
  const sep = source.endsWith("\n\n") ? "" : source.endsWith("\n") ? "\n" : "\n\n";
  return `${sep}${passage}`;
}

/** Path of a darlings note with a `.md` extension. */
export function withMd(path: string): string {
  const p = path.trim().replace(/^\/+|\/+$/g, "");
  return /\.md$/i.test(p) ? p : `${p}.md`;
}
