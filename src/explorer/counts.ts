// What the file explorer shows next to a note, a book or a folder (no Obsidian
// imports): the abbreviated number, the target beside it, the limit state, and
// the book and folder totals. The numbers come from plugin.measure.

import { ancestors } from "../core/classify";
import type { PieceState, Progress } from "../core/measure";

/** Injected number formatter: n with at most `digits` fraction digits and locale grouping. */
export type NumFmt = (n: number, digits: number) => string;

/** Templates with {n}: "{n}k" / "{n} mil", "{n}M" / "{n} mi". */
export interface Abbrev {
  k: string;
  m: string;
}

/** From here on, counts are abbreviated (always: the explorer's width can't be measured). */
export const ABBREVIATE_FROM = 10_000;

/**
 * Below 10,000 the full number; 10,000–99,999 thousands with one decimal;
 * 100,000–999,999 whole thousands (promoted to millions when it rounds to
 * 1,000); from a million, millions with one decimal. Non-finite or negative → 0.
 */
export function abbreviate(n: number, fmt: NumFmt, a: Abbrev): string {
  if (!Number.isFinite(n) || !(n >= 0)) return fmt(0, 0);
  const r = Math.round(n);
  if (r < ABBREVIATE_FROM) return fmt(r, 0);
  if (r < 100_000) {
    const k = Math.round(r / 100) / 10;
    if (k < 100) return a.k.replace("{n}", fmt(k, 1));
  }
  const th = Math.round(r / 1000);
  if (th < 1000) return a.k.replace("{n}", fmt(th, 0));
  return a.m.replace("{n}", fmt(Math.round(r / 100_000) / 10, 1));
}

export interface CountLabel {
  /** "18.4k", or "4,210 / 5,000" with the target shown */
  text: string;
  /** the target (else the limit) when shown beside the count, else null */
  of: number | null;
  /** limit-driven: "near" and "over" colour the count */
  state: PieceState;
}

/** The label of a note from its progress (core/measure noteProgress). */
export function countLabel(p: Progress, o: { showTarget: boolean; fmt: NumFmt; abbrev: Abbrev }): CountLabel {
  const of = o.showTarget ? p.of : null;
  const count = abbreviate(p.count, o.fmt, o.abbrev);
  return { text: of ? `${count} / ${abbreviate(of, o.fmt, o.abbrev)}` : count, of, state: p.state };
}

/** The class a count gets from its state. */
export function stateClass(state: PieceState): string {
  return state === "near" ? "is-near" : state === "over" ? "is-over" : "";
}

export interface BookShape {
  note: string;
  folder: string;
  chaptersFolder: string;
  chapters: string[];
}

export interface TotalsInput {
  /** words of tracked .md files that are counted */
  words: ReadonlyMap<string, number>;
  /** the books whose note is tracked */
  books: readonly BookShape[];
  /** words per chapter of those books, tracked or not (the status bar's rule) */
  chapterWords: ReadonlyMap<string, number>;
  folderTotals: boolean;
}

/** Which tooltip a book total gets: the book note and folder, or a separate chapters folder. */
export type BookRole = "book" | "chapters";

export interface Totals {
  /** book note, book folder and chapters folder → the book's words */
  books: Map<string, { words: number; role: BookRole }>;
  /** any other folder → the words of the tracked notes under it (only with folderTotals); never the root */
  folders: Map<string, number>;
}

/**
 * Book totals: the sum of the chapters' words, left out while any chapter is
 * uncounted, so a partial total never shows. A chapters folder that is the book
 * folder is one key. Folder totals: every tracked file's words added to each
 * of its folders; nested books count in outer folders; book keys win.
 */
export function explorerTotals(i: TotalsInput): Totals {
  const books = new Map<string, { words: number; role: BookRole }>();
  for (const b of i.books) {
    let sum = 0;
    let complete = true;
    for (const c of b.chapters) {
      const w = i.chapterWords.get(c);
      if (w === undefined) { complete = false; break; }
      sum += w;
    }
    if (!complete) continue;
    books.set(b.note, { words: sum, role: "book" });
    books.set(b.folder, { words: sum, role: "book" });
    if (b.chaptersFolder !== b.folder) books.set(b.chaptersFolder, { words: sum, role: "chapters" });
  }
  const folders = new Map<string, number>();
  if (i.folderTotals) {
    for (const [path, w] of i.words) {
      for (const dir of ancestors(path)) folders.set(dir, (folders.get(dir) ?? 0) + w);
    }
    for (const key of books.keys()) folders.delete(key);
  }
  return { books, folders };
}
