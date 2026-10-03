// Shared types of the revision lens (0.5). Pure: no obsidian or CodeMirror imports.

import type { ParagraphStyle, QuoteStyle } from "../settings";
import type { Sentence } from "../core/sentences";
import type { Token } from "../core/tokens";

export type { Sentence } from "../core/sentences";

export type LensLang = "pt-BR" | "en";
export const RULES = ["echo", "adverb", "gerund", "crutch", "name", "long"] as const;
export type RuleId = typeof RULES[number];
/** Rules and measures that need a language; off when lensLang gives null (Q8). */
export const LANG_RULES: ReadonlySet<RuleId> = new Set<RuleId>(["echo", "adverb", "gerund"]);

export type MatchKind = "base" | "gerundismo" | "chain" | "started";
export interface Match {
  rule: RuleId;
  kind: MatchKind;
  from: number; to: number;        // document offsets
  text: string;                    // the matched text as written
  related?: { from: number; to: number };  // echoes: the earlier occurrence
}
export interface Lists { crutch: string[]; names: string[]; ignore: string[] }
export interface Lexicon {
  adverbExceptions: readonly string[];
  gerundExceptions: readonly string[];   // pt only; [] for en
  irForms: readonly string[];            // pt gerundismo auxiliaries: forms of ir only (Q18)
  estarForms: readonly string[];
  startedForms: readonly string[];       // en
}
export interface RuleOptions {
  lang: LensLang | null;                 // null: language rules off (Q8)
  rules: ReadonlySet<RuleId>;
  echoWindow: number;
  longSentence: number;
  lists: Lists;
}
export interface ReadOptions {           // what the lens reads
  skipQuotes: boolean;
  quoteStyle: QuoteStyle;
  paragraphStyle: ParagraphStyle;
}
export interface SceneShare { from: number; to: number; words: number; speech: number }
/** band is a code ("veryEasy", "easy", ...), translated by the view. */
export interface Readability { asl: number; asw: number; raw: number; score: number; band: string }
export interface Measures {
  words: number;                 // words the lens read in the range
  speech: number;
  scenes: SceneShare[];          // [] when one scene
  sentences: number;
  syllables: number;
  readability: Readability | null;  // null under 100 words or 3 sentences, or with no language
}
/** One pass's intermediates, kept so selection measures slice them (Q22). */
export interface LensPass {
  mask: string;
  tokens: readonly Token[];
  sentences: readonly Sentence[];
  speech: readonly { from: number; to: number }[];   // dialogue ranges, sorted
  syllables: Uint16Array;                             // per token, parallel to tokens
}
export interface LensResult {
  version: number;               // the session's per-path version it was computed for (2.5)
  matches: Match[];              // sorted by from, then rule order; dismissals not applied
  counts: Record<RuleId, number>;
  words: number;                 // denominator for rates
  measures: Measures;            // whole note
  pass: LensPass;
}
export interface Dismissal { rule: RuleId; text: string; before: string; after: string }
