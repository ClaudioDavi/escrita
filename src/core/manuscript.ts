// A note's prose as an editor receives it (IMPROVEMENTS 15, PLAN-0.8 Q5-Q8). Pure,
// no Obsidian imports. `manuscriptOf` turns a note's Markdown into a small block
// model that every export writer formats: Markdown and DOCX in 0.8, EPUB in 0.10.
// Nothing in the model is format-specific: a writer never looks at Markdown again.
//
// What is dropped, and what is reported (`Manuscript.dropped`):
// - frontmatter, `%%` and closed `<!-- -->` comments: dropped silently (the writer's
//   notes to self). A line that held only a comment (a beat, a placeholder, a thread)
//   goes with its blank line, so no stray empty paragraph is left.
// - placeholders (`%% XXX: … %%`, marker word from settings): dropped and reported,
//   so the export modal can warn like the publish check does.
// - embeds (`![[…]]`, `![](…)`): dropped and reported.
// - an unclosed `%%` or `<!--`: Reading view hides everything after it, so the
//   manuscript does too; the hidden text is reported once, at the opener.
// Removing an inline `%%` or `<!-- -->` takes the whitespace before it, so no double
// or trailing space is left.
// For task 3.1: read `strictLineBreaks` only through a listed ARCHITECTURE exception,
// or default it off. For task 2.3: the Markdown writer writes a run's "\n" as a
// CommonMark hard break (backslash, newline).
// The segmentation is core/markdown's (`segment`), the scene break rule is
// `isSceneBreakAt` (core/markers.ts), and the link rules come from the `MARKUP`
// table in core/wordcount.ts, so the manuscript can't drift from the counts.
//
// Filled by task 1.3.

import type { Markdown } from "./markdown";

/**
 * A stretch of text with one formatting. Writers render runs in order and add
 * nothing between them. `text` may contain "\n": a line break inside the block
 * (a verse line, an address in an epigraph), never a paragraph break.
 * Inline code becomes a plain run (Q6: code keeps its text, unformatted).
 */
export interface Run {
  text: string;
  italic?: true;
  bold?: true;
}

/**
 * One block of the manuscript, in reading order. Closed set: a new kind of block
 * is a deliberate change to every writer.
 * - `paragraph`: a paragraph of prose. A list item is a paragraph too, its mark
 *   kept as text (lists are rare in fiction; nothing is lost).
 * - `heading`: a heading inside the note's body, level 1-6 as written. The
 *   chapter heading the pipeline adds is not a block (see ExportPart.heading).
 * - `quote`: one paragraph of a `>` quotation or a callout's body; consecutive
 *   quote blocks are one quotation. A callout's header line is dropped.
 * - `sceneBreak`: a scene break (`isSceneBreakAt`). Never first or last in a
 *   manuscript, never two in a row: a break at the edge of a note or chapter is
 *   dropped, since a chapter boundary already separates (N 7).
 */
export type Block =
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: Run[] }
  | { kind: "quote"; runs: Run[] }
  | { kind: "sceneBreak" };

/** Something Reading view would not show, or that can't go into a manuscript. */
export interface Dropped {
  kind: "placeholder" | "embed" | "unclosedComment";
  /** 0-based line in the whole file (frontmatter included), to jump to */
  line: number;
  /** the placeholder's note, the embed's target, or "" for an unclosed comment */
  text: string;
}

export interface Manuscript {
  blocks: Block[];
  /** in file order */
  dropped: Dropped[];
}

export interface ManuscriptOptions {
  /** the placeholder marker word from settings (`XXX`) */
  placeholderMarker: string;
  /**
   * Obsidian's "Strict line breaks" setting. Off (the default, like Obsidian's):
   * a single line break inside a paragraph is a "\n" in its run. On: it is a space.
   */
  strictLineBreaks?: boolean;
  /**
   * When the first block is a heading whose text equals this (trimmed, case
   * ignored), it is dropped: a note that starts with `# Its title` doesn't print
   * the title twice under the pipeline's own heading. Omitted = keep every heading.
   */
  dropTitleHeading?: string;
}

/**
 * The note's prose as blocks of runs, plus what was dropped (see the header).
 * Takes the raw text or an existing segmentation. Pure and total: never throws,
 * and an empty or comment-only note gives `{ blocks: [], dropped: [...] }`.
 * Wikilinks become their alias, else their target's text; Markdown links their
 * text; bare URLs stay as text. Emphasis (`*`, `_`, `**`, `__`) becomes run
 * flags; an unmatched mark stays as a literal character.
 */
export function manuscriptOf(md: string | Markdown, o: ManuscriptOptions): Manuscript {
  void md; void o;
  throw new Error("not implemented: 0.8 task 1.3");
}
