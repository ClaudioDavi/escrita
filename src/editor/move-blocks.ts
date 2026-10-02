// Move a paragraph or scene: the block model (pure, no Obsidian or CodeMirror imports).
//
// A note's body is cut into blocks, each a [from, to) range that starts at a line
// start and ends at the end of a line's content (no line break inside the ends), so
// the text between two blocks is only line breaks and blank lines (the "separator").
//
//   paragraph  a run of prose lines (blank style) or one prose line (single style).
//              In blank style a run is every line up to the next blank line or break, so
//              a beat, heading or code glued to prose travels with it (`units` marks
//              those parts, where the cursor refuses)
//   heading    a `#` line (blank style: a glued run with a heading and no prose)
//   unit       a beat, a comment, a fenced code block or a math block: it never moves
//              and is never moved into; a paragraph steps over it as one neighbour
//   break      a scene break line (`---`); a paragraph steps over it too
//   scene      the text between scene breaks, blank lines inside kept (scene mode)
//
// Frontmatter is never a block. Units are read from core/markdown (code, comments)
// and core/markers (beats, scene breaks), so this module re-detects nothing but math
// and headings. `swap` (move.ts) uses the blocks; this file only says what they are
// and which ones a selection means.

import type { Markdown } from "../core/markdown";
import { isBeatLine, isSceneBreakAt } from "../core/markers";
import type { ParagraphStyle } from "../settings";

export interface Block {
  from: number;
  to: number;
  kind: "paragraph" | "heading" | "unit" | "break" | "scene";
  /** parts of a glued paragraph block that are units (a beat, a comment, code): the cursor refuses there */
  units?: { from: number; to: number }[];
}
export interface Sel { anchor: number; head: number }
export type MoveDir = "up" | "down";
export type MoveRefusal = { refused: "properties" | "noBlock" | "inUnit" | "edge" };
export type MoveResult =
  | MoveRefusal
  | { refused: "unsafe" }
  | { change: { from: number; to: number; insert: string }; selection: Sel };

const HEADING = /^[ \t]{0,3}#{1,6}(?:[ \t]|$)/;
const FENCE = /^ {0,3}(?:`{3,}|~{3,})/;
const MATH_OPEN = /^[ \t]*\$\$/;

type Tag = "empty" | "para" | "heading" | "unit" | "cont" | "break";

function count(s: string, sub: string): number {
  let n = 0;
  for (let i = s.indexOf(sub); i !== -1; i = s.indexOf(sub, i + sub.length)) n++;
  return n;
}

/** What each body line is. "cont" continues the unit above (blank lines inside one too). */
function tagLines(md: Markdown): Tag[] {
  const tags: Tag[] = [];
  let inMath = false;
  for (let i = 0; i < md.lineCount; i++) {
    if (i < md.bodyLine) { tags.push("empty"); continue; }
    const ls = md.lineStart(i);
    const le = md.lineEnd(i);
    const text = md.text.slice(ls, le);
    if (inMath) {
      if (text.includes("$$")) inMath = false;
      tags.push("cont");
      continue;
    }
    if (md.startsIn(i) !== "prose") { tags.push("cont"); continue; }
    if (text.trim() === "") { tags.push("empty"); continue; }
    if (isSceneBreakAt(md, i)) { tags.push("break"); continue; }
    if (isBeatLine(md, i)) { tags.push("unit"); continue; }
    if (unitByAnchors(md, i, ls, le, text)) { tags.push("unit"); continue; }
    if (MATH_OPEN.test(text)) {
      if (count(text, "$$") % 2 === 1) inMath = true;
      tags.push("unit");
      continue;
    }
    tags.push(HEADING.test(text) ? "heading" : "para");
  }
  return tags;
}

/** A fence opener, a comment-only line, or a line that opens a comment/fence running on. */
function unitByAnchors(md: Markdown, i: number, ls: number, le: number, text: string): boolean {
  let comment = false;
  let other = false;
  for (const span of md.spans(ls, le)) {
    if (span.kind === "comment") {
      if (!span.closed || md.lineOf(span.to) > i) return true;
      comment = true;
    } else if (span.kind === "code") {
      if (FENCE.test(text) && span.from >= ls && (!span.closed || md.lineOf(span.to) > i)) return true;
      other = true;
    } else if (md.text.slice(Math.max(ls, span.from), Math.min(le, span.to)).trim() !== "") {
      other = true;
    }
  }
  return comment && !other;
}

/** Start line to end line of a block, the end trimmed back to its last non-blank line. */
function make(md: Markdown, kind: Block["kind"], first: number, last: number): Block {
  let end = last;
  while (end > first && md.lineStart(end) === md.lineEnd(end)) end--;
  while (end > first && md.text.slice(md.lineStart(end), md.lineEnd(end)).trim() === "") end--;
  return { kind, from: md.lineStart(first), to: md.lineEnd(end) };
}

export function paragraphBlocks(md: Markdown, style: ParagraphStyle): Block[] {
  const tags = tagLines(md);
  const out: Block[] = [];
  let i = 0;
  while (i < tags.length) {
    const tag = tags[i];
    if (tag === "empty" || tag === "cont") { i++; continue; }
    if (tag === "break") { out.push(make(md, "break", i, i)); i++; continue; }
    if (style === "blank") {
      // a glued run: no blank or break line among its lines
      let j = i;
      while (j + 1 < tags.length && tags[j + 1] !== "empty" && tags[j + 1] !== "break") j++;
      out.push(runBlock(md, tags, i, j));
      i = j + 1;
      continue;
    }
    if (tag === "para") {
      out.push(make(md, "paragraph", i, i));
      i++;
    } else if (tag === "unit") {
      let j = i;
      while (j + 1 < tags.length && tags[j + 1] === "cont") j++;
      out.push(make(md, "unit", i, j));
      i = j + 1;
    } else {
      out.push(make(md, tag, i, i));
      i++;
    }
  }
  return out;
}

/** One glued run (blank style): prose makes it a paragraph, else a heading, else a unit. */
function runBlock(md: Markdown, tags: Tag[], first: number, last: number): Block {
  const run = tags.slice(first, last + 1);
  const kind: Block["kind"] = run.includes("para") ? "paragraph" : run.includes("heading") ? "heading" : "unit";
  const block = make(md, kind, first, last);
  if (kind === "paragraph" && run.some((t) => t !== "para")) {
    const units: { from: number; to: number }[] = [];
    for (let k = first; k <= last; k++) {
      if (tags[k] !== "unit") continue;
      let e = k;
      while (e + 1 <= last && tags[e + 1] === "cont") e++;
      units.push({ from: md.lineStart(k), to: md.lineEnd(e) });
      k = e;
    }
    if (units.length) block.units = units;
  }
  return block;
}

export function sceneBlocks(md: Markdown): Block[] {
  const tags = tagLines(md);
  const out: Block[] = [];
  let first = -1;
  let last = -1;
  const flush = () => {
    if (first !== -1) out.push(make(md, "scene", first, last));
    first = -1;
  };
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (tag === "break") {
      flush();
      out.push(make(md, "break", i, i));
    } else if (tag !== "empty") {
      if (first === -1) first = i;
      last = i;
    }
  }
  flush();
  return out;
}

/** The cursor, or the start of the selection, is in the frontmatter (the properties). */
export function inProperties(md: Markdown, sel: Sel): boolean {
  if (md.bodyLine === 0) return false;
  return Math.min(sel.anchor, sel.head) <= md.lineEnd(md.bodyLine - 1);
}

/**
 * The blocks a selection means, as indexes into `blocks` (inclusive). An empty
 * selection means the block it sits in (edges count). A range means every block it
 * overlaps (touching an edge is not overlapping), as one group. Units in the middle
 * of a group go along; a group whose first or last block is a unit refuses
 * (`inUnit`). Breaks at the ends of a group are dropped; nothing left is `noBlock`.
 * In scene mode only scenes and breaks exist, so only `noBlock` can refuse.
 * The caller checks `inProperties` first.
 */
export function groupAt(blocks: Block[], sel: Sel, mode: "paragraph" | "scene"): { i: number; j: number } | MoveRefusal {
  const lo = Math.min(sel.anchor, sel.head);
  const hi = Math.max(sel.anchor, sel.head);
  const hit = (b: Block) => (lo === hi ? b.from <= lo && lo <= b.to : b.to > lo && b.from < hi);
  let i = blocks.findIndex(hit);
  if (i === -1) return { refused: "noBlock" };
  let j = i;
  while (j + 1 < blocks.length && hit(blocks[j + 1])) j++;
  while (i <= j && blocks[i].kind === "break") i++;
  while (j >= i && blocks[j].kind === "break") j--;
  if (i > j) return { refused: "noBlock" };
  if (mode === "paragraph" && (blocks[i].kind === "unit" || blocks[j].kind === "unit")) return { refused: "inUnit" };
  // a cursor on the beat/comment/code part of a glued paragraph refuses too
  const inside = (b: Block, p: number) => !!b.units?.some((u) => u.from <= p && p <= u.to);
  if (mode === "paragraph" && (inside(blocks[i], lo) || inside(blocks[j], hi))) return { refused: "inUnit" };
  return { i, j };
}
