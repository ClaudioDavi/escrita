// Is a note's text ready to leave the desk? (IMPROVEMENTS 19). Pure, no Obsidian
// imports. The marker checks that publish runs today (src/publish/checks.ts:60-160)
// move here in task 1.5, so export can warn the same way while publish is off,
// and 0.10's book-wide check gives the same answer. Publish keeps its own
// property checks (recommended properties, over the limit) and adds them after these.
//
// Messages are not translated here: each check carries an id, a level and
// variables, and the caller's strings turn them into text.

import type { Markdown } from "./markdown";

export type ReadinessLevel = "blocker" | "warning" | "passed";

/**
 * - `unclosedComment`: a `%%` that never closes (or an odd `%%` inside a closed `<!-- -->`); blocker.
 * - `unclosedHtmlComment` (new in 0.8, the loose end): a `<!--` that never closes.
 *   Reading view hides the rest of the note while the words still count; blocker.
 * - `placeholders`: placeholder markers left in the body; blocker.
 * - `unwrittenBeats`: beats with no prose after them; warning.
 * - `emptyBody`: no words; blocker.
 */
export type ReadinessId = "unclosedComment" | "unclosedHtmlComment" | "placeholders" | "unwrittenBeats" | "emptyBody";

export interface ReadinessItem {
  /** raw text from the note (a placeholder's note, a beat); "" = nothing to show */
  text: string;
  /** 0-based line in the whole file, to jump to */
  line?: number;
}

/** Shaped like publish's `Check`, so publish can list these next to its own. */
export interface ReadinessCheck {
  id: ReadinessId;
  level: ReadinessLevel;
  /** 0-based line in the whole file where the problem is */
  line?: number;
  items: ReadinessItem[];
  vars: Record<string, string | number>;
}

export interface Readiness {
  /** every check, passed ones included, in the order of ReadinessId above */
  checks: ReadinessCheck[];
  /** some check is a blocker */
  blocked: boolean;
}

export interface ReadinessOptions {
  /** the placeholder marker word from settings (`XXX`) */
  placeholderMarker: string;
}

/**
 * Runs every marker check on one note's text (the editor's, maybe unsaved; never
 * a cache). Markers in code, frontmatter or comments don't count: every check
 * reads the same segmentation.
 */
export function readinessOf(md: string | Markdown, o: ReadinessOptions): Readiness {
  void md; void o;
  throw new Error("not implemented: 0.8 task 1.5");
}

/** The 0-based line where an unclosed `%%` opens (see publish/checks.ts `unclosedComment`), or null. Moves here in 1.5. */
export function unclosedComment(src: string | Markdown): number | null {
  void src;
  throw new Error("not implemented: 0.8 task 1.5");
}

/** The 0-based line where an unclosed `<!--` opens, or null. Outside code and `%%` comments. */
export function unclosedHtmlComment(src: string | Markdown): number | null {
  void src;
  throw new Error("not implemented: 0.8 task 1.5");
}
