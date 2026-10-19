// Tab and Enter in a screenplay note (1.2, SP 2, PLAN-1.2 Q7, Q8): what a key does, as a pure
// table. No Obsidian or CodeMirror imports. The screenplay module (src/screenplay/keys.ts) builds
// a `KeyContext` from the editor, calls `decideKey`, and dispatches the edit as one transaction
// (one undo). Null means "not ours": the key falls through to Obsidian.
//
// The rules follow Fade In, Highland and Final Draft (the author's rule: follow the spec and other
// tools). Each rule is pinned case by case in tests/screenplay-keys.test.ts.
//
// The text a rule leaves must read as the element it chose (`fountainLines`). When it otherwise
// wouldn't (a transition that ends in none of the transition endings, a scene heading with no
// known prefix, a cue Fountain would read as action), the rule adds Fountain's forced mark (`>`,
// `.`, `@`) when the cursor leaves the line, never while the writer types.
//
// STUB (Wave 0 contract). Wave 1, task B, writes the rules and their tests.

import type { LineKind } from "./fountain";

/** The element a line is being typed as: set by Tab on an empty line, or by Enter's choice. */
export type ElementMode = "action" | "scene" | "character" | "parenthetical" | "dialogue" | "transition";

export type ScriptKey = "Enter" | "Tab" | "Shift-Tab";

export interface KeyContext {
  /** the cursor's line, as typed */
  line: string;
  /** the cursor's column in `line` (an empty selection; the module never calls with a range) */
  column: number;
  /** what the line is now (`fountainDocLines`); null for a blank or non-script line */
  kind: LineKind | null;
  /** the kind of the nearest non-blank line above, null at the top */
  above: LineKind | null;
  /** is the line just above blank (or the top of the body)? */
  blankAbove: boolean;
  /** the mode the module holds for this line (a Tab on an empty line), null when none */
  mode: ElementMode | null;
  /** the parser's options, for the forced marks */
  sceneHeadings: readonly string[];
  transitions: readonly string[];
}

/** One change, in offsets relative to the start of the cursor's line in the old text. */
export interface KeyEdit {
  from: number;
  to: number;
  insert: string;
  /** the cursor after the edit, relative to the same line start, in the new text */
  cursor: number;
  /** the mode of the line the cursor lands on, null for none */
  mode: ElementMode | null;
}

/** What `key` does here, or null to let Obsidian handle it. */
export function decideKey(key: ScriptKey, ctx: KeyContext): KeyEdit | null {
  void key; void ctx;
  return null;
}

/** Are characters typed on this line uppercased (cue, scene heading, transition; Q8)? */
export function capsFor(kind: LineKind | null, mode: ElementMode | null): boolean {
  void kind; void mode;
  return false;
}
