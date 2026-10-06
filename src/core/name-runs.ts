// Candidate names: the capitalized words and runs a text uses mid-sentence (0.9, U 2.5;
// PLAN-0.9 Q2, Q3). Pure: no Obsidian imports. Shared by the lens's names rule
// (lens/rules-names.ts, over the lens's own mask) and the universe's on-demand
// `universe-names` index (universe/names-index.ts, over `namesMask`), so the in-note
// count and the cross-work count always find the same runs. Neither module imports the
// other; both import this.
//
// A run (task 1.3 writes it; the Wave 0 judge settled these rules):
// - Words by the shared word rule (core/tokens.ts) that start with an uppercase letter,
//   one after the other, separated only by spaces or tabs in the mask (never a line
//   break, never punctuation: "Sr. Almeida" is two runs, "Sr" and "Almeida").
// - A joiner (NAME_JOINERS, lowercase as written) between two capitalized words joins
//   them: "Maria das Dores", "João da Silva". A run never starts or ends with a joiner.
// - Sentence starts (core/sentences.ts; the first word at or after a sentence's `from`,
//   so after a dialogue travessão too) are not names. A run whose first word starts a
//   sentence: when that word is a stop word of `lang` (core/stem isStopWord: "A Joana",
//   "Em Lisboa"), it is dropped and the rest of the run is the candidate; otherwise the
//   whole run is skipped ("Depois Teodoro", "Rio Pequeno corria"). The rule errs toward
//   silence.
// - Name titles stay in the run ("Padre Antônio"); a run that is only a title is the
//   caller's to drop (NamesPort.isKnownName answers true for it).
// `lang` null (the language off): no stop words and no joiners, so a run at a sentence
// start is always skipped.

import type { Markdown } from "./markdown";
import type { Sentence } from "./sentences";
import type { StemLang } from "./stem";
import type { Token } from "./tokens";

/** One candidate name, as written, with its document offsets. */
export interface NameRun {
  from: number;
  to: number;
  /** the run as written in the mask, words joined by one space: "Rio Pequeno" */
  text: string;
  /** foldName(text): what counts, "Not names" and the known-name test compare */
  key: string;
}

/** Lowercase words that join two capitalized words into one name, by language. */
export const NAME_JOINERS: Record<StemLang, readonly string[]> = {
  pt: ["de", "da", "do", "das", "dos"],
  en: [],
};

/**
 * The candidate names of a mask, in document order. `toks` are tokens(mask) and `sents`
 * sentences(mask, md, lang), so the offsets match the document.
 */
export function nameRuns(
  toks: readonly Token[],
  sents: readonly Sentence[],
  mask: string,
  lang: StemLang | null,
): NameRun[] {
  void toks; void sents; void mask; void lang;
  throw new Error("not implemented: 0.9 task 1.3");
}

/**
 * The mask the `universe-names` index reads: core/wordcount readerMask with heading
 * lines and `$$` blocks blanked, the same text the lens reads with "Skip quotations"
 * off (lens/analyze readMask). Frontmatter, code, comments and markup are blank already.
 */
export function namesMask(md: Markdown): string {
  void md;
  throw new Error("not implemented: 0.9 task 1.3");
}
