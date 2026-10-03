// Pure helpers for the editor marks (4.1). No CodeMirror imports: positions come
// in as numbers and a mapping function, classes go out as strings.

import { visible } from "./analyze";
import type { Match } from "./types";

export type MapPos = (pos: number, assoc: -1 | 1) => number;

/**
 * Maps matches through a document change. A match whose range collapses (the text
 * under it was deleted) is dropped; so is an echo's `related` range when it collapses.
 */
export function mapMatches(matches: readonly Match[], mapPos: MapPos): Match[] {
  const out: Match[] = [];
  for (const m of matches) {
    const from = mapPos(m.from, 1);
    const to = mapPos(m.to, -1);
    if (to <= from) continue;
    let related: Match["related"];
    if (m.related) {
      const rf = mapPos(m.related.from, 1);
      const rt = mapPos(m.related.to, -1);
      if (rt > rf) related = { from: rf, to: rt };
    }
    const next: Match = { ...m, from, to };
    if (related) next.related = related; else delete next.related;
    out.push(next);
  }
  return out;
}

export interface MarkSpec { from: number; to: number; cls: string }

export const MARK_PREFIX = "escrita-lens-";
export const CURRENT_CLASS = MARK_PREFIX + "current";
export const RELATED_CLASS = MARK_PREFIX + "related";

export function sameMatch(a: Match | null | undefined, b: Match | null | undefined): boolean {
  return !!a && !!b && a.rule === b.rule && a.from === b.from && a.to === b.to;
}

/** One spec per range inside [from, to): the rule class, plus `current`, plus an echo's related range. */
export function markSpecs(
  matches: readonly Match[], current: Match | null, from: number, to: number,
): MarkSpec[] {
  const out: MarkSpec[] = [];
  for (const m of visible(matches, from, to)) {
    out.push({
      from: m.from, to: m.to,
      cls: MARK_PREFIX + m.rule + (sameMatch(m, current) ? " " + CURRENT_CLASS : ""),
    });
    if (m.rule === "echo" && m.related && m.related.to > from && m.related.from < to) {
      out.push({ from: m.related.from, to: m.related.to, cls: RELATED_CLASS });
    }
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}
