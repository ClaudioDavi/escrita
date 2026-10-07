// The text of the home note the setup creates (1.0, SF 10; boards 35 and 37). Pure, no
// Obsidian imports. Task 2.2 owns this file and writes the text; the seam fixes the call
// setup/plan.ts makes, so the plan carries the text the run writes.

import type { DefaultsLanguage } from "../core/defaults";

export interface HomeTextContext {
  /** the language of the note: the setup's "Language of the defaults", not the interface's */
  language: DefaultsLanguage;
  /** whether the plan lists examples, so the note can say they are safe to delete (Q3) */
  examples: boolean;
}

/** The works block the desk draws (`escrita-works`, the desk's HOME_TEMPLATE): the one part of the note Escrita reads. */
export const WORKS_BLOCK = "```escrita-works\n```\n";

/**
 * The home note's full text (board 37 a): a line saying the note is the writer's and Escrita
 * only draws the block, the works block, and with examples a line that they can be deleted
 * whenever the writer likes. Deterministic.
 *
 * Until task 2.2: the works block alone, as "Open the home note" creates it.
 */
export function homeNoteText(ctx: HomeTextContext): string {
  void ctx;
  return WORKS_BLOCK;
}
