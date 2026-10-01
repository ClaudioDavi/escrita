// Dialogue focus — pure logic (no Obsidian or CodeMirror imports).
//
// Finds the speech in prose: dialogue opened by a line-leading dash (— – ―,
// toggled by spaced dashes inside the line) and quoted speech in the double
// quotes of the configured style (plus straight "). Everything else is what
// the editor dims. Works over core/markdown's masked text, so frontmatter,
// code and comments are never speech and offsets stay 1:1 with the document.

import type { ParagraphStyle, QuoteStyle } from "../settings";
import type { Markdown } from "../core/markdown";
import { isSceneBreakLine } from "../core/markers";
import { QUOTES } from "./typography";
import { blockStateIn, bodyLineIn, inBlock } from "./context";

/** [from, to) UTF-16 offsets. Never empty, never contains "\r" or "\n". */
export interface Range {
  from: number;
  to: number;
}

export interface DialogueOptions {
  quoteStyle: QuoteStyle;
  paragraphStyle: ParagraphStyle;
}

/** Dash characters that open/toggle dialogue: em dash, en dash, horizontal bar. */
export const DIALOGUE_DASHES = "—–―";
/** Paragraph widening cap (lines each way) so one giant paragraph can't make a viewport rebuild O(doc). */
export const MAX_WIDEN = 200;

const LEAD = /^[ \t]*(?:>[ \t]*)*/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

interface LineInfo {
  start: number;
  /** end of the content, before "\r?\n" (and before a lone trailing "\r") */
  end: number;
}

function linesOf(text: string): LineInfo[] {
  const out: LineInfo[] = [];
  let s = 0;
  for (;;) {
    const nl = text.indexOf("\n", s);
    const stop = nl === -1 ? text.length : nl;
    let e = stop;
    if (e > s && text.charCodeAt(e - 1) === 13) e--;
    out.push({ start: s, end: e });
    if (nl === -1) return out;
    s = nl + 1;
  }
}

const isBlank = (c: string | undefined) => c === " " || c === "\t";

/** The double quotes that open quoted speech in a style (plus straight "), mapped to their closers. */
function quoteClosers(quoteStyle: QuoteStyle): Map<string, string> {
  const closers = new Map<string, string>();
  if (quoteStyle === "off") closers.set("“", "”");
  else closers.set(QUOTES[quoteStyle].open2, QUOTES[quoteStyle].close2);
  closers.set('"', '"');
  return closers;
}

/**
 * Line-leading dash dialogue, with spaced-dash toggles; the state carries across
 * hard-wrapped lines. A spaced dash that ends a line toggles too when the
 * paragraph goes on (the wrap fell right after it). Dashes inside an open double
 * quote are part of the quoted speech and toggle nothing.
 */
function dashPass(text: string, lines: LineInfo[], closers: Map<string, string>, out: Range[]): void {
  let state: "none" | "speech" | "narration" = "none";
  let closer: string | null = null;
  lines.forEach(({ start, end }, li) => {
    const line = text.slice(start, end);
    const lead = LEAD.exec(line)![0].length;
    const more = li + 1 < lines.length;
    let open: number | null = null;
    let i = lead;
    if (closer === null && i < line.length && DIALOGUE_DASHES.includes(line[i])) {
      state = "speech";
      open = start + i;
      i++;
    } else if (state === "speech") {
      open = start + lead;
    }
    // last non-blank char: a toggle dash needs content after it (on this line or the next)
    let last = line.length - 1;
    while (last >= 0 && isBlank(line[last])) last--;
    for (; i <= last; i++) {
      const c = line[i];
      if (closer !== null) {
        if (c === closer) closer = null;
        continue;
      }
      const cl = closers.get(c);
      if (cl !== undefined) {
        closer = cl;
        continue;
      }
      if (state === "none" || !DIALOGUE_DASHES.includes(c)) continue;
      if (!(i === lead || isBlank(line[i - 1]))) continue;
      if (i === last && !more) continue;
      if (state === "speech") {
        out.push({ from: open!, to: start + i });
        open = null;
        state = "narration";
      } else {
        open = start + i;
        state = "speech";
      }
    }
    if (open !== null) out.push({ from: open, to: end });
  });
}

/** Quoted speech; an unclosed quote runs to the end of the paragraph. */
function quotePass(text: string, closers: Map<string, string>, out: Range[]): void {
  let closer: string | null = null;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (closer === null) {
      const cl = closers.get(c);
      if (cl !== undefined) {
        closer = cl;
        from = i;
      }
    } else if (c === closer) {
      out.push({ from, to: i + 1 });
      closer = null;
    }
  }
  if (closer !== null) out.push({ from, to: text.length });
}

/** Split at line breaks (and stray "\r"), trim blanks at both ends, drop empties, sort and merge. */
function normalise(text: string, lines: LineInfo[], raw: Range[]): Range[] {
  const pieces: Range[] = [];
  const push = (a: number, b: number) => {
    while (a < b && isBlank(text[a])) a++;
    while (b > a && isBlank(text[b - 1])) b--;
    if (b > a) pieces.push({ from: a, to: b });
  };
  for (const r of raw) {
    // first line whose content end is at or past r.from
    let lo = 0;
    let hi = lines.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].end < r.from) lo = mid + 1;
      else hi = mid;
    }
    for (let li = lo; li < lines.length && lines[li].start < r.to; li++) {
      let a = Math.max(r.from, lines[li].start);
      const b = Math.min(r.to, lines[li].end);
      for (let cr = text.indexOf("\r", a); cr !== -1 && cr < b; cr = text.indexOf("\r", a)) {
        push(a, cr);
        a = cr + 1;
      }
      push(a, b);
    }
  }
  pieces.sort((x, y) => x.from - y.from || x.to - y.to);
  const merged: Range[] = [];
  for (const p of pieces) {
    const top = merged[merged.length - 1];
    if (top && p.from <= top.to) top.to = Math.max(top.to, p.to);
    else merged.push({ ...p });
  }
  return merged;
}

/** Speech ranges inside one paragraph (text may contain \n or \r\n line breaks). Sorted, merged, split at line breaks, blanks trimmed. */
export function dialogueRanges(paragraph: string, quoteStyle: QuoteStyle): Range[] {
  if (paragraph === "") return [];
  const lines = linesOf(paragraph);
  const raw: Range[] = [];
  const closers = quoteClosers(quoteStyle);
  dashPass(paragraph, lines, closers, raw);
  quotePass(paragraph, closers, raw);
  return normalise(paragraph, lines, raw);
}

/**
 * Absolute speech ranges for every paragraph touching lines [fromLine, toLine]
 * (0-based, inclusive) of a segmented doc. Frontmatter, code/comment/math
 * lines, headings and scene breaks are never speech and end paragraphs.
 * A `blank`-style paragraph is widened by at most MAX_WIDEN lines each way.
 * Sorted, non-overlapping.
 */
export function dialogueInDoc(md: Markdown, fromLine: number, toLine: number, opts: DialogueOptions): Range[] {
  const n = md.lineCount;
  if (n === 0) return [];
  const from = Math.max(0, Math.min(fromLine, n - 1));
  const to = Math.max(0, Math.min(toLine, n - 1));
  if (from > to) return [];
  const mask = md.masked();
  const body = bodyLineIn(md);

  const gaps = new Map<number, boolean>();
  const isGap = (l: number): boolean => {
    let g = gaps.get(l);
    if (g === undefined) {
      const line = mask.slice(md.lineStart(l), md.lineEnd(l));
      g = l < body
        || line.trim() === ""
        || inBlock(blockStateIn(md, l))
        || HEADING.test(line)
        || line.trimStart().startsWith("$$")
        || isSceneBreakLine(md, l);
      gaps.set(l, g);
    }
    return g;
  };

  let a = from;
  let b = to;
  const blank = opts.paragraphStyle === "blank";
  if (blank) {
    if (!isGap(a)) for (let k = 0; k < MAX_WIDEN && a > 0 && !isGap(a - 1); k++) a--;
    if (!isGap(b)) for (let k = 0; k < MAX_WIDEN && b < n - 1 && !isGap(b + 1); k++) b++;
  }

  const out: Range[] = [];
  for (let l = a; l <= b; l++) {
    if (isGap(l)) continue;
    const p = l;
    if (blank) while (l + 1 <= b && !isGap(l + 1)) l++;
    const base = md.lineStart(p);
    for (const r of dialogueRanges(mask.slice(base, md.lineEnd(l)), opts.quoteStyle)) {
      out.push({ from: base + r.from, to: base + r.to });
    }
  }
  return out;
}

/** What to dim on lines [fromLine, toLine]: whole lines with no speech, and the gaps between speech on mixed lines. */
export interface DimPlan {
  /** 0-based lines to dim entirely, ascending */
  lines: number[];
  /** ranges to dim inside mixed lines, sorted, never crossing a line */
  marks: Range[];
}

/**
 * The complement of the speech on lines [fromLine, toLine] (0-based, inclusive).
 * Only those lines (plus paragraph widening) are examined, so the editor's cost
 * follows the viewport, not the note.
 */
export function dimPlan(md: Markdown, fromLine: number, toLine: number, opts: DialogueOptions): DimPlan {
  const plan: DimPlan = { lines: [], marks: [] };
  const n = md.lineCount;
  const from = Math.max(0, fromLine);
  const to = Math.min(toLine, n - 1);
  if (from > to) return plan;
  const speech = dialogueInDoc(md, from, to, opts);
  let k = 0;
  const first = md.lineStart(from);
  while (k < speech.length && speech[k].to <= first) k++;
  for (let l = from; l <= to; l++) {
    const ls = md.lineStart(l);
    const le = md.lineEnd(l);
    let pos = ls;
    let mixed = false;
    while (k < speech.length && speech[k].from <= le) {
      const r = speech[k++];
      mixed = true;
      if (r.from > pos) plan.marks.push({ from: pos, to: r.from });
      pos = r.to;
    }
    if (!mixed) plan.lines.push(l);
    else if (le > pos) plan.marks.push({ from: pos, to: le });
  }
  return plan;
}
