// One pass over a note: mask, tokens, sentences, rules, measures. Pure: no obsidian or
// CodeMirror imports. The caller applies dismissals (dismiss.ts), so a dismissal never
// needs a recompute.

import type { Markdown } from "../core/markdown";
import { isSceneBreakLine } from "../core/markers";
import { sentences } from "../core/sentences";
import { tokens } from "../core/tokens";
import { readMask } from "../core/wordcount";
import { stemLang } from "./lang";
import { LEXICON } from "./lexicon";
import { measures, passExtras } from "./measures";
import { echoes, nameVariants } from "./rules-stem";
import { adverbs, crutches, gerunds, inferredNames, longSentences } from "./rules-words";
import { newNames } from "./rules-names";
import { ALL_RULES, LANG_RULES, OPT_IN_RULES, RULES, type LensPass, type LensResult, type Match, type Measures, type ReadOptions, type RuleId, type RuleOptions } from "./types";

export interface AnalyzeOptions extends RuleOptions, ReadOptions {}

const HEADING = /^#{1,6} /;
const RULE_ORDER: Record<RuleId, number> = Object.fromEntries(ALL_RULES.map((r, i) => [r, i])) as Record<RuleId, number>;

/** Offsets that reset the echo window: scene breaks and headings. */
function windowBreaks(md: Markdown): number[] {
  const out: number[] = [];
  for (let i = md.bodyLine; i < md.lineCount; i++) {
    if (isSceneBreakLine(md, i)) out.push(md.lineStart(i));
    else if (md.startsIn(i) === "prose" && HEADING.test(md.text.slice(md.lineStart(i), md.lineEnd(i)))) out.push(md.lineStart(i));
  }
  return out;
}

export function analyze(md: Markdown, o: AnalyzeOptions, version = 0): LensResult {
  const mask = readMask(md, o);
  const toks = tokens(mask);
  const sents = sentences(mask, md, o.lang ? stemLang(o.lang) : null);
  const pass: LensPass = { mask, tokens: toks, sentences: sents, ...passExtras(md, toks, o) };

  const on = (r: RuleId): boolean => o.rules.has(r) && (o.lang !== null || !LANG_RULES.has(r));
  const lex = o.lang ? LEXICON[o.lang] : null;
  let matches: Match[] = [];
  if (on("echo")) matches = matches.concat(echoes(toks, windowBreaks(md), o, inferredNames(toks, sents)));
  if (on("adverb") && lex) matches = matches.concat(adverbs(toks, sents, o, lex));
  if (on("gerund") && lex) matches = matches.concat(gerunds(toks, sents, o, lex));
  if (on("crutch")) matches = matches.concat(crutches(toks, mask, o));
  if (on("name")) matches = matches.concat(nameVariants(toks, new Set<number>(), o));
  if (on("long")) matches = matches.concat(longSentences(toks, sents, o));
  if (on("newName")) matches = matches.concat(newNames(toks, sents, mask, o));
  matches.sort((a, b) => a.from - b.from || RULE_ORDER[a.rule] - RULE_ORDER[b.rule] || a.to - b.to);

  // an opt-in rule has a count only when it was on, so turning none on changes no output
  const counted = [...RULES, ...OPT_IN_RULES.filter((r) => on(r))];
  const counts = Object.fromEntries(counted.map((r) => [r, 0])) as Record<RuleId, number>;
  for (const m of matches) counts[m.rule]++;
  return { version, matches, counts, words: toks.length, measures: measures(md, pass, o), pass };
}

export function measuresFor(
  pass: LensPass,
  md: Markdown,
  o: AnalyzeOptions,
  range: { from: number; to: number },
): Measures {
  return measures(md, pass, o, range);
}

const longest = new WeakMap<readonly Match[], number>();

/** Matches overlapping [from, to), by binary search over the sorted matches. */
export function visible(matches: readonly Match[], from: number, to: number): Match[] {
  let max = longest.get(matches);
  if (max === undefined) {
    max = 0;
    for (const m of matches) max = Math.max(max, m.to - m.from);
    longest.set(matches, max);
  }
  // first match starting at or after `to`; none after it overlaps
  let hi = matches.length;
  let lo = 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (matches[mid].from < to) lo = mid + 1;
    else hi = mid;
  }
  const out: Match[] = [];
  for (let i = lo - 1; i >= 0 && matches[i].from + max > from; i--) {
    if (matches[i].to > from) out.push(matches[i]);
  }
  return out.reverse();
}
