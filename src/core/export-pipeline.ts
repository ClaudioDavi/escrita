// The export pipeline's seam (PLAN-0.8 Q10, N 7, SP 6). Pure, no Obsidian imports.
//
//   source (ExportSource: what to export, read by the export module)
//     → model (here ExportDoc, built with core/manuscript.ts; a screenplay brings its own)
//     → writer (ManuscriptWriter<M, P>: Markdown and DOCX in src/export/writers/)
//     → bytes, written by the export module through plugin.notes.create
//
// The pipeline is generic over the model M and its preset P: screenplay export
// (after 1.0) adds a script model, its layout data and its own writers (Fountain, PDF, FDX) without changing this file.
// Presets are plain data; the writers read them and nothing else about layout.
//
// Owner: the pure helpers below are stubs for task 2.3 (the writers need them).

import type { Markdown } from "./markdown";
import type { Manuscript, ManuscriptOptions } from "./manuscript";
import type { PieceUnit } from "./measure";

// ------------------------------------------------------------------ source

/** Who wrote it (Q2): settings, overridden by an `author` property on the book note or the note. */
export interface Author {
  /** "Machado de Assis"; "" when not set (writers leave the line out) */
  name: string;
  /** for the Shunn header; settings' `authorSurname`, or else the last word of `name` */
  surname: string;
  /** address, email, phone: one line each, as the writer typed them */
  contact: string[];
}

/**
 * One part of what is exported, in order.
 * - `body`: a chapter of a book, or the whole of a single note.
 * - `dedication`, `epigraph`: a book's front matter pages (Q7), from the notes
 *   named in the book note's properties; each starts its own page, with no heading.
 */
export interface ExportPart {
  role: "body" | "dedication" | "epigraph";
  /** the chapter heading, already formatted (chapterHeadings); null for a single note and front matter */
  heading: string | null;
  md: Markdown;
}

/** What the export module hands the pipeline: everything read, nothing formatted. */
export interface ExportSource {
  title: string;
  author: Author;
  /**
   * The work's measured size for the title page (Q8): `measure.note` or
   * `measure.book`, in the work's unit (words unless the piece counts characters).
   * Never recounted from the parts. Rounded by `aboutCount` when written.
   */
  count: { amount: number; unit: PieceUnit };
  parts: ExportPart[];
}

// ------------------------------------------------------------------ model

/** The prose model every 0.8 writer formats: the source with each part turned into a Manuscript. */
export interface ExportDoc {
  title: string;
  author: Author;
  count: { amount: number; unit: PieceUnit };
  parts: { role: ExportPart["role"]; heading: string | null; manuscript: Manuscript }[];
}

/**
 * Source → model: `manuscriptOf` on each part, with the part's heading as
 * `dropTitleHeading` for a body part (and the title for a single note).
 * Empty parts stay (a chapter heading with no prose is still a chapter).
 */
export function exportDocOf(source: ExportSource, o: ManuscriptOptions): ExportDoc {
  void source; void o;
  throw new Error("not implemented: 0.8 task 2.3");
}

/**
 * Every placeholder, embed and unclosed comment dropped, with the part it came from
 * (its index in `parts`). The export modal lists the readiness checks (placeholders,
 * unclosed comments, beats) plus only the `embed` entries from here;
 * `dropped.placeholder` is for tests and diagnostics.
 */
export function droppedIn(doc: ExportDoc): { part: number; dropped: Manuscript["dropped"][number] }[] {
  void doc;
  throw new Error("not implemented: 0.8 task 2.3");
}

// ------------------------------------------------------------------ presets

/**
 * What a manuscript preset varies (N 7, stage 2). `endMark`, `countLabel`, `header`,
 * `page`, `font`, `lineSpacing` and `indent` are page layout only: the Markdown
 * writer ignores them and reads only `byline`, `chapterHeading` and `sceneBreak`.
 * Plain data in the manuscript's
 * language, which may differ from Obsidian's (a pt-BR writer sending a Shunn
 * manuscript to an English market). Lengths are in points (1/72 inch); writers
 * convert (DOCX: twentieths of a point). Templates use `{name}` slots.
 */
export interface Preset {
  /** "shunn", "pt-BR"; also the file name suffix: `<title> (<id>).docx` (Q3) */
  id: string;
  /** BCP 47 tag of the manuscript: "en-US", "pt-BR" (DOCX `w:lang`, number formatting) */
  language: string;
  /** Letter 612 × 792, A4 595.3 × 841.9; one margin on every side */
  page: { width: number; height: number; margin: number };
  font: { family: string; size: number };
  /** 2 = double spacing */
  lineSpacing: number;
  /** first-line indent of a paragraph (36 = half an inch); the first paragraph after a heading or break too */
  indent: number;
  /** the text of a scene break line: "#", "* * *", or "" for a blank line */
  sceneBreak: string;
  /**
   * A numbered chapter's heading, with `{n}` and `{title}`: shunn is
   * "Chapter {n}: {title}", pt-BR "Capítulo {n} — {title}". An unnumbered chapter gets its title alone (Q5).
   * The writer's setting overrides it.
   */
  chapterHeading: string;
  /** the running header from page 2 on, with `{surname}`, `{title}` and `{page}`; null = none */
  header: string | null;
  /** the title page's count line, with `{n}` (already rounded and formatted): "about {n} words" */
  countLabel: Record<PieceUnit, string>;
  /** the byline under the title, with `{name}`: "by {name}", "{name}" */
  byline: string;
  /** after the last part: "END", "FIM"; null = none */
  endMark: string | null;
}

// ------------------------------------------------------------------ writers

/**
 * A format writer: one per output format, generic over the model it formats and
 * over that model's layout options. The preset type travels with the model: the
 * 0.8 prose writers take `ManuscriptWriter<ExportDoc>` (preset `Preset`), and a
 * screenplay writer (SP 6) brings its own model and its own layout data as `P`,
 * plugging in without changing this file. `write` is pure: same model and
 * preset, same output. Text formats return a string (UTF-8 when written);
 * binary formats return bytes.
 */
export interface ManuscriptWriter<M, P = Preset> {
  /** "markdown", "docx" */
  id: string;
  /** file extension without the dot: "md", "docx" */
  ext: string;
  write(m: M, preset: P): string | Uint8Array;
}

// ------------------------------------------------------------------ pure helpers

/**
 * The title page count (Q8, the Shunn convention): to the nearest 100 below
 * 10,000, to the nearest 500 from 10,000 up; never below 100 for a non-empty
 * work (0 stays 0). Characters round the same way. The "about" wording is the
 * preset's `countLabel`.
 */
export function aboutCount(amount: number): number {
  void amount;
  throw new Error("not implemented: 0.8 task 2.3");
}

/**
 * The heading of each chapter, in order (Q5). `n` counts only numbered chapters,
 * so a "Prólogo" before chapter 1 doesn't shift the numbers and a left-out
 * chapter leaves no gap. `n` is the ordinal among the numbered chapters not left
 * out by `compile: false`, counted before the modal's range or ticks narrow the
 * list: pass the compile-included chapters, then keep the headings of the selected
 * ones (exporting chapters 5-7 keeps 5, 6, 7). A numbered chapter gets `format` with
 * `{n}` and `{title}` filled; an unnumbered one its title alone. When a numbered
 * chapter has no title of its own (its title is only the number prefix), `{title}`
 * and the separator before it are left out ("Capítulo 1").
 */
export function chapterHeadings(chapters: readonly { number: number | null; title: string }[], format: string): string[] {
  void chapters; void format;
  throw new Error("not implemented: 0.8 task 2.3");
}

/** `{name}` slots filled from `vars`; an unknown slot stays as written. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string | number>>): string {
  void template; void vars;
  throw new Error("not implemented: 0.8 task 2.3");
}
