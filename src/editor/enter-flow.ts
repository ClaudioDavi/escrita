// Enter, Enter, Enter — pure decision logic (no Obsidian imports).
//
//   prose⏎ ⏎ ⏎      → a scene break:  prose\n\n---\n\n|
//   ---⏎ (at end)    → the next chapter
//
// `N` empty lines are "normal" paragraph spacing (1 for single line breaks,
// 2 for blank-line paragraphs, counting the line the cursor is on); one Enter
// past that turns into a scene break, and one more at the end of the chapter
// starts a new chapter.

import { SCENE_BREAK } from "../core/markers";
import type { ParagraphStyle } from "../settings";
import { blockStateAt, bodyStart, inBlock } from "./context";

export type EnterDecision = "normal" | "break" | "chapter";

const EMPTY = /^[ \t]*$/;
const LIST = /^[ \t]*(?:[-*+]|\d+[.)])(?:[ \t]|$)/;
const HEADING = /^[ \t]{0,3}#{1,6}(?:[ \t]|$)/;
const QUOTE = /^[ \t]*>/;
const TABLE = /^[ \t]*\|/;
const FENCE = /^[ \t]{0,3}(?:`{3,}|~{3,})/;
const MATH = /^[ \t]*\$\$/;

export function isEmptyLine(line: string | undefined): boolean {
  return line === undefined || EMPTY.test(line);
}

const HTML_TAG_ONLY = /^[ \t]*(?:<\/?[A-Za-z][^<>]*>[ \t]*)+$/;

function count(line: string, token: string): number {
  return line.split(token).length - 1;
}

/**
 * A line of running prose: not markup, not a break, not a comment-only line.
 * A line that opens or closes a multi-line comment (an odd number of `%%`, or
 * an unpaired `<!--` / `-->`) is not prose either.
 */
export function isProseLine(line: string): boolean {
  if (EMPTY.test(line)) return false;
  if (SCENE_BREAK.test(line) || LIST.test(line) || HEADING.test(line) || QUOTE.test(line)
    || TABLE.test(line) || FENCE.test(line) || MATH.test(line) || HTML_TAG_ONLY.test(line)) return false;
  if (count(line, "%%") % 2 === 1) return false;
  const rest = line.replace(/%%.*?%%/g, "").replace(/<!--.*?-->/g, "");
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

/** A scene break at `i` that really is one (not a setext heading underline or the frontmatter). */
function isSceneBreakAt(lines: readonly string[], i: number, body: number): boolean {
  if (i < body || !SCENE_BREAK.test(lines[i])) return false;
  return i === body || isEmptyLine(lines[i - 1]);
}

/**
 * What Enter should do on `cursorLine` (0-based) with an empty selection.
 * The caller checks the setting, the selection and that the file is a chapter.
 */
export function decideEnter(lines: readonly string[], cursorLine: number, style: ParagraphStyle): EnterDecision {
  if (cursorLine < 0 || cursorLine >= lines.length) return "normal";
  if (!isEmptyLine(lines[cursorLine])) return "normal";
  const body = bodyStart(lines);
  if (cursorLine < body) return "normal";
  if (inBlock(blockStateAt(lines, cursorLine))) return "normal";

  const start = runStart(lines, cursorLine);
  const empties = cursorLine - start + 1;
  if (empties < paragraphBlankLines(style)) return "normal";
  const above = start - 1;
  if (above < body) return "normal"; // nothing but properties (or nothing) above

  if (isSceneBreakAt(lines, above, body)) {
    for (let i = cursorLine + 1; i < lines.length; i++) if (!isEmptyLine(lines[i])) return "normal";
    return "chapter";
  }
  // the line above closes (or sits in) a multi-line comment: not prose
  if (blockStateAt(lines, above).comment) return "normal";
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
export function trailingBreakKeep(lines: readonly string[]): number | null {
  let i = lines.length - 1;
  while (i >= 0 && isEmptyLine(lines[i])) i--;
  if (i < 0) return null;
  const body = bodyStart(lines);
  if (!isSceneBreakAt(lines, i, body)) return null;
  let keep = i;
  while (keep > body && isEmptyLine(lines[keep - 1])) keep--;
  return keep;
}
