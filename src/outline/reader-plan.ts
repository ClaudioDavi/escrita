// "Read the book" (0.9, N 8; PLAN-0.9 Q14, D6, D7): the decisions of the reader view, pure,
// no Obsidian imports. Which chapters it shows and under which headings, where a reading
// position lands, which block is at the top of the view, and how a saved position follows a
// rename or a delete. outline/reader-view.ts is thin around these.

import type { ChapterRef } from "../core/book-source";
import { chapterHeadings } from "../core/export-pipeline";
import { storyChapters, type Collection } from "../core/collection";
import { dropKeys, isUnder, movedPath, renameKeys } from "../core/path-keys";
import { noteName } from "../core/paths";
import { presetForLanguage } from "../core/presets";
import type { ReadPosition } from "../data";

/** D7: the export's chapter-heading setting, else the heading of the preset the language picks. */
export function readerHeadingFormat(setting: string, language: string): string {
  return setting.trim() || presetForLanguage(language).chapterHeading;
}

/** One chapter of the reader: what the view draws above its body. */
export interface ReaderChapter {
  path: string;
  /** the chapter heading as the export prints it ("Capítulo 3 — A volta") */
  heading: string;
}

/**
 * Every included chapter (compile not false), in book order, with the export's heading.
 * Numbered over the included chapters, as the export does, so "Chapter 3" reads the same
 * here and in the file.
 */
export function readerChapters(
  all: readonly ChapterRef[], format: string, unnumbered: string | readonly string[] = [],
): ReaderChapter[] {
  const kept = all.filter((c) => c.include);
  const heads = chapterHeadings(kept, format, unnumbered);
  return kept.map((c, i) => ({ path: c.path, heading: heads[i] }));
}

// ------------------------------------------------------------------ the source

/** What the reader reads (1.2, SF 15; PLAN-1.2 Q13-Q15): a book, a collection of contos, or one note. */
export type ReaderKind = "book" | "collection" | "note";

export interface ReaderSource {
  kind: ReaderKind;
  /** the top bar's title: the book's, else the note's name */
  title: string;
  /** what is drawn, in order; a note is one section with no heading */
  sections: ReaderChapter[];
}

/** What the view reads from the vault for `readerSource`; the decision itself stays here. */
export interface ReaderFacts {
  /** the book whose note is the source, with its chapters (left-out ones included) */
  book: { title: string; chapters: readonly ChapterRef[] } | null;
  /** the collection the source note describes (core/books.ts `collectionAt`) */
  collection: Collection | null;
  headingFormat: string;
  unnumbered?: string | readonly string[];
}

/**
 * The source of a reader view, from its path. A book wins (its note is the key), then a
 * collection, as export decides (`sourceKindOf`); anything else is one note. A collection's
 * contos are each headed by their title alone, as the collection export heads them
 * (`storyChapters`: unnumbered), and a note has no heading: its title is in the bar.
 */
export function readerSource(path: string, facts: ReaderFacts): ReaderSource {
  if (facts.book) {
    return {
      kind: "book", title: facts.book.title,
      sections: readerChapters(facts.book.chapters, facts.headingFormat, facts.unnumbered),
    };
  }
  const title = noteName(path);
  if (facts.collection) {
    return {
      kind: "collection", title,
      sections: readerChapters(storyChapters(facts.collection), facts.headingFormat, facts.unnumbered),
    };
  }
  return { kind: "note", title, sections: [{ path, heading: "" }] };
}

/** Whether two sources draw the same thing (title, kind, sections), so a rebuild can be skipped. */
export function sameSource(a: ReaderSource, b: ReaderSource): boolean {
  return a.kind === b.kind && a.title === b.title && a.sections.length === b.sections.length
    && a.sections.every((s, i) => s.path === b.sections[i].path && s.heading === b.sections[i].heading);
}

/**
 * The path a saved view state names: `{ source }`, or the 0.9 `{ book }` (Q15: the same
 * thing, the book's note path). Null when it names none.
 */
export function readerStatePath(state: unknown): string | null {
  const s = state as { source?: unknown; book?: unknown } | null;
  if (typeof s?.source === "string" && s.source !== "") return s.source;
  if (typeof s?.book === "string" && s.book !== "") return s.book;
  return null;
}

// ------------------------------------------------------------------ position

/** Where the view opens: the saved chapter if it is still in the book, else the top. */
export function restoreTarget(
  pos: ReadPosition | undefined, chapters: readonly ReaderChapter[],
): { index: number; line: number } {
  if (!pos) return { index: 0, line: 0 };
  const index = chapters.findIndex((c) => c.path === pos.chapter);
  return index < 0 ? { index: 0, line: 0 } : { index, line: pos.line };
}

/**
 * The block to scroll to for a saved line: the last block that starts at or before it
 * (the text may have been edited since), the first when the line is before them all;
 * -1 when the chapter has no blocks.
 */
export function blockForLine(lines: readonly number[], line: number): number {
  let found = lines.length > 0 ? 0 : -1;
  for (let i = 0; i < lines.length; i++) if (lines[i] <= line) found = i;
  return found;
}

/** A chapter's place on screen, for `readingPoint`. `blocks` is null while it is not rendered. */
export interface SectionBox {
  path: string;
  /** the section's bottom edge; read in order, only up to the first section past the edge */
  bottom(): number;
  /** the drawn blocks' lines and bottom edges, read only for the section picked; null when not drawn yet */
  blocks(): { line: number; bottom: number }[] | null;
}

/**
 * The reading point: the block at the top of the view, given the view's top edge (all in
 * the same coordinates). A chapter not rendered yet counts as its line 0, and so does the
 * heading above a chapter's first block. Measures lazily: the sections above the edge give
 * only their bottom, and one section its blocks.
 */
export function readingPoint(sections: readonly SectionBox[], edge: number): ReadPosition | null {
  for (const s of sections) {
    if (s.bottom() <= edge) continue;
    const blocks = s.blocks();
    const block = blocks?.find((b) => b.bottom > edge) ?? blocks?.[0] ?? null;
    return { chapter: s.path, line: block ? block.line : 0 };
  }
  const last = sections[sections.length - 1];
  if (!last) return null;
  const blocks = last.blocks();
  return { chapter: last.path, line: blocks?.[blocks.length - 1]?.line ?? 0 };
}

// ------------------------------------------------------------------ following the vault

/**
 * A rename. The store is keyed by the book note's path, and each entry names a chapter:
 * both move with the file or the folder. True when something changed.
 */
export function movePositions(store: Record<string, ReadPosition>, oldPath: string, newPath: string): boolean {
  let changed = false;
  for (const pos of Object.values(store)) {
    const to = movedPath(pos.chapter, oldPath, newPath);
    if (to !== null) { pos.chapter = to; changed = true; }
  }
  return renameKeys(store, oldPath, newPath) || changed;
}

/** A delete: a deleted book drops its entry, and so does a deleted chapter (reading starts at the top). */
export function dropPositions(store: Record<string, ReadPosition>, path: string): boolean {
  let changed = dropKeys(store, path);
  for (const [book, pos] of Object.entries(store)) {
    if (isUnder(pos.chapter, path)) { delete store[book]; changed = true; }
  }
  return changed;
}
