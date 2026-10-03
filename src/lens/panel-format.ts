// Small pure helpers for the lens panel (task 4.2). No obsidian imports.

import type { Match, RuleId } from "./types";

/** A rate per 1,000 words with exactly one decimal, in the reader's locale: 2.4 -> "2,4" (pt-BR), "2.4" (en). */
export function formatRate(n: number, locale: string): string {
  return n.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

/**
 * Where a selection sits among the matches of one rule: the 1-based position and the total,
 * or null when no match of that rule touches the selection.
 */
export function positionOf(
  matches: readonly Match[],
  rule: RuleId,
  from: number,
  to: number,
): { n: number; of: number } | null {
  const own = matches.filter((m) => m.rule === rule).sort((a, b) => a.from - b.from || a.to - b.to);
  const i = own.findIndex((m) => m.from <= to && m.to >= from);
  return i < 0 ? null : { n: i + 1, of: own.length };
}

/** Share of speech as a whole percentage; 0 when there are no words. */
export function sharePercent(speech: number, words: number): number {
  if (!(words > 0)) return 0;
  return Math.round((speech / words) * 100);
}

/** The note's name from its path: folders and the .md extension dropped. */
export function noteName(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  return base.replace(/\.md$/i, "");
}
