// Readability scores for the revision lens (Q26). Pure: no obsidian or CodeMirror imports.
//
// pt-BR: Martins et al. (1996), the Flesch formula adapted to Portuguese:
//   248.835 - 1.015 * ASL - 84.6 * ASW
// en: Flesch reading ease:
//   206.835 - 1.015 * ASL - 84.6 * ASW
// ASL is words per sentence, ASW is syllables per word.
//
// The shown score is clamped to 0-100; `raw` keeps the unclamped value. The band is a
// code ("veryEasy", "easy", ...) that the view translates. A score equal to a band's
// `min` belongs to that band (75 is "veryEasy" in pt-BR).

import type { LensLang, Readability } from "./types";

/** Bands from easiest to hardest. The first band whose `min` the score reaches wins. */
export const BANDS: Record<LensLang, readonly { min: number; band: string }[]> = {
  "pt-BR": [
    { min: 75, band: "veryEasy" },
    { min: 50, band: "easy" },
    { min: 25, band: "hard" },
    { min: 0, band: "veryHard" },
  ],
  en: [
    { min: 90, band: "veryEasy" },
    { min: 80, band: "easy" },
    { min: 70, band: "fairlyEasy" },
    { min: 60, band: "standard" },
    { min: 50, band: "fairlyHard" },
    { min: 30, band: "hard" },
    { min: 0, band: "veryHard" },
  ],
};

const BASE: Record<LensLang, number> = { "pt-BR": 248.835, en: 206.835 };

/** Below these the score is too noisy to show. */
export const MIN_WORDS = 100;
export const MIN_SENTENCES = 3;

/**
 * The band of a score. The panel shows the score rounded to a whole number, so the band
 * comes from that same whole number: 74.6 shows "75" and is a "75" band, never "74".
 */
export function bandOf(score: number, lang: LensLang): string {
  const bands = BANDS[lang];
  const shown = Math.round(score);
  return (bands.find((b) => shown >= b.min) ?? bands[bands.length - 1]).band;
}

export function readability(words: number, sentences: number, syllables: number, lang: LensLang): Readability | null {
  if (words < MIN_WORDS || sentences < MIN_SENTENCES) return null;
  const asl = words / sentences;
  const asw = syllables / words;
  const raw = BASE[lang] - 1.015 * asl - 84.6 * asw;
  const score = Math.min(100, Math.max(0, raw));
  return { asl, asw, raw, score, band: bandOf(score, lang) };
}
