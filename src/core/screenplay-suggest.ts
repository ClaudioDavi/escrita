// What the screenplay editor suggests as you type (1.2, SP 2, PLAN-1.2 Q11). Pure, no Obsidian
// imports; the module's EditorSuggest (src/screenplay/suggest.ts) calls these.
//
// Three triggers: a character cue (an uppercase line after a blank one), a location (after a
// scene heading prefix such as "INT. "), and a time of day (after " - " on a scene heading).
//
// STUB (Wave 0 contract). Wave 1, task B, writes them and their tests.

import type { LineKind, Script } from "./fountain";

export type SuggestKind = "cue" | "location" | "time";

export interface SuggestTrigger {
  kind: SuggestKind;
  /** the column where the replaced text starts */
  start: number;
  /** what is typed so far, from `start` to the cursor */
  query: string;
}

export interface SuggestContext {
  line: string;
  column: number;
  kind: LineKind | null;
  blankAbove: boolean;
  sceneHeadings: readonly string[];
}

/** The suggestion this cursor asks for, or null. */
export function triggerAt(ctx: SuggestContext): SuggestTrigger | null {
  void ctx;
  return null;
}

/**
 * The candidates for a trigger, best first: for a cue, the script's own cues by use, then
 * `names` (the universe's names for the note, through `plugin.names`); for a location, the
 * locations of the script's scene headings by use; for a time, `times` (the setting). Matched
 * by prefix, ignoring case and accents; never the query itself.
 */
export function candidates(trigger: SuggestTrigger, script: Script, names: readonly string[], times: readonly string[]): string[] {
  void trigger; void script; void names; void times;
  return [];
}
