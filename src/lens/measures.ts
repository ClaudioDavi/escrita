// Measures for the revision lens (task 2.3): dialogue share, scenes, sentences,
// syllables, readability. Pure: no obsidian or CodeMirror imports.
//
// `passExtras` builds the speech ranges and per-token syllables once per pass;
// `measures` then slices the pass for the whole note or for a range and never
// re-reads the note (Q22).

import type { Markdown } from "../core/markdown";
import { isSceneBreakAt } from "../core/markers";
import type { Token } from "../core/tokens";
import { dialogueInDoc } from "../core/dialogue";
import { readability } from "./readability";
import { syllables } from "./syllables";
import type { LensLang, LensPass, Measures, ReadOptions, SceneShare } from "./types";

type Opts = ReadOptions & { lang: LensLang | null };
type Span = { from: number; to: number };

/** Builds the pass's speech ranges and per-token syllables once. */
export function passExtras(md: Markdown, toks: readonly Token[], o: Opts): Pick<LensPass, "speech" | "syllables"> {
  const speech = md.lineCount === 0
    ? []
    : dialogueInDoc(md, 0, md.lineCount - 1, { quoteStyle: o.quoteStyle, paragraphStyle: o.paragraphStyle });
  const syl = new Uint16Array(toks.length);
  if (o.lang) for (let i = 0; i < toks.length; i++) syl[i] = syllables(toks[i].text, o.lang);
  return { speech, syllables: syl };
}

/** First index in `a` whose key is >= `x`. */
function lowerBound<T>(a: readonly T[], x: number, key: (v: T) => number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(a[mid]) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Whole note, or a range by binary search over the pass; never re-reads the note. */
export function measures(md: Markdown, pass: LensPass, o: Opts, range?: Span): Measures {
  const whole = measureRange(pass, o, range);
  if (range) return { ...whole, scenes: [] };
  const scenes: SceneShare[] = [];
  for (const b of sceneBounds(md)) {
    const m = measureRange(pass, o, b);
    if (m.words > 0) scenes.push({ from: b.from, to: b.to, words: m.words, speech: m.speech });
  }
  return { ...whole, scenes: scenes.length > 1 ? scenes : [] };
}

function measureRange(pass: LensPass, o: Opts, range?: Span): Measures {
  const toks = pass.tokens;
  const first = range ? lowerBound(toks, range.from, (t) => t.from) : 0;
  let end = first;
  let words = 0;
  let speech = 0;
  let syl = 0;
  let s = range ? lowerBound(pass.speech, first < toks.length ? toks[first].from : Infinity, (r) => r.to + 1) : 0;
  for (; end < toks.length; end++) {
    const t = toks[end];
    if (range && t.to > range.to) break;
    words++;
    syl += pass.syllables[end] ?? 0;
    while (s < pass.speech.length && pass.speech[s].to < t.to) s++;
    if (s < pass.speech.length && pass.speech[s].from <= t.from) speech++;
  }
  let sentences = 0;
  if (!range) sentences = pass.sentences.length;
  else {
    for (let k = lowerBound(pass.sentences, range.from + 1, (x) => x.to); k < pass.sentences.length; k++) {
      if (pass.sentences[k].from >= range.to) break;
      sentences++;
    }
  }
  const sylTotal = o.lang ? syl : 0;
  return {
    words,
    speech: Math.min(speech, words),
    scenes: [],
    sentences,
    syllables: sylTotal,
    readability: o.lang ? readability(words, sentences, sylTotal, o.lang) : null,
  };
}

/** Scene ranges of the body, split at scene breaks (isSceneBreakAt). Break lines belong to no scene. */
export function sceneBounds(md: Markdown): { from: number; to: number }[] {
  const out: Span[] = [];
  const n = md.lineCount;
  if (n === 0) return out;
  const body = md.bodyLine;
  let startLine = body;
  const close = (endLine: number): void => {
    if (endLine < startLine) return;
    out.push({ from: md.lineStart(startLine), to: md.lineEnd(endLine) });
  };
  for (let i = body; i < n; i++) {
    if (isSceneBreakAt(md, i, body)) {
      close(i - 1);
      startLine = i + 1;
    }
  }
  close(n - 1);
  return out;
}
