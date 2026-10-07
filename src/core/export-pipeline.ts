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
// The pure helpers below (exportDocOf, droppedIn, aboutCount, chapterHeadings, fillTemplate) feed every writer.

import { countedNumbers } from "./book";
import type { Markdown } from "./markdown";
import { manuscriptOf, type Manuscript, type ManuscriptOptions } from "./manuscript";
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
  /** the chapter's own title (ChapterRef.title), for dropping a leading heading that repeats it; null for front matter and a single note */
  title?: string | null;
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
 * Source → model: `manuscriptOf` on each part. A body part drops a leading
 * heading that repeats its formatted heading, its own title ("Chapter 1: A chegada"
 * or "A chegada"), or, for a single note, the work's title.
 * Empty parts stay (a chapter heading with no prose is still a chapter).
 */
export function exportDocOf(source: ExportSource, o: ManuscriptOptions): ExportDoc {
  return {
    title: source.title,
    author: source.author,
    count: source.count,
    parts: source.parts.map((p) => {
      // a body part's leading heading goes when it repeats the part's heading or title
      // (or the work's title for a single note); front matter keeps every heading
      const drop = p.role !== "body" ? [] : [p.heading, p.title, p.heading === null ? source.title : null]
        .filter((d): d is string => typeof d === "string" && d.trim() !== "");
      const opts = drop.length === 0 ? o : { ...o, dropTitleHeading: drop };
      return { role: p.role, heading: p.heading, manuscript: manuscriptOf(p.md, opts) };
    }),
  };
}

/**
 * A book (a title page of its own, chapters) or a single note (the title starts page 1)?
 * A book has a chapter heading or a front matter part; a single note is one body part
 * with no heading. Writers share this rule (tests/fixtures/manuscript/README.md, 5).
 */
export function isBookDoc(doc: ExportDoc): boolean {
  return doc.parts.some((p) => p.role !== "body" || p.heading !== null);
}

/**
 * Every placeholder, embed and unclosed comment dropped, with the part it came from
 * (its index in `parts`). The export modal lists the readiness checks (placeholders,
 * unclosed comments, beats) plus only the `embed` entries from here;
 * `dropped.placeholder` is for tests and diagnostics.
 */
export function droppedIn(doc: ExportDoc): { part: number; dropped: Manuscript["dropped"][number] }[] {
  return doc.parts.flatMap((p, part) => p.manuscript.dropped.map((dropped) => ({ part, dropped })));
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
  /** an ebook's table of contents title: "Contents", "Sumário" (EPUB and its preview) */
  contentsLabel: string;
  /** an ebook's cover page title and landmark: "Cover", "Capa" */
  coverLabel: string;
  /** an ebook's landmark for the first chapter: "Start of content", "Início" */
  startLabel: string;
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
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const step = amount < 10000 ? 100 : 500;
  return Math.max(100, Math.round(amount / step) * step);
}

/**
 * The heading of each chapter, in order (Q5). `n` counts only numbered chapters,
 * so a "00 Prólogo" before chapter 1 doesn't shift the numbers and a left-out
 * chapter leaves no gap. `n` is the ordinal among the numbered chapters not left
 * out by `compile: false`, counted before the modal's range or ticks narrow the
 * list: pass the compile-included chapters, then keep the headings of the selected
 * ones (exporting chapters 5-7 keeps 5, 6, 7). A chapter numbered 0 ("00 Prólogo", which sorts first) is not counted and gets its title alone, like an unnumbered one (an epilogue, which sorts last). A numbered chapter gets `format` with
 * `{n}` and `{title}` filled; an unnumbered one its title alone. When a numbered
 * chapter has no title of its own (its title is only the number prefix), `{title}`
 * and the separator before it are left out ("Capítulo 1").
 */
export function chapterHeadings(
  chapters: readonly { number: number | null; title: string }[], format: string, unnumbered: string | readonly string[] = [],
): string[] {
  const counted = countedNumbers(chapters, unnumbered);
  return chapters.map((c, i) => {
    const title = c.title.trim();
    const n = counted[i];
    if (n === null) return title;   // no number, "00 Prólogo", or a title in the unnumbered list
    if (title !== "") return fillTemplate(format, { n, title }).trim();
    // no title of its own: cut `{title}` and the separator on the side facing `{n}`
    const t = format.indexOf("{title}");
    const k = format.indexOf("{n}");
    const SEP = "[\\s:\u2014\u2013\\-.,]*";
    let cut = format;
    if (t >= 0) {
      const head = format.slice(0, t);
      const tail = format.slice(t + 7);
      cut = k >= 0 && k > t
        ? head + tail.replace(new RegExp(`^${SEP}`), "")
        : head.replace(new RegExp(`${SEP}$`), "") + tail;
    }
    return fillTemplate(cut, { n, title: "" }).trim();
  });
}

/** `{name}` slots filled from `vars`; an unknown slot stays as written. */
export function fillTemplate(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (all, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : all,
  );
}
