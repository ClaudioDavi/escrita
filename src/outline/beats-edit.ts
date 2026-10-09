// Pure edits of the beats inside a chapter's text (no Obsidian imports).
//
// A chapter's body is a sequence of scenes. Each scene may start with a beat
// comment (`%% beat: … %%`) and scenes are separated by scene breaks (`---`)
// with blank lines around them. These functions only ever add or remove beat
// lines, scene breaks and blank lines: prose and other comments are never
// touched. Each line keeps its own ending (LF or CRLF, even mixed) and a
// missing final newline stays missing.

import { beatLine, isSceneBreakLine, parseBeats } from "../core/markers";
import { segment, type Markdown } from "../core/markdown";

interface Doc {
  lines: string[];
  /** the line break after each line ("" after a last line without one) */
  eols: string[];
  /** fallback line break for new lines: CRLF when the text has any */
  eol: string;
  /** the text ended with a line break */
  trailingEol: boolean;
  body: number;
  /** the text's segmentation: code, comments and frontmatter are known to it */
  md: Markdown;
}

function split(text: string): Doc {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const parts = text.split(/(\r?\n)/);
  const lines: string[] = [], eols: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    lines.push(parts[i]);
    eols.push(parts[i + 1] ?? "");
  }
  const trailingEol = lines.length > 1 && lines[lines.length - 1] === "";
  if (trailingEol) { lines.pop(); eols.pop(); }
  const md = segment(text);
  return { lines, eols, eol, trailingEol, body: md.bodyLine, md };
}

/**
 * Rebuild the text from edited lines. Lines outside the changed stretch keep
 * their own line breaks (a file with mixed LF/CRLF only changes where it was
 * edited); changed lines keep the break of the line they replace and new lines
 * take the break of the line next to them.
 */
function join(doc: Doc, lines: string[]): string {
  if (!lines.length) return "";
  const old = doc.lines;
  let p = 0;
  while (p < lines.length && p < old.length && lines[p] === old[p]) p++;
  let q = 0;
  while (q < lines.length - p && q < old.length - p && lines[lines.length - 1 - q] === old[old.length - 1 - q]) q++;
  const near = doc.eols[p - 1] || doc.eols[p] || doc.eol;
  const eols = lines.map((_, i) => {
    if (i < p) return doc.eols[i];
    if (i >= lines.length - q) return doc.eols[old.length - (lines.length - i)];
    // a changed line takes the break of the line it replaced, an added one its neighbour's
    return i < old.length - q ? doc.eols[i] || near : near;
  });
  const last = lines.length - 1;
  for (let i = 0; i < last; i++) if (!eols[i]) eols[i] = near;
  eols[last] = doc.trailingEol ? eols[last] || doc.eols[old.length - 1] || near : "";
  return lines.map((l, i) => l + eols[i]).join("");
}

/**
 * Beat text as it will be stored: runs of `%` collapse to one so the text
 * can't close the comment early or open a new one (`Grow %%%`).
 */
export function cleanBeatText(s: string): string {
  return s.replace(/%{2,}/g, "%");
}

const blank = (s: string | undefined) => s !== undefined && s.trim() === "";
const isBreak = (doc: Doc, k: number) => isSceneBreakLine(doc.md, k);

/**
 * Insert a new beat at the end of beat `afterIndex`'s scene (-1 = before the
 * first beat, after any text that precedes it). The new beat gets a scene
 * break before it when there is content before it, and one after it when a
 * beat follows and no break was there already.
 */
export function insertBeat(text: string, afterIndex: number, beatText: string): string {
  const doc = split(text);
  const { lines } = doc;
  const beats = parseBeats(doc.md);
  const after = Math.max(-1, Math.min(Math.floor(afterIndex), beats.length - 1));
  const start = after < 0 ? doc.body : beats[after].line;
  const next = after + 1 < beats.length ? beats[after + 1].line : -1;
  const end = next >= 0 ? next : lines.length;

  // Walk back over the blank lines and the scene break that close this scene.
  let k = end - 1;
  while (k >= start && blank(lines[k])) k--;
  let closingBreak = -1;
  if (k >= start && isBreak(doc, k) && !(after >= 0 && k === start)) {
    closingBreak = k;
    k--;
    while (k >= start && blank(lines[k])) k--;
  }
  const contentBefore = k >= start;
  const beat = beatLine(cleanBeatText(beatText));

  if (next < 0) {
    // Last scene: reuse a trailing scene break instead of adding another.
    if (closingBreak >= 0) {
      return join(doc, [...lines.slice(0, closingBreak + 1), "", beat]);
    }
    const head = lines.slice(0, k + 1);
    return join(doc, contentBefore ? [...head, "", "---", "", beat] : [...head, beat]);
  }

  const head = lines.slice(0, k + 1);
  const tail = lines.slice(k + 1);
  const block = contentBefore ? ["", "---", "", beat] : [beat];
  if (closingBreak < 0) block.push("", "---", "");
  else if (!blank(tail[0])) block.push("");
  // Drop the blank lines that separated the scene from what follows; the block brings its own.
  let t = 0;
  if (closingBreak < 0) while (t < tail.length && blank(tail[t])) t++;
  return join(doc, [...head, ...block, ...tail.slice(t)]);
}

/** Replace beat `i`'s text. Returns the text unchanged when there is no such beat. */
export function setBeatText(text: string, i: number, beatText: string): string {
  const doc = split(text);
  const beats = parseBeats(doc.md);
  const b = beats[i];
  if (!b) return text;
  const indent = /^[ \t]*/.exec(doc.lines[b.line])?.[0] ?? "";
  const lines = doc.lines.slice();
  lines[b.line] = indent + beatLine(cleanBeatText(beatText));
  return join(doc, lines);
}

/**
 * Remove beat `i`'s comment line. When the beat was unwritten, a scene break
 * left with nothing to separate is removed too. Prose and other comments are
 * never removed; blank lines around the removed lines collapse to one.
 */
export function removeBeat(text: string, i: number): string {
  const doc = split(text);
  const { lines } = doc;
  const beats = parseBeats(doc.md);
  const b = beats[i];
  if (!b) return text;

  let from = b.line, to = b.line;
  if (!b.written) {
    let a = b.line - 1;
    while (a >= doc.body && blank(lines[a])) a--;
    let z = b.line + 1;
    while (z < lines.length && blank(lines[z])) z++;
    const breakBefore = a >= doc.body && isBreak(doc, a);
    const breakAfter = z < lines.length && isBreak(doc, z);
    let c = a - 1;
    while (c >= doc.body && blank(lines[c])) c--;
    const contentBeforeBreak = breakBefore && c >= doc.body;
    const nothingBefore = a < doc.body;
    if (breakBefore && (breakAfter || z >= lines.length || !contentBeforeBreak)) {
      from = a; // the break before the beat is left with nothing on one side
    } else if (breakAfter && nothingBefore) {
      to = z; // first scene: the break after it would open the chapter
    }
  }

  // Extend over adjacent blank lines, then put back one when both sides have content.
  let lo = from, hi = to;
  while (lo - 1 >= doc.body && blank(lines[lo - 1])) lo--;
  while (hi + 1 < lines.length && blank(lines[hi + 1])) hi++;
  const hadBlanks = lo < from || hi > to;
  const before = lines.slice(0, lo);
  const after = lines.slice(hi + 1);
  const joinBlank = hadBlanks && lo > doc.body && after.length > 0 ? [""] : [];
  return join(doc, [...before, ...joinBlank, ...after]);
}

/**
 * Shift+Tab on a beat: take an unwritten beat out of the chapter so it can
 * become a chapter of its own. Returns null for written beats (their prose
 * would be left behind) or a missing index.
 */
export function moveBeatOut(text: string, i: number): { text: string; beatText: string } | null {
  const b = parseBeats(text)[i];
  if (!b || b.written) return null;
  return { text: removeBeat(text, i), beatText: b.text };
}

/** Add a beat after the last one (or at the end of an empty chapter). */
export function appendBeat(text: string, beatText: string): string {
  return insertBeat(text, parseBeats(text).length - 1, beatText);
}

/** True when the body (after frontmatter) holds nothing but blank lines. */
export function isBlankBody(text: string): boolean {
  const lines = text.split(/\r?\n/);
  return lines.slice(segment(text).bodyLine).every((l) => l.trim() === "");
}

/** Index of the beat whose scene contains 0-based `line` (-1 when before the first beat). */
export function beatAtLine(text: string, line: number): number {
  const beats = parseBeats(text);
  let idx = -1;
  for (let i = 0; i < beats.length; i++) if (beats[i].line <= line) idx = i;
  return idx;
}

// minimalChange lives in core/note-text (the note text port); re-exported for existing callers.
export { minimalChange } from "../core/note-text";

/**
 * The first beat of a note that has none: at the top of the body, after the
 * frontmatter, leading blank lines and a leading title heading (`# …`), so it
 * opens the first scene and any prose already there becomes that beat's
 * scene. A note that already has beats gets the beat before its first one.
 */
export function insertFirstBeat(text: string, beatText: string): string {
  const doc = split(text);
  const { lines } = doc;
  if (parseBeats(doc.md).length) return insertBeat(text, -1, beatText);
  let k = doc.body;
  while (k < lines.length && blank(lines[k])) k++;
  if (k < lines.length && /^#[ \t]+\S/.test(lines[k])) {
    k++;
    while (k < lines.length && blank(lines[k])) k++;
  }
  const beat = beatLine(cleanBeatText(beatText));
  if (k >= lines.length) {
    // Nothing (or only a title) in the body: the beat goes at the end.
    const head = lines.slice(0, k);
    let h = head.length;
    while (h > doc.body && blank(head[h - 1])) h--;
    const kept = head.slice(0, h);
    const titled = h > doc.body;
    return join(doc, [...kept, ...(titled ? [""] : []), beat]);
  }
  const before = lines.slice(0, k);
  // A title right above: keep one blank line between it and the beat.
  const gap = k > doc.body && !blank(lines[k - 1]) ? [""] : [];
  return join(doc, [...before, ...gap, beat, "", ...lines.slice(k)]);
}

/** An empty beat the outline just inserted: the chapter's text right before and right after. */
export interface FreshInsert { before: string; after: string }

/**
 * Escape on a beat that was just created and never filled: the text to put back,
 * or null when the chapter is no longer exactly what the insert produced (the
 * writer or a sync changed it meanwhile, so nothing is touched).
 */
export function undoFreshBeat(current: string, fresh: FreshInsert): string | null {
  return current === fresh.after ? fresh.before : null;
}
