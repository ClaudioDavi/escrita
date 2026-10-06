// A book published one chapter at a time (0.9, N 4; PLAN-0.9 Q10-Q13). Pure: no
// Obsidian imports. The outline header's serial line, "Publish next chapter" and the
// gap warning of a chapter's publish check all read `serialState`.
//
// - The sequence (Q10): the book's chapters in book order, without the ones left out by
//   `compile: false` (`include: false`) and without the uncounted ones: a chapter with no
//   number, a 00 chapter, or a title in "Chapters without a number" (countedNumbers in
//   core/book.ts, the export headings' rule).
// - Published (Q10): the chapter's status word maps to the published stage (stageOf).
//   Chapters aren't works, so classify gives them no stage; the status is read here.
// - Next (Q11): the first chapter of the sequence that isn't published.
// - Last (Q12): the last chapter of the sequence, in book order, that is published, with
//   its date as written (publish/date.ts dateText formats it for the header).
// - Gaps (Q13): the unpublished chapters before the last published one. A warning,
//   never a block.

import type { ChapterRef } from "../core/book-source";
import type { StageMapping } from "../core/stages";

/** One chapter as the serial model reads it: the book source's ref plus two properties. */
export interface SerialChapter extends ChapterRef {
  /** the status property's value as read (readStatus); null when missing */
  status: string | null;
  /** the date property's raw value (any frontmatter value); null when missing */
  date: unknown;
}

export interface SerialState {
  /** the chapters that count, in book order */
  sequence: SerialChapter[];
  /** the first unpublished chapter of the sequence; null when every one is published (or there are none) */
  next: SerialChapter | null;
  /** the last published chapter of the sequence and its date; null when none is published (the header shows no line) */
  last: { chapter: SerialChapter; date: unknown } | null;
  /** unpublished chapters before `last`, in order: the gaps (Q13) */
  gaps: SerialChapter[];
}

/**
 * The serial state of a book. `chapters`: every chapter in book order (BookSource.chapters
 * with status and date). `stages`: the writer's stage words. `unnumbered`: the "Chapters
 * without a number" setting (string or parsed list), as for countedNumbers.
 */
export function serialState(
  chapters: readonly SerialChapter[],
  stages: StageMapping,
  unnumbered: string | readonly string[] = [],
): SerialState {
  void chapters; void stages; void unnumbered;
  throw new Error("not implemented: 0.9 task 1.5");
}
