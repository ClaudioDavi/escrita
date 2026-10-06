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

import { manuscriptOf, type Block, type ManuscriptOptions, type Run } from "../core/manuscript";

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

/** Characters that would turn plain run text back into Markdown structure. */
function escapeText(s: string): string {
  return s.replace(/[\\*_`[\]<>]/g, "\\$&");
}

/** One run back to Markdown: emphasis marks around the text, kept off the edge spaces. */
function runMarkdown(r: Run): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(r.text) as RegExpExecArray;
  if (m[2] === "") return r.text;
  const open = (r.bold ? "**" : "") + (r.italic ? "*" : "");
  const close = (r.italic ? "*" : "") + (r.bold ? "**" : "");
  return m[1] + open + escapeText(m[2]) + close + m[3];
}

function runsMarkdown(runs: Run[]): string {
  return runs.map(runMarkdown).join("");
}

function blockMarkdown(b: Block): string {
  switch (b.kind) {
    case "sceneBreak":
      return "---";
    case "heading":
      return "#".repeat(b.level) + " " + runsMarkdown(b.runs).replace(/\n/g, " ");
    case "quote":
      return runsMarkdown(b.runs)
        .split("\n")
        .map((l) => "> " + l)
        .join("\n");
    default:
      return runsMarkdown(b.runs);
  }
}

/**
 * The reader blocks of a chapter's text, in order. `o.placeholderMarker` is the
 * settings' marker word, so placeholders hide as in the export.
 *
 * Built on `manuscriptOf`, so what is hidden is decided there and nowhere else. Like the
 * export, a scene break at the start or end of the chapter, or a second one in a row, is
 * not shown (a chapter boundary already separates).
 */
export function readerBlocks(text: string, o: Pick<ManuscriptOptions, "placeholderMarker">): ReaderBlock[] {
  const { blocks } = manuscriptOf(text, { placeholderMarker: o.placeholderMarker });
  return blocks.map((b) => ({ text: blockMarkdown(b), line: b.line ?? 0 }));
}
