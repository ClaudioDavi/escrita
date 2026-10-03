// Word rules of the revision lens (0.5 plan Q12, Q13, Q16-Q18, Q20): adverbs, gerunds,
// crutch phrases and long sentences. Pure: no obsidian or CodeMirror imports, no i18n.
// Rules take the tokens and sentences built once per pass and return matches carrying
// their rule id even when the rule is off; `analyze` filters.
//
// A match over several words (a construction, a sentence) has no source text here, so
// its `text` is the words joined by single spaces; offsets are always exact.

import { findPhrase, tokens, type Token } from "../core/tokens";
import { normalizeWord } from "../core/stem";
import { splitClitic } from "../core/stem/pt";
import type { Sentence } from "../core/sentences";
import type { Lexicon, Match, RuleOptions } from "./types";

const UPPER = /^\p{Lu}/u;

/** The words `Ignorar` lists, normalized (NFC, case-folded, never accent-folded, Q12). */
function ignoreSet(o: RuleOptions): Set<string> {
  const out = new Set<string>();
  for (const e of o.lists.ignore) {
    const n = normalizeWord(e).trim();
    if (n) out.add(n);
  }
  return out;
}

/** Every word of every listed name, plus the whole entry, normalized. */
function nameSet(o: RuleOptions): Set<string> {
  const out = new Set<string>();
  for (const e of o.lists.names) {
    const whole = normalizeWord(e).trim();
    if (whole) out.add(whole);
    for (const t of tokens(e)) out.add(normalizeWord(t.text));
  }
  return out;
}

interface Layout {
  /** Sentence index of each token (-1 when there are no sentences). */
  sent: Int32Array;
  /** First token of its sentence. */
  first: boolean[];
}

function layout(toks: readonly Token[], sents: readonly Sentence[]): Layout {
  const sent = new Int32Array(toks.length).fill(-1);
  const first = new Array<boolean>(toks.length).fill(false);
  let s = 0;
  let last = -2;
  for (let i = 0; i < toks.length; i++) {
    while (s < sents.length - 1 && toks[i].from >= sents[s].to) s++;
    const idx = sents.length ? s : -1;
    sent[i] = idx;
    first[i] = idx !== last;
    last = idx;
  }
  if (!sents.length && toks.length) first[0] = true;
  return { sent, first };
}

function span(toks: readonly Token[], i: number, j: number): { from: number; to: number; text: string } {
  const text = i === j ? toks[i].text : toks.slice(i, j + 1).map((t) => t.text).join(" ");
  return { from: toks[i].from, to: toks[j].to, text };
}

/**
 * Words the note itself shows to be names: capitalized somewhere in mid-sentence.
 * A sentence-initial *Fernando* is then a name too, with no list to keep (rule 3).
 */
export function inferredNames(toks: readonly Token[], sents: readonly Sentence[]): Set<string> {
  const lay = layout(toks, sents);
  const out = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    if (isMidSentenceCapital(toks[i], lay.first[i])) out.add(normalizeWord(toks[i].text));
  }
  return out;
}

/** Names look like capitalized words in mid-sentence; they are not the rules' business. */
function isMidSentenceCapital(t: Token, initial: boolean): boolean {
  return !initial && UPPER.test(t.text);
}

const ADVERB_MENTE_MIN = 3;
const ADVERB_LY_MIN_LENGTH = 5;

export function adverbs(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions, lex: Lexicon): Match[] {
  const out: Match[] = [];
  if (!o.lang) return out;
  const lay = layout(toks, sents);
  const ignore = ignoreSet(o);
  const exceptions = new Set(lex.adverbExceptions);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const norm = normalizeWord(t.text);
    let hit = false;
    if (o.lang === "pt-BR") {
      const base = splitClitic(norm).base;
      hit =
        base.endsWith("mente") &&
        [...base.slice(0, -5)].length >= ADVERB_MENTE_MIN &&
        !exceptions.has(base) &&
        !ignore.has(base);
    } else {
      hit = [...norm].length >= ADVERB_LY_MIN_LENGTH && norm.endsWith("ly") && !exceptions.has(norm);
    }
    if (!hit || ignore.has(norm) || isMidSentenceCapital(t, lay.first[i])) continue;
    out.push({ rule: "adverb", kind: "base", from: t.from, to: t.to, text: t.text });
  }
  return out;
}

const GERUND_SUFFIX = /(?:ando|endo|indo)$/;
const GAP = 1; // gerundismo: at most one word between the parts

export function gerunds(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions, lex: Lexicon): Match[] {
  const out: Match[] = [];
  if (!o.lang) return out;
  const lay = layout(toks, sents);
  const ignore = ignoreSet(o);
  if (o.lang === "en") {
    const started = new Set(lex.startedForms);
    for (let i = 0; i + 2 < toks.length; i++) {
      const n0 = normalizeWord(toks[i].text);
      if (!started.has(n0) || ignore.has(n0)) continue;
      if (normalizeWord(toks[i + 1].text) !== "to") continue;
      if (lay.sent[i] !== lay.sent[i + 2]) continue;
      out.push({ rule: "gerund", kind: "started", ...span(toks, i, i + 2) });
    }
    return out;
  }

  const names = nameSet(o);
  const seenNames = inferredNames(toks, sents);
  const exceptions = new Set(lex.gerundExceptions);
  const ir = new Set(lex.irForms);
  const estar = new Set(lex.estarForms);
  const isGerund = new Array<boolean>(toks.length).fill(false);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const norm = normalizeWord(t.text);
    const base = splitClitic(norm).base;
    if (!GERUND_SUFFIX.test(base) || [...base].length <= 4) continue;
    if (exceptions.has(base) || ignore.has(base) || ignore.has(norm)) continue;
    if (names.has(norm) || names.has(base)) continue;
    if (isMidSentenceCapital(t, lay.first[i])) continue;
    if (UPPER.test(t.text) && seenNames.has(norm)) continue;
    isGerund[i] = true;
    out.push({ rule: "gerund", kind: "base", from: t.from, to: t.to, text: t.text });
  }

  // gerundismo: ir + estar + gerund, one sentence, at most one word between the parts
  for (let i = 0; i < toks.length; i++) {
    if (!ir.has(normalizeWord(toks[i].text))) continue;
    let found = -1;
    for (let a = 0; a <= GAP && found < 0; a++) {
      const e = i + 1 + a;
      if (e >= toks.length || lay.sent[e] !== lay.sent[i]) break;
      if (!estar.has(normalizeWord(toks[e].text))) continue;
      for (let b = 0; b <= GAP; b++) {
        const g = e + 1 + b;
        if (g >= toks.length || lay.sent[g] !== lay.sent[i]) break;
        if (isGerund[g]) { found = g; break; }
      }
    }
    if (found >= 0) out.push({ rule: "gerund", kind: "gerundismo", ...span(toks, i, found) });
  }

  // chains: a sentence with 3 or more base gerunds
  const CHAIN = 3;
  const per = new Map<number, number>();
  for (let i = 0; i < toks.length; i++) {
    if (isGerund[i] && lay.sent[i] >= 0) per.set(lay.sent[i], (per.get(lay.sent[i]) ?? 0) + 1);
  }
  for (const [si, n] of per) {
    if (n < CHAIN) continue;
    const s = sents[si];
    const inside: number[] = [];
    for (let i = 0; i < toks.length; i++) if (lay.sent[i] === si) inside.push(i);
    out.push({
      rule: "gerund",
      kind: "chain",
      from: s.from,
      to: s.to,
      text: inside.map((i) => toks[i].text).join(" "),
    });
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Exact phrases, whole words, case-insensitive; `Ignorar` does not apply (Q12, Q13). */
export function crutches(toks: readonly Token[], mask: string, o: RuleOptions): Match[] {
  const out: Match[] = [];
  const seen = new Set<string>();
  for (const entry of o.lists.crutch) {
    const phrase = tokens(entry.normalize("NFC")).map((t) => normalizeWord(t.text));
    const key = phrase.join(" ");
    if (!phrase.length || seen.has(key)) continue;
    seen.add(key);
    for (const { i, j } of findPhrase(toks, phrase, normalizeWord)) {
      // an exact phrase: only whitespace (and emphasis marks, which the mask keeps) may lie between its words, never punctuation
      let ok = true;
      for (let k = i + 1; k <= j && ok; k++) ok = /^[\s*_~=]+$/.test(mask.slice(toks[k - 1].to, toks[k].from));
      if (!ok) continue;
      out.push({ rule: "crutch", kind: "base", ...span(toks, i, j) });
    }
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** More than `longSentence` words, dialogue included; one match per sentence (Q20). */
export function longSentences(toks: readonly Token[], sents: readonly Sentence[], o: RuleOptions): Match[] {
  const out: Match[] = [];
  const lay = layout(toks, sents);
  const counts = new Map<number, number[]>();
  for (let i = 0; i < toks.length; i++) {
    const s = lay.sent[i];
    if (s < 0) continue;
    const arr = counts.get(s);
    if (arr) arr.push(i); else counts.set(s, [i]);
  }
  for (const [si, idx] of counts) {
    if (idx.length <= o.longSentence) continue;
    out.push({
      rule: "long",
      kind: "base",
      from: sents[si].from,
      to: sents[si].to,
      text: idx.map((i) => toks[i].text).join(" "),
    });
  }
  return out.sort((a, b) => a.from - b.from);
}
