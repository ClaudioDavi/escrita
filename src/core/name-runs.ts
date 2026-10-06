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
// - English "I" and its contractions never start a run, and a contraction never joins one
//   ("I'm Maria" gives "Maria"): they are capitalized mid-sentence and would recur.
// - Name titles stay in the run ("Padre Antônio"); a run that is only a title is the
//   caller's to drop (NamesPort.isKnownName answers true for it).
// `lang` null (the language off): no stop words and no joiners, so a run at a sentence
// start is always skipped.

import type { Markdown } from "./markdown";
import { foldName } from "./names";
import type { Sentence } from "./sentences";
import { normalizeWord, type StemLang } from "./stem";
import { isStopWord } from "./stem/stopwords";
import type { Token } from "./tokens";
import { readerMask } from "./wordcount";

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

const GAP = /^[ \t]+$/;
const HEADING = /^#{1,6} /;
/** English "I" and its contractions ("I'm", "I'll"): capitalized everywhere, never a name's first word. */
const PRONOUN_I = /^I(?:['’]\p{Ll}+)?$/u;
/** A contraction of "I" never joins a run either ("Maria I'm"); a bare "I" may end one ("Pedro I"). */
const PRONOUN_I_CONTRACTED = /^I['’]\p{Ll}+$/u;

function capitalized(w: string): boolean {
  const c = w[0];
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

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
  const joiners = lang ? NAME_JOINERS[lang] : [];
  // token indexes that start a sentence: the first token at or after each sentence's from
  const starts = new Set<number>();
  let t = 0;
  for (const s of sents) {
    while (t < toks.length && toks[t].from < s.from) t++;
    if (t < toks.length && toks[t].from < s.to) starts.add(t);
  }
  const out: NameRun[] = [];
  let i = 0;
  while (i < toks.length) {
    if (!capitalized(toks[i].text) || PRONOUN_I.test(toks[i].text)) { i++; continue; }
    // extend the run: first..last are token indexes of capitalized words (joiners between)
    let last = i;
    for (;;) {
      const a = toks[last];
      const b = toks[last + 1];
      if (!b || !GAP.test(mask.slice(a.to, b.from))) break;
      if (capitalized(b.text) && !PRONOUN_I_CONTRACTED.test(b.text)) { last += 1; continue; }
      const c = toks[last + 2];
      if (c && joiners.includes(b.text) && capitalized(c.text) && GAP.test(mask.slice(b.to, c.from))) { last += 2; continue; }
      break;
    }
    let first = i;
    i = last + 1;
    if (starts.has(first)) {
      // a name that starts a sentence loses a leading stop word; otherwise the run is skipped
      if (!lang || !isStopWord(normalizeWord(toks[first].text), lang)) continue;
      first += 1;
      if (first > last) continue;
      if (!capitalized(toks[first].text)) first += 1;   // a joiner can't lead
      if (first > last) continue;
    }
    if (first === last && toks[first].text.length < 2) continue;
    const words: string[] = [];
    for (let k = first; k <= last; k++) words.push(toks[k].text);
    const text = words.join(" ");
    out.push({ from: toks[first].from, to: toks[last].to, text, key: foldName(text) });
  }
  return out;
}

/**
 * The mask the `universe-names` index reads: core/wordcount readerMask with heading
 * lines and `$$` blocks blanked, the same text the lens reads with "Skip quotations"
 * off (lens/analyze readMask). Frontmatter, code, comments and markup are blank already.
 */
export function namesMask(md: Markdown): string {
  const s = readerMask(md);
  const masked = md.masked();
  const parts: string[] = [];
  let at = 0;
  for (let i = md.bodyLine; i < md.lineCount; i++) {
    const a = md.lineStart(i);
    const b = md.lineEnd(i);
    const prose = md.startsIn(i) === "prose";
    if ((prose && HEADING.test(md.text.slice(a, b))) || md.inMath(i) || masked.slice(a, b).includes("$$")) {
      parts.push(s.slice(at, a), " ".repeat(b - a));
      at = b;
    }
  }
  if (at === 0) return s;
  parts.push(s.slice(at));
  return parts.join("");
}
