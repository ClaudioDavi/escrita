// Enter, Enter, Enter — pure decision logic (no Obsidian imports).
//
//   prose⏎ ⏎ ⏎      → a scene break:  prose\n\n---\n\n|
//   ---⏎ (at end)    → the next chapter
//
// `N` empty lines are "normal" paragraph spacing (1 for single line breaks,
// 2 for blank-line paragraphs, counting the line the cursor is on); one Enter
// past that turns into a scene break, and one more at the end of the chapter
// starts a new chapter.

import { segment, type Markdown } from "../core/markdown";
import { SCENE_BREAK, isSceneBreakAt } from "../core/markers";
import type { ParagraphStyle } from "../settings";
import { blockStateIn, bodyLineIn, inBlock } from "./context";

export type EnterDecision = "normal" | "break" | "chapter";

const EMPTY = /^[ \t]*$/;
const LIST = /^[ \t]*(?:[-*+]|\d+[.)])(?:[ \t]|$)/;
const HEADING = /^[ \t]{0,3}#{1,6}(?:[ \t]|$)/;
const QUOTE = /^[ \t]*>/;
const TABLE = /^[ \t]*\|/;
const MATH = /^[ \t]*\$\$/;

export function isEmptyLine(line: string | undefined): boolean {
  return line === undefined || EMPTY.test(line);
}

const HTML_TAG_ONLY = /^[ \t]*(?:<\/?[A-Za-z][^<>]*>[ \t]*)+$/;

/**
 * A line of running prose: not markup, not a break, not a comment-only line.
 * A line that opens a fence or a comment it doesn't close, or that holds an
 * unpaired `<!--` / `-->`, is not prose either (read by core/markdown, so `%%`
 * inside inline code is just text).
 */
export function isProseLine(line: string): boolean {
  if (EMPTY.test(line)) return false;
  if (SCENE_BREAK.test(line) || LIST.test(line) || HEADING.test(line) || QUOTE.test(line)
    || TABLE.test(line) || MATH.test(line) || HTML_TAG_ONLY.test(line)) return false;
  const md = segment(line);
  if (md.spans().some((s) => !s.closed)) return false;
  const rest = md.masked();
  if (rest.includes("<!--") || rest.includes("-->")) return false;
  return rest.trim().length > 0;
}

export function paragraphBlankLines(style: ParagraphStyle): number {
  return style === "single" ? 1 : 2;
}

/** First line of the run of empty lines that ends at `line` (inclusive). */
function runStart(lines: readonly string[], line: number): number {
  let i = line;
  while (i > 0 && isEmptyLine(lines[i - 1])) i--;
  return i;
}

/**
 * A document as the Enter flow reads it: its lines and their segmentation.
 * Editor callers pass `segmentDoc(state.doc)` so the pass is shared per version.
 */
type Doc = readonly string[] | Markdown;

function read(doc: Doc): { lines: readonly string[]; md: Markdown } {
  if (!isMarkdown(doc)) return { lines: doc, md: segment(doc.join("\n")) };
  const lines: string[] = [];
  for (let i = 0; i < doc.lineCount; i++) lines.push(doc.text.slice(doc.lineStart(i), doc.lineEnd(i)));
  return { lines, md: doc };
}

function isMarkdown(doc: Doc): doc is Markdown {
  return !Array.isArray(doc);
}

/**
 * What Enter should do on `cursorLine` (0-based) with an empty selection.
 * The caller checks the setting, the selection and that the file is a chapter.
 */
export function decideEnter(doc: Doc, cursorLine: number, style: ParagraphStyle): EnterDecision {
  const { lines, md } = read(doc);
  if (cursorLine < 0 || cursorLine >= lines.length) return "normal";
  if (!isEmptyLine(lines[cursorLine])) return "normal";
  const body = bodyLineIn(md);
  if (cursorLine < body) return "normal";
  if (inBlock(blockStateIn(md, cursorLine))) return "normal";

  const start = runStart(lines, cursorLine);
  const empties = cursorLine - start + 1;
  if (empties < paragraphBlankLines(style)) return "normal";
  const above = start - 1;
  if (above < body) return "normal"; // nothing but properties (or nothing) above

  if (isSceneBreakAt(md, above, body)) {
    for (let i = cursorLine + 1; i < lines.length; i++) if (!isEmptyLine(lines[i])) return "normal";
    return "chapter";
  }
  // the line above closes (or sits in) a multi-line comment: not prose
  if (blockStateIn(md, above).comment) return "normal";
  return isProseLine(lines[above]) ? "break" : "normal";
}

export interface LineEdit {
  /** first line replaced (0-based, inclusive) */
  fromLine: number;
  /** last line replaced (0-based, inclusive) */
  toLine: number;
  /** replaces the text from the start of fromLine to the end of toLine */
  insert: string;
}

/**
 * The scene-break edit for a "break" decision: the empty run ending at the
 * cursor becomes blank, ---, blank, cursor line. Put the cursor at the end of `insert`.
 */
export function breakEdit(lines: readonly string[], cursorLine: number): LineEdit {
  return { fromLine: runStart(lines, cursorLine), toLine: cursorLine, insert: "\n---\n\n" };
}

/**
 * When the text ends with a scene break followed only by blank lines, the
 * number of lines to keep (everything up to the last non-empty line before
 * the break). Null when the text doesn't end that way.
 */
export function trailingBreakKeep(doc: Doc): number | null {
  const { lines, md } = read(doc);
  let i = lines.length - 1;
  while (i >= 0 && isEmptyLine(lines[i])) i--;
  if (i < 0) return null;
  const body = bodyLineIn(md);
  // never a --- inside code or a comment: that text is not ours to delete
  if (!isSceneBreakAt(md, i, body)) return null;
  let keep = i;
  while (keep > body && isEmptyLine(lines[keep - 1])) keep--;
  return keep;
}
