// Name marks, the pure half (0.7 plan 4.4, Q37, Q38). Ranges mapped through edits, the
// paragraphs an edit touched, re-matching only those, and the visible slice. No CodeMirror
// and no Obsidian imports: the ViewPlugin in name-marks.ts feeds it.

import { capitalizedTerms, findNames, pickEntry, type Occurrence, type TermTable } from "../core/names";

export interface Range { from: number; to: number }

const markable = new WeakMap<TermTable, TermTable>();

/**
 * The table the marks match with (Q38): only the terms `capitalizedTerms` lists. A lowercase
 * alias ("o menino") counts as a mention elsewhere, but is never marked: its words are
 * ordinary words, and a mark would take the squiggle off a real misspelling.
 */
export function markableTable(table: TermTable): TermTable {
  let hit = markable.get(table);
  if (!hit) {
    const caps = new Set(capitalizedTerms(table));
    const terms = table.terms.filter((t) => caps.has(t.text));
    hit = terms.length === table.terms.length ? table : { ...table, terms, signature: `${table.signature}|caps` };
    markable.set(table, hit);
  }
  return hit;
}

/** Whether a table has anything to mark. */
export function hasMarks(table: TermTable): boolean {
  return capitalizedTerms(table).length > 0;
}

/** Marks as ranges of the occurrences, sorted. */
export function marksOf(occurrences: readonly Occurrence[]): Range[] {
  return occurrences.map((o) => ({ from: o.from, to: o.to })).sort((a, b) => a.from - b.from || a.to - b.to);
}

type MapPos = (pos: number, assoc: -1 | 1) => number;

/**
 * Marks through an edit. A mark keeps its edges (an edit right beside it doesn't widen it),
 * and one an edit emptied is dropped.
 */
export function mapMarks(marks: readonly Range[], map: MapPos): Range[] {
  const out: Range[] = [];
  for (const m of marks) {
    const from = map(m.from, 1);
    const to = map(m.to, -1);
    if (to > from) out.push({ from, to });
  }
  return out;
}

/** Dirty ranges through an edit; they keep their edges outward, so they never shrink to nothing. */
export function mapDirty(dirty: readonly Range[], map: MapPos): Range[] {
  return dirty.map((d) => ({ from: map(d.from, -1), to: map(d.to, 1) }));
}

/** The marks that fall inside [from, to], clipped to nothing: whole marks only. */
export function visibleMarks(marks: readonly Range[], windows: readonly Range[]): Range[] {
  const out: Range[] = [];
  for (const m of marks) {
    for (const w of windows) {
      if (m.to > w.from && m.from < w.to) {
        out.push(m);
        break;
      }
    }
  }
  return out;
}

const lineStart = (s: string, pos: number): number => s.lastIndexOf("\n", pos - 1) + 1;
const lineEnd = (s: string, pos: number): number => {
  const i = s.indexOf("\n", pos);
  return i < 0 ? s.length : i;
};
const blank = (s: string, from: number, to: number): boolean => /^\s*$/.test(s.slice(from, to));

/** The paragraph around `pos`: the run of non-blank lines of the mask. On a blank line, that line. */
export function paragraphAt(mask: string, pos: number): Range {
  const p = Math.max(0, Math.min(pos, mask.length));
  let from = lineStart(mask, p);
  let to = lineEnd(mask, p);
  if (blank(mask, from, to)) return { from, to };
  while (from > 0) {
    const prev = lineStart(mask, from - 1);
    if (blank(mask, prev, from - 1)) break;
    from = prev;
  }
  while (to < mask.length) {
    const next = lineEnd(mask, to + 1);
    if (blank(mask, to + 1, next)) break;
    to = next;
  }
  return { from, to };
}

/** The paragraphs the dirty ranges touch, merged and sorted. */
export function dirtyParagraphs(mask: string, dirty: readonly Range[]): Range[] {
  const ps: Range[] = [];
  for (const d of dirty) {
    const a = paragraphAt(mask, d.from);
    const b = paragraphAt(mask, Math.max(d.from, d.to));
    ps.push({ from: a.from, to: Math.max(a.to, b.to) });
  }
  ps.sort((x, y) => x.from - y.from);
  const out: Range[] = [];
  for (const p of ps) {
    const last = out[out.length - 1];
    if (last && p.from <= last.to) last.to = Math.max(last.to, p.to);
    else out.push({ ...p });
  }
  return out;
}

/**
 * Re-matches only the paragraphs the dirty ranges touch: marks inside them go, `find` (the
 * matcher, over a slice) fills them again. Everything else is kept as it is.
 */
export function rematch(
  marks: readonly Range[],
  mask: string,
  dirty: readonly Range[],
  find: (from: number, to: number) => readonly Occurrence[],
): Range[] {
  const ps = dirtyParagraphs(mask, dirty);
  if (ps.length === 0) return [...marks];
  const kept = marks.filter((m) => !ps.some((p) => m.to > p.from && m.from < p.to));
  const added: Range[] = [];
  for (const p of ps) added.push(...marksOf(find(p.from, p.to)));
  return [...kept, ...added].sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The mark that holds `pos` (edges: from is in, to is out), or null. */
export function markAt(marks: readonly Range[], pos: number): Range | null {
  for (const m of marks) {
    if (m.from > pos) break;
    if (pos < m.to) return m;
  }
  return null;
}

/**
 * The entry a marked name stands for: the text of one mark, matched alone against the note's
 * table (any candidate counts, the scope is the table's). Null when nothing matches or the name
 * is ambiguous between entries (Q26), so a Ctrl/Cmd-click opens only what is certain.
 */
export function entryAt(text: string, table: TermTable): string | null {
  const found = findNames(text, table);
  const whole = found.find((o) => o.from === 0 && o.to === text.length) ?? found[0];
  return whole ? pickEntry(whole, () => true) : null;
}
