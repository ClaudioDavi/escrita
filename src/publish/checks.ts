// Pure publish checks (no Obsidian imports). runChecks looks at a note's text
// and properties and reports what isn't ready before it's published.
// Messages are not translated here: each Check carries an id, a level and
// variables, and the modal turns them into text with t().

import { stageOf, type StageMapping } from "../core/stages";
import { segment, type Markdown } from "../core/markdown";
import { parseBeats, parsePlaceholders } from "../core/markers";
import { countIn, measureText, pieceProgress, readPiece, type PieceProperties } from "../core/measure";

export type CheckLevel = "blocker" | "warning" | "passed";

export type CheckId =
  | "unclosedComment"
  | "placeholders"
  | "unwrittenBeats"
  | "emptyBody"
  | "recommended"
  | "overLimit";

export interface CheckItem {
  /** raw text from the note (a placeholder's note, a beat); "" = nothing to show */
  text: string;
  /** 0-based line in the whole file, to jump to */
  line?: number;
}

export interface Check {
  id: CheckId;
  level: CheckLevel;
  /** 0-based line in the whole file where the problem is */
  line?: number;
  items: CheckItem[];
  vars: Record<string, string | number>;
}

export interface CheckContext {
  placeholderMarker: string;
  /** property names that should be filled in; empty = check off */
  recommendedProperties: readonly string[];
  /** where the target/limit/unit live; omitted = no limit check */
  piece?: PieceProperties;
}

export const BLOCKER_FIRST: Record<CheckLevel, number> = { blocker: 0, warning: 1, passed: 2 };

// ------------------------------------------------------------------ comments

/**
 * The 0-based line where an unclosed `%%` comment opens, or null when every
 * comment is closed. Comments are read by core/markdown: in the body, outside
 * inline and fenced code, across lines (a comment may span paragraphs).
 *
 * Also a blocker: an odd number of `%%` inside a closed `<!-- -->`. core/markdown
 * reads them as literal (the first opener wins), but whether Reading view and
 * other Markdown renderers do is unverified, and if they don't, text after the comment is hidden while
 * it still counts here. Blocking until the writer pairs them keeps publish safe
 * under either reading (docs/ARCHITECTURE.md, "Markdown segmentation").
 */
export function unclosedComment(src: string | Markdown): number | null {
  const md = typeof src === "string" ? segment(src) : src;
  const spans = md.spans();
  const last = spans[spans.length - 1];
  if (last && last.kind === "comment" && last.form === "%%" && !last.closed) return md.lineOf(last.from);
  for (const s of spans) {
    if (s.kind !== "comment" || s.form !== "html") continue;
    let odd = -1;
    for (let at = md.text.indexOf("%%", s.from); at !== -1 && at + 2 <= s.to; at = md.text.indexOf("%%", at + 2)) {
      odd = odd === -1 ? at : -1;
    }
    if (odd !== -1) return md.lineOf(odd);
  }
  return null;
}

// ------------------------------------------------------------------ status

/** Whether a status property value is one of the words the writer mapped to the published stage. */
export function isPublished(status: unknown, stages: StageMapping): boolean {
  return stageOf(status, stages) === "published";
}

/** A frontmatter value that counts as filled in: not missing, null, blank or an empty list. */
export function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(isFilled);
  return true;
}

function propertyValue(fm: Record<string, unknown>, name: string): unknown {
  if (name in fm) return fm[name];
  const lower = name.toLowerCase();
  const key = Object.keys(fm).find((k) => k.toLowerCase() === lower);
  return key === undefined ? undefined : fm[key];
}

// ------------------------------------------------------------------ all checks

/** Every check that applies to the note, in the roadmap's order. */
export function runChecks(
  text: string,
  frontmatter: Record<string, unknown> | null | undefined,
  ctx: CheckContext,
): Check[] {
  const fm = frontmatter ?? {};
  const out: Check[] = [];
  // Every check below reads the same segmentation, so markers in code,
  // frontmatter or comments are already left out.
  const md = segment(text);
  const open = unclosedComment(md);
  out.push(open === null
    ? { id: "unclosedComment", level: "passed", items: [], vars: {} }
    : { id: "unclosedComment", level: "blocker", line: open, items: [], vars: { line: open + 1 } });

  const placeholders = parsePlaceholders(md, ctx.placeholderMarker);
  out.push({
    id: "placeholders",
    level: placeholders.length ? "blocker" : "passed",
    line: placeholders[0]?.line,
    items: placeholders.map((p) => ({ text: p.text, line: p.line })),
    vars: { n: placeholders.length },
  });

  const beats = parseBeats(md).filter((b) => !b.written);
  out.push({
    id: "unwrittenBeats",
    level: beats.length ? "warning" : "passed",
    line: beats[0]?.line,
    items: beats.map((b) => ({ text: b.text, line: b.line })),
    vars: { n: beats.length },
  });

  // measured on the text given (the editor's, maybe unsaved), never a cache
  const counts = measureText(text);
  const words = counts.words;
  out.push({ id: "emptyBody", level: words === 0 ? "blocker" : "passed", items: [], vars: { n: words } });

  if (ctx.recommendedProperties.length) {
    const missing = ctx.recommendedProperties.filter((p) => !isFilled(propertyValue(fm, p)));
    out.push({
      id: "recommended",
      level: missing.length ? "warning" : "passed",
      items: [],
      vars: { names: missing.join(", "), n: missing.length },
    });
  }

  const piece = ctx.piece ? readPiece(fm, ctx.piece) : null;
  if (piece?.limit !== undefined) {
    const count = countIn(counts, piece.unit);
    const p = pieceProgress({ count, limit: piece.limit });
    out.push({
      id: "overLimit",
      level: p.state === "over" ? "warning" : "passed",
      items: [],
      vars: { count, limit: piece.limit, over: p.over, unit: piece.unit },
    });
  }

  return out;
}

export function hasBlockers(checks: readonly Check[]): boolean {
  return checks.some((c) => c.level === "blocker");
}

/** Blockers first, then warnings, then passed checks; stable otherwise. */
export function sortChecks(checks: readonly Check[]): Check[] {
  return checks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => BLOCKER_FIRST[a.c.level] - BLOCKER_FIRST[b.c.level] || a.i - b.i)
    .map((x) => x.c);
}
