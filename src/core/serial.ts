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
//   its date as written (core/measure.ts dateText formats it for the header).
// - Gaps (Q13): the unpublished chapters before the last published one. A warning,
//   never a block.

import type { BookSource, ChapterRef } from "./book-source";
import { countedNumbers } from "./book";
import { dateText, hasDate } from "./measure";
import { readStatus, stageOf, type StageMapping } from "./stages";

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
  /** whether each chapter of `sequence` is published (same order) */
  published: boolean[];
  /** the last published chapter of the sequence; null when none is published (the header shows no line) */
  last: SerialChapter | null;
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
  const kept = chapters.filter((c) => c.include);
  const counted = countedNumbers(kept, unnumbered);
  const sequence = kept.filter((_, i) => counted[i] !== null);
  const published = sequence.map((c) => stageOf(c.status, stages) === "published");
  const next = sequence.find((_, i) => !published[i]) ?? null;
  const lastIndex = published.lastIndexOf(true);
  const last = lastIndex < 0 ? null : sequence[lastIndex];
  const gaps = sequence.filter((_, i) => i < lastIndex && !published[i]);
  return { sequence, published, next, last, gaps };
}

/** The settings the serial model reads. */
export interface SerialSettings {
  statusProperty: string;
  dateProperty: string;
  stages: StageMapping;
  /** "Chapters without a number" */
  unnumberedTitles: string;
}

/** A book's serial state, read through its book source (chapters and the metadata cache's frontmatter). */
export function bookSerial<B>(source: BookSource<B>, book: B, s: SerialSettings): SerialState {
  return serialState(
    serialChapters(source.chapters(book), (path) => source.frontmatter(path), s.statusProperty, s.dateProperty),
    s.stages, s.unnumberedTitles,
  );
}

// ------------------------------------------------------------------ labels, line and gap (task 2.5)

/** The chapters of a book as the serial model reads them: the source's refs with status and date. */
export function serialChapters(
  chapters: readonly ChapterRef[],
  frontmatter: (path: string) => Record<string, unknown>,
  statusProperty: string,
  dateProperty: string,
): SerialChapter[] {
  return chapters.map((c) => {
    const fm = frontmatter(c.path) ?? {};
    return {
      ...c,
      status: readStatus(fm, statusProperty),
      date: fm[dateProperty] ?? null,
    };
  });
}

/** The number as written in the file name ("04" for "04 A escada.md"); "" when there is none. */
export function chapterDigits(c: Pick<ChapterRef, "path">): string {
  const base = c.path.slice(c.path.lastIndexOf("/") + 1);
  return /^\d+/.exec(base)?.[0] ?? "";
}

/** "04 A escada": the number as written, then the title. */
export function chapterLabel(c: Pick<ChapterRef, "path" | "title">): string {
  const digits = chapterDigits(c);
  return digits ? `${digits} ${c.title}` : c.title;
}

/** What the outline header says (Q12, Q13, Q23, D5). Null when no chapter is published: no line. */
export interface SerialLine {
  /** the next chapter's label; null when every chapter is published */
  next: string | null;
  /** the last published chapter: its label and its date as the header shows it (null = none, so the title is shown, Q23) */
  last: { label: string; date: string | null };
  /** the numbers of the unpublished chapters before the last published one */
  gaps: string[];
}

export function serialLine(state: SerialState): SerialLine | null {
  if (!state.last) return null;
  return {
    next: state.next ? chapterLabel(state.next) : null,
    last: {
      label: chapterLabel(state.last),
      // as written, a future date included (D5); a date that doesn't parse is shown as it is
      date: hasDate(state.last.date) ? dateText(state.last.date) : null,
    },
    gaps: state.gaps.map((g) => chapterDigits(g) || g.title),
  };
}

/**
 * The labels of the chapters before `path` in the sequence that aren't published (Q13).
 * Null when `path` isn't in the sequence (not a chapter, left out, or unnumbered): no check.
 */
export function earlierUnpublished(state: SerialState, path: string): string[] | null {
  const i = state.sequence.findIndex((c) => c.path === path);
  if (i < 0) return null;
  return state.sequence.slice(0, i)
    .filter((_, j) => !state.published[j])
    .map(chapterLabel);
}

/**
 * What the publish module offers the outline (read through `features.get("publish")`, so
 * the outline never imports the module; the module is absent when the feature is off).
 */
export interface PublishNextPort {
  /** Open the publish check of the book's first unpublished chapter. */
  publishNext(bookNotePath: string): Promise<void>;
}
