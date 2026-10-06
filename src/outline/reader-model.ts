// "Read the book" (0.9, N 8; PLAN-0.9 Q14, Q20): the blocks of one chapter as the reader
// view shows them. Pure: no Obsidian imports. The view (outline/reader-view.ts) renders
// each block's `text` with Obsidian's Markdown renderer, chapter by chapter as they
// scroll into view, and a click on a block opens its chapter at `line`.
//
// Markers are hidden exactly as core/manuscript.ts hides them, so what you read is what
// the export prints: frontmatter, `%%` comments (beats, threads), closed `<!-- -->`
// comments and placeholders are gone; an unclosed comment hides everything after it;
// embeds are dropped. Scene breaks are kept, as their own block. The chapter heading
// the export adds is not a block: the view draws it from chapterHeadings, as export does.

import type { ManuscriptOptions } from "../core/manuscript";

/** One block of a chapter as the reader sees it. */
export interface ReaderBlock {
  /**
   * The block's Markdown, markers removed, ready for the renderer: a paragraph, a
   * heading, a quotation or a scene break line ("---"), as written otherwise.
   */
  text: string;
  /** 0-based line in the whole file (frontmatter included) where the block starts */
  line: number;
}

/**
 * The reader blocks of a chapter's text, in order. `o.placeholderMarker` is the
 * settings' marker word, so placeholders hide as in the export.
 */
export function readerBlocks(text: string, o: Pick<ManuscriptOptions, "placeholderMarker">): ReaderBlock[] {
  void text; void o;
  throw new Error("not implemented: 0.9 task 1.6");
}
