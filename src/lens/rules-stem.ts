// Stem-based rules of the revision lens: echoes and name variants (0.5 plan Q15, Q19).
// Pure: no obsidian or CodeMirror imports. Matches carry the rule id even when the
// rule is off; `analyze` filters.

import { normalizeWord, stem } from "../core/stem";
import { isStopWord } from "../core/stem/stopwords";
import type { StemLang } from "../core/stem";
import type { Token } from "../core/tokens";
import { stemLang } from "./lang";
import type { Match, RuleOptions } from "./types";

const HAS_LETTER = /\p{L}/u;
const MIN_ECHO_TOKEN = 4;
const MIN_ECHO_STEM = 3;

/** Words of a list entry, normalized (a multi-word name contributes each word). */
function listWords(entries: readonly string[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    for (const w of e.split(/\s+/)) {
      if (w && HAS_LETTER.test(w)) out.push(normalizeWord(w));
    }
  }
  return out;
}

/**
 * Later occurrences of the same word (by its "word" stem) within `echoWindow` words.
 * `breaks` are document offsets (scene breaks, headings) that reset the window.
 * `seenNames` are words the note shows to be names (`inferredNames`); a name repeats
 * by nature, so its capitalized occurrences are never echoes.
 */
export function echoes(
  toks: readonly Token[], breaks: readonly number[], o: RuleOptions,
  seenNames: ReadonlySet<string> = new Set(),
): Match[] {
  if (o.lang === null) return [];
  const lang = stemLang(o.lang);
  const sortedBreaks = [...breaks].sort((a, b) => a - b);
  const ignore = new Set<string>();
  for (const w of listWords(o.lists.ignore)) {
    ignore.add(w);
    ignore.add(stem(w, lang, "word"));
  }
  const names = new Set<string>();
  for (const w of listWords(o.lists.names)) {
    names.add(w);
    names.add(stem(w, lang, "name"));
  }

  const out: Match[] = [];
  const last = new Map<string, { i: number; seg: number }>();
  let seg = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    while (seg < sortedBreaks.length && sortedBreaks[seg] <= t.from) seg++;
    if (t.text.length < MIN_ECHO_TOKEN || !HAS_LETTER.test(t.text)) continue;
    const norm = normalizeWord(t.text);
    if (isStopWord(norm, lang) || ignore.has(norm) || names.has(norm)) continue;
    if (seenNames.has(norm) && /^\p{Lu}/u.test(t.text)) continue;
    const key = stem(t.text, lang, "word");
    if (key.length < MIN_ECHO_STEM || ignore.has(key)) continue;
    if (names.has(stem(t.text, lang, "name"))) continue;
    const prev = last.get(key);
    if (prev && prev.seg === seg && i - prev.i <= o.echoWindow) {
      const p = toks[prev.i];
      out.push({
        rule: "echo", kind: "base", from: t.from, to: t.to, text: t.text,
        related: { from: p.from, to: p.to },
      });
    }
    last.set(key, { i, seg });
  }
  return out;
}

/** Damerau-Levenshtein (adjacent transpositions), exits early: returns max + 1 past max. */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const over = max + 1;
  if (Math.abs(a.length - b.length) > max) return over;
  if (a.length === 0) return b.length > max ? over : b.length;
  if (b.length === 0) return a.length > max ? over : a.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return over;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] > max ? over : prev[b.length];
}

function adjacentSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (i >= a.length - 1) return false;
  return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
}

/** `longer` is `shorter` with one letter doubled. */
function oneDoubled(longer: string, shorter: string): boolean {
  if (longer.length !== shorter.length + 1) return false;
  for (let i = 0; i < longer.length - 1; i++) {
    if (longer[i] === longer[i + 1] && longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  }
  return false;
}

/**
 * Is `word` a near miss of `name` (a typo of it, not another name)? Case-folded.
 * Limits by the name's length: 3 letters or fewer, only a transposition or a doubled or
 * undoubled letter; 4-5, distance 1; 6 or more, distance 2. The same word is not close.
 */
export function closeToName(word: string, name: string): boolean {
  const w = normalizeWord(word);
  const n = normalizeWord(name);
  if (w === n) return false;
  const len = Array.from(n).length;
  if (len <= 3) return adjacentSwap(w, n) || oneDoubled(w, n) || oneDoubled(n, w);
  const max = len <= 5 ? 1 : 2;
  return editDistance(w, n, max) <= max;
}

function isCapitalized(s: string): boolean {
  const c = s[0];
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

/**
 * Capitalized words that look like a listed name misspelled. The listed names come
 * from `o.lists.names`; the rule never reads the list note. Without a language the
 * "name" stem is plain `normalizeWord`.
 */
export function nameVariants(toks: readonly Token[], sentStarts: ReadonlySet<number>, o: RuleOptions): Match[] {
  const names = [...new Set(listWords(o.lists.names))].filter((w) => Array.from(w).length >= 2);
  if (names.length === 0) return [];
  const lang: StemLang | null = o.lang === null ? null : stemLang(o.lang);
  const key = (w: string): string => (lang ? stem(w, lang, "name") : normalizeWord(w));
  const nameSet = new Set(names);
  const nameKeys = new Set(names.map(key));
  const ignore = new Set(listWords(o.lists.ignore));

  const lowered = new Set<string>();
  for (const t of toks) {
    if (!isCapitalized(t.text)) lowered.add(normalizeWord(t.text));
  }

  const verdict = new Map<string, boolean>();
  const out: Match[] = [];
  for (const t of toks) {
    if (!HAS_LETTER.test(t.text) || !isCapitalized(t.text)) continue;
    const norm = normalizeWord(t.text);
    let flag = verdict.get(norm);
    if (flag === undefined) {
      flag = false;
      if (
        !nameSet.has(norm) && !ignore.has(norm) && !(lang && isStopWord(norm, lang)) &&
        !nameKeys.has(key(t.text)) && !lowered.has(norm)
      ) {
        flag = names.some((n) => closeToName(norm, n));
      }
      verdict.set(norm, flag);
    }
    if (flag) out.push({ rule: "name", kind: "base", from: t.from, to: t.to, text: t.text });
  }
  void sentStarts;
  return out;
}
