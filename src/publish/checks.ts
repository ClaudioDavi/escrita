// Pure publish checks (no Obsidian imports). runChecks looks at a note's text
// and properties and reports what isn't ready before it's published.
// Messages are not translated here: each Check carries an id, a level and
// variables, and the modal turns them into text with t().

import { stageOf, type StageMapping } from "../core/stages";
import { propertyValue } from "../core/book-source";
import { readinessOf, unclosedComment } from "../core/readiness";
import { countIn, pieceProgress, readPiece, type PieceProperties } from "../core/measure";

export type CheckLevel = "blocker" | "warning" | "passed";

export type CheckId =
  | "unclosedComment"
  | "unclosedHtmlComment"
  | "placeholders"
  | "unwrittenBeats"
  | "emptyBody"
  | "recommended"
  | "overLimit"
  | "earlierChapter";

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
  /**
   * Serial publishing (0.9, Q13): the labels of the earlier chapters of the book's sequence
   * that aren't published (core/serial.ts earlierUnpublished). Omitted or null = the note
   * isn't a counted chapter, no check. A warning, never a blocker.
   */
  earlierUnpublished?: readonly string[] | null;
}

export const BLOCKER_FIRST: Record<CheckLevel, number> = { blocker: 0, warning: 1, passed: 2 };

// ------------------------------------------------------------------ comments

// The marker checks live in core/readiness.ts; re-exported for existing callers.
export { unclosedComment };

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

// ------------------------------------------------------------------ all checks

/** Every check that applies to the note, in the roadmap's order. */
export function runChecks(
  text: string,
  frontmatter: Record<string, unknown> | null | undefined,
  ctx: CheckContext,
): Check[] {
  const fm = frontmatter ?? {};
  const out: Check[] = [];
  // The marker checks come from core/readiness. A passed unclosedHtmlComment is
  // left out of the list (the modal lists it only when it blocks).
  // measured on the text given (the editor's, maybe unsaved), never a cache; once, by readinessOf
  const ready = readinessOf(text, { placeholderMarker: ctx.placeholderMarker });
  out.push(...ready.checks.filter((c) => c.id !== "unclosedHtmlComment" || c.level !== "passed"));

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
    const count = countIn(ready.counts, piece.unit);
    const p = pieceProgress({ count, limit: piece.limit });
    out.push({
      id: "overLimit",
      level: p.state === "over" ? "warning" : "passed",
      items: [],
      vars: { count, limit: piece.limit, over: p.over, unit: piece.unit },
    });
  }

  if (ctx.earlierUnpublished) {
    const early = ctx.earlierUnpublished;
    out.push({
      id: "earlierChapter",
      level: early.length ? "warning" : "passed",
      items: [],
      vars: { chapters: early.join(", "), n: early.length },
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
