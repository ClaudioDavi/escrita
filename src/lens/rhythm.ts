// The rhythm of a paragraph's sentences (SF 16, PLAN-1.2 Q17): one bar per sentence, the
// runs of sentences of about the same length, and the long ones. Pure: no obsidian or
// CodeMirror imports. It reads the pass's `sentenceWords` and `sentencePara` (Q18).

import type { LensPass } from "./types";

/** A run is this many sentences in a row... */
export const RUN_MIN = 3;
/** ...whose longest and shortest differ by at most this many words. */
export const RUN_SPREAD = 3;

export interface RhythmBar {
  from: number;
  to: number;
  words: number;
  /** part of a run */
  run: boolean;
  /** more than `longSentence` words */
  long: boolean;
}

export interface Rhythm {
  /** the paragraph at the cursor, or the sentences a selection touches */
  scope: "paragraph" | "selection";
  bars: RhythmBar[];
  /** the sentences in the longest run; 0 when there is none */
  runLength: number;
  hasLong: boolean;
}

type PassSlice = Pick<LensPass, "sentences" | "sentenceWords" | "sentencePara">;

/** Marks the maximal runs, taken greedily from the left; returns the longest one's length. */
function markRuns(bars: RhythmBar[]): number {
  let longest = 0;
  let i = 0;
  while (i < bars.length) {
    let lo = bars[i].words;
    let hi = lo;
    let j = i;
    while (j + 1 < bars.length) {
      const w = bars[j + 1].words;
      if (Math.max(hi, w) - Math.min(lo, w) > RUN_SPREAD) break;
      lo = Math.min(lo, w);
      hi = Math.max(hi, w);
      j++;
    }
    const len = j - i + 1;
    if (len >= RUN_MIN) {
      for (let k = i; k <= j; k++) bars[k].run = true;
      longest = Math.max(longest, len);
      i = j + 1;
    } else i++;
  }
  return longest;
}

/** The index of the sentence the offset belongs to (its text, or the gap inside its paragraph), or -1. */
function sentenceAt(pass: PassSlice, at: number): number {
  const s = pass.sentences;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid].from <= at) lo = mid + 1;
    else hi = mid;
  }
  const i = lo - 1;
  if (i < 0) return -1;
  if (at <= s[i].to) return i;
  // in the gap after sentence i: inside the paragraph only when the next sentence is in it too
  return i + 1 < s.length && pass.sentencePara[i + 1] === pass.sentencePara[i] ? i : -1;
}

/**
 * The rhythm for a cursor (`from === to`: the paragraph it is in) or a selection (the
 * sentences it overlaps). Null when the cursor is not in a paragraph or the selection
 * touches no sentence.
 */
export function rhythmAt(pass: PassSlice, range: { from: number; to: number }, longSentence: number): Rhythm | null {
  const s = pass.sentences;
  let first = -1;
  let last = -1;
  let scope: Rhythm["scope"];
  if (range.to > range.from) {
    scope = "selection";
    for (let i = 0; i < s.length; i++) {
      if (s[i].from >= range.to) break;
      if (s[i].to > range.from) {
        if (first < 0) first = i;
        last = i;
      }
    }
  } else {
    scope = "paragraph";
    const at = sentenceAt(pass, range.from);
    if (at >= 0) {
      const para = pass.sentencePara[at];
      first = last = at;
      while (first > 0 && pass.sentencePara[first - 1] === para) first--;
      while (last + 1 < s.length && pass.sentencePara[last + 1] === para) last++;
    }
  }
  if (first < 0) return null;
  const bars: RhythmBar[] = [];
  for (let i = first; i <= last; i++) {
    const words = pass.sentenceWords[i];
    bars.push({ from: s[i].from, to: s[i].to, words, run: false, long: words > longSentence });
  }
  const runLength = markRuns(bars);
  return { scope, bars, runLength, hasLong: bars.some((b) => b.long) };
}
