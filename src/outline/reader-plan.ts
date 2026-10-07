// "Read the book" (0.9, N 8; PLAN-0.9 Q14, D6, D7): the decisions of the reader view, pure,
// no Obsidian imports. Which chapters it shows and under which headings, where a reading
// position lands, which block is at the top of the view, and how a saved position follows a
// rename or a delete. outline/reader-view.ts is thin around these.

import type { ChapterRef } from "../core/book-source";
import { chapterHeadings } from "../core/export-pipeline";
import { dropKeys, isUnder, movedPath, renameKeys } from "../core/path-keys";
import type { ReadPosition } from "../data";

/** The export presets' chapter headings, by language (D7: the setting wins; with none, the language's preset). */
const DEFAULT_HEADINGS = { "pt-BR": "Capítulo {n} — {title}", en: "Chapter {n}: {title}" } as const;

/** D7: the export's chapter-heading setting, else the heading of the preset the language picks. */
export function readerHeadingFormat(setting: string, language: string): string {
  const own = setting.trim();
  if (own !== "") return own;
  return language === "pt-BR" ? DEFAULT_HEADINGS["pt-BR"] : DEFAULT_HEADINGS.en;
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
  bottom: number;
  blocks: { line: number; bottom: number }[] | null;
}

/**
 * The reading point: the block at the top of the view, given the view's top edge (all in
 * the same coordinates). A chapter not rendered yet counts as its line 0, and so does the
 * heading above a chapter's first block.
 */
export function readingPoint(sections: readonly SectionBox[], edge: number): ReadPosition | null {
  for (const s of sections) {
    if (s.bottom <= edge) continue;
    const block = s.blocks?.find((b) => b.bottom > edge) ?? s.blocks?.[0] ?? null;
    return { chapter: s.path, line: block ? block.line : 0 };
  }
  const last = sections[sections.length - 1];
  return last ? { chapter: last.path, line: last.blocks?.[last.blocks.length - 1]?.line ?? 0 } : null;
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
