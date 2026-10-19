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

import { fountainLines, type FountainOptions, type LineKind } from "./fountain";
import { segment } from "./markdown";

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

/** The order Tab walks on an empty line (Final Draft's, Fade In's): Shift-Tab walks it backwards. */
const CYCLE: readonly ElementMode[] = ["action", "character", "transition", "scene"];

/** The element the cursor's line is, for the rules: the parser's reading, except where it can't know yet. */
function shapeOf(ctx: KeyContext): ElementMode | null {
  const { kind, mode } = ctx;
  // a cue, a heading or a transition is read from what follows or precedes it, which isn't typed
  // yet: the mode the writer chose says what the line is
  if ((mode === "character" || mode === "scene" || mode === "transition")
    && (kind === null || kind === "action" || kind === "character" || kind === "scene" || kind === "transition")) return mode;
  switch (kind) {
    case "character": case "parenthetical": case "dialogue": case "scene": case "transition": case "action":
      return kind;
  }
  return kind === null && (mode === "dialogue" || mode === "parenthetical") ? mode : null;
}

/** What `key` does here, or null to let Obsidian handle it. */
export function decideKey(key: ScriptKey, ctx: KeyContext): KeyEdit | null {
  const { line, column } = ctx;
  if (line.trim() === "") return key === "Enter" ? enterOnEmpty(ctx) : cycle(key === "Tab" ? 1 : -1, ctx);
  // every other rule acts at the end of a line: in the middle of one the key is Obsidian's
  if (column !== line.length) return null;
  const shape = shapeOf(ctx);
  const end = line.length;
  if (key === "Enter") {
    switch (shape) {
      // a speech goes on: the next line is the dialogue (or what the parenthetical leads to)
      case "character": case "parenthetical":
        return { from: end, to: end, insert: "\n", cursor: end + 1, mode: "dialogue" };
      // a speech ends: a blank line (Fountain needs it above a cue), then the next cue
      case "dialogue":
        return { from: end, to: end, insert: "\n\n", cursor: end + 2, mode: "character" };
      case "scene": case "action":
        return { from: end, to: end, insert: "\n\n", cursor: end + 2, mode: "action" };
      // after a transition the next thing is a new scene, as in Final Draft and Fade In
      case "transition":
        return { from: end, to: end, insert: "\n\n", cursor: end + 2, mode: "scene" };
    }
    return null;
  }
  // Tab right after a cue opens a parenthetical, the cursor between the parentheses
  if (key === "Tab" && shape === "character") return { from: end, to: end, insert: "\n()", cursor: end + 2, mode: "parenthetical" };
  return null;
}

/** Enter on a line with nothing typed: a cue, heading or transition mode backs out to action. */
function enterOnEmpty(ctx: KeyContext): KeyEdit | null {
  const { mode, line } = ctx;
  if (mode === "character" || mode === "scene" || mode === "transition") return { from: 0, to: line.length, insert: "", cursor: 0, mode: "action" };
  return null;
}

/** Tab (`dir` 1) or Shift-Tab (-1) on an empty line: the next element in `CYCLE`, wrapping. */
function cycle(dir: 1 | -1, ctx: KeyContext): KeyEdit {
  const at = CYCLE.indexOf(ctx.mode ?? "action");
  const next = CYCLE[(Math.max(at, 0) + dir + CYCLE.length) % CYCLE.length];
  return { from: 0, to: ctx.line.length, insert: "", cursor: 0, mode: next };
}

const CAPS: readonly (LineKind | ElementMode | null)[] = ["character", "scene", "transition"];

/** Are characters typed on this line uppercased (cue, scene heading, transition; Q8)? */
export function capsFor(kind: LineKind | null, mode: ElementMode | null): boolean {
  if (kind === "parenthetical" || mode === "parenthetical") return false;
  return CAPS.includes(kind) || CAPS.includes(mode);
}

const MARK_FOR: Partial<Record<ElementMode, { want: LineKind; mark: "@" | "." | ">" }>> = {
  character: { want: "character", mark: "@" },
  scene: { want: "scene", mark: "." },
  transition: { want: "transition", mark: ">" },
};

/** Does `line`, typed alone after a blank line, read as `want`? A cue needs a line after it, a transition a blank one. */
function readsAs(line: string, want: LineKind, opts: FountainOptions): boolean {
  const text = want === "character" ? `\n${line}\nx` : want === "transition" ? `\n${line}\n` : `\n${line}`;
  return fountainLines(text, segment(text), opts)[1] === want;
}

/**
 * The Fountain mark to put in front of a line typed in `mode` when it would not read as that
 * element by itself: `@` for a cue with lowercase (or one that reads as a heading), `.` for a
 * heading with no known prefix, `>` for a transition with no known ending. Null when the line is
 * fine, blank, in another mode, or when the mark would not help. The module applies it when the
 * cursor leaves the line, never while the writer types. It asks the parser, so it never disagrees.
 */
export function forcedMarkFor(line: string, mode: ElementMode | null, opts: FountainOptions): "@" | "." | ">" | null {
  const rule = mode ? MARK_FOR[mode] : undefined;
  if (!rule || line.trim() === "") return null;
  if (readsAs(line, rule.want, opts)) return null;
  return readsAs(rule.mark + line, rule.want, opts) ? rule.mark : null;
}
