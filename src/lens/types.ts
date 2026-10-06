// Shared types of the revision lens (0.5). Pure: no obsidian or CodeMirror imports.

import type { ParagraphStyle, QuoteStyle } from "../settings";
import type { Sentence } from "../core/sentences";
import type { Token } from "../core/tokens";

export type { Sentence } from "../core/sentences";

export type LensLang = "pt-BR" | "en";
/** The rules that are on unless switched off (`lensRulesOff`), in rule order. */
export const RULES = ["echo", "adverb", "gerund", "crutch", "name", "long"] as const;
/**
 * The rules that are off unless switched on (`lensRulesOn`; 0.9). `newName`: names without
 * an entry (U 2.5, PLAN-0.9 Q2-Q4), in lens/rules-names.ts. Kept apart from RULES so a new
 * opt-in rule changes no existing output: it has a count, a row and a mark only while on.
 */
export const OPT_IN_RULES = ["newName"] as const;
export type DefaultRuleId = typeof RULES[number];
export type OptInRuleId = typeof OPT_IN_RULES[number];
export type RuleId = DefaultRuleId | OptInRuleId;
/** Every rule, in rule order: RULES, then OPT_IN_RULES (matches sort by this order). */
export const ALL_RULES: readonly RuleId[] = [...RULES, ...OPT_IN_RULES];
export function isOptIn(rule: RuleId): rule is OptInRuleId {
  return (OPT_IN_RULES as readonly string[]).includes(rule);
}
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
/**
 * What the `newName` rule asks the world, bound to the note being read (0.9, Q18). The
 * lens builds it from the names port (plugin.names) and never imports the universe.
 */
export interface NameQuery {
  /** NamesPort.isKnownName for this note: an entry's name or alias, or a name title */
  known(text: string): boolean;
  /** NamesPort.workCount for this note: the works of the scope the run appears in; 0 while unknown */
  works(text: string): number;
}
export interface NewNameOptions {
  query: NameQuery;
  /** the "Not names" setting, parsed: words and runs never marked (Q4) */
  notNames: readonly string[];
}
export interface RuleOptions {
  lang: LensLang | null;                 // null: language rules off (Q8)
  rules: ReadonlySet<RuleId>;
  echoWindow: number;
  longSentence: number;
  lists: Lists;
  /** the `newName` rule's inputs; absent (the universe off, or the rule off): the rule finds nothing */
  newName?: NewNameOptions;
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
  /** a count for every default rule; an opt-in rule has one only when it was on for the pass */
  counts: Record<DefaultRuleId, number> & Partial<Record<OptInRuleId, number>>;
  words: number;                 // denominator for rates
  measures: Measures;            // whole note
  pass: LensPass;
}
export interface Dismissal { rule: RuleId; text: string; before: string; after: string }
