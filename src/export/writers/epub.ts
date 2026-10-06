// The EPUB 3 writer (0.9, N 7 stage 3; PLAN-0.9 Q5-Q9, Q19). Pure, no Obsidian imports.
// A `ManuscriptWriter` beside the Markdown and DOCX writers, zipped with core/zip.ts:
// the `mimetype` entry first and stored (every entry of core/zip is stored), then
// META-INF/container.xml, the package document, the nav document, an NCX for older
// readers, and the XHTML files.
//
// What goes in the book (Q6): a title page, the dedication and epigraph pages (as in
// 0.8), a table of contents, one XHTML file per chapter with its heading as in DOCX,
// and the ornamental scene break (`EpubLayout.sceneBreak`, never at a chapter boundary:
// the manuscript model already drops a break at a part's edge). No running header, no
// word count, no end mark: an ebook isn't a manuscript. With a cover, the image and a
// first cover page.
//
// Metadata (Q7): title, author, language, `dcterms:modified`, and a `urn:uuid`
// identifier derived from the work's path and title (epubIdentifier), so re-exporting
// the same book keeps its id. Every input is in `EpubBook`, so `write` stays pure: the
// same book and layout give the same bytes. EPUBCheck validates the fixture book in CI
// (task 1.4, gate G0a).

import type { ExportDoc, ManuscriptWriter, Preset } from "../../core/export-pipeline";

/** The cover image (Q8), read as binary through the book source by the export module. */
export interface EpubCover {
  data: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
}

/** Everything one EPUB is made of: the prose model plus what only an ebook needs. */
export interface EpubBook {
  doc: ExportDoc;
  /** `urn:uuid:…` from epubIdentifier(work path, title) */
  identifier: string;
  /** `dcterms:modified`: UTC, whole seconds, "2026-10-06T14:32:00Z" (epubModified) */
  modified: string;
  /** null: no cover image and no cover page (a missing or unreadable image is a readiness warning, Q8) */
  cover: EpubCover | null;
}

/**
 * What the EPUB writer reads about layout: the ebook's share of a preset, plus the
 * scene break setting. Built by epubLayout; the writer reads nothing else.
 */
export interface EpubLayout {
  /** BCP 47, the preset's language: "en-US", "pt-BR" (`dc:language`, `xml:lang`) */
  language: string;
  /** the byline under the title on the title page, with `{name}` (the preset's) */
  byline: string;
  /** the table of contents' title: "Contents", "Sumário" */
  contentsLabel: string;
  /** the scene break line: the `epubSceneBreak` setting ("* * *") */
  sceneBreak: string;
}

/**
 * The layout for a preset (Q5): its language and byline, the contents label in its
 * language ("Sumário" for Portuguese, else "Contents"), and the scene break from the
 * `epubSceneBreak` setting. The preset's own `sceneBreak` ("#") is a manuscript's, not
 * a book's, so the setting wins.
 */
export function epubLayout(preset: Preset, sceneBreak: string): EpubLayout {
  const pt = /^pt\b/i.test(preset.language);
  return {
    language: preset.language,
    byline: preset.byline,
    contentsLabel: pt ? "Sumário" : "Contents",
    sceneBreak: sceneBreak.trim() || "* * *",
  };
}

/**
 * The book's identifier (Q7): `urn:uuid:` and a version-5-shaped UUID derived from the
 * work's vault path and title, so the same book exported again keeps its id, and a
 * renamed book gets a new one. Deterministic and pure (no crypto API needed).
 */
export function epubIdentifier(path: string, title: string): string {
  void path; void title;
  throw new Error("not implemented: 0.9 task 1.4");
}

/** `dcterms:modified` for a moment: UTC, whole seconds ("2026-10-06T14:32:00Z"). */
export function epubModified(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function write(book: EpubBook, layout: EpubLayout): Uint8Array {
  void book; void layout;
  throw new Error("not implemented: 0.9 task 1.4");
}

export const epubWriter: ManuscriptWriter<EpubBook, EpubLayout> = { id: "epub", ext: "epub", write };
