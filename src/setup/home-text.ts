// The text of the home note the setup creates (1.0, SF 10; boards 35 and 37). Pure, no
// Obsidian imports. Task 2.2 owns this file; setup/plan.ts calls it so the plan carries the
// text the run writes.

import type { DefaultsLanguage } from "../core/defaults";

export interface HomeTextContext {
  /** the language of the note: the setup's "Language of the defaults", not the interface's */
  language: DefaultsLanguage;
  /** whether the plan lists examples, so the note can say they are safe to delete (Q3) */
  examples: boolean;
}

/** The works block the desk draws (`escrita-works`, the desk's HOME_TEMPLATE): the one part of the note Escrita reads. */
export const WORKS_BLOCK = "```escrita-works\n```\n";

// The note's words, in the setup's language (the writer's own note: not the interface's).
const TEXT: Record<DefaultsLanguage, { mine: string; examples: string }> = {
  en: {
    mine: "This note is yours. Escrita only draws the block below: what to write today, and where you left off.",
    examples: "The notes that start with “Example ·” are safe to delete whenever you like.",
  },
  "pt-BR": {
    mine: "Esta nota é sua. O Escrita só desenha o bloco abaixo: o que escrever hoje e onde você parou.",
    examples: "As notas que começam com “Exemplo ·” podem ser apagadas quando você quiser.",
  },
};

/**
 * The home note's full text (board 37 a): a line saying the note is the writer's and Escrita
 * only draws the block, the works block, and with examples a line that they can be deleted
 * whenever the writer likes. Deterministic.
 */
export function homeNoteText(ctx: HomeTextContext): string {
  const words = TEXT[ctx.language];
  const tail = ctx.examples ? `\n${words.examples}\n` : "";
  return `${words.mine}\n\n${WORKS_BLOCK}${tail}`;
}
