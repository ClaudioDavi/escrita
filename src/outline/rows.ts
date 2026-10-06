// A chapter's row, loaded once for the outline view and the board (0.7 plan Q51,
// IMPROVEMENTS 7). Pure: no Obsidian or CodeMirror imports, no i18n.

import type { BookSource } from "../core/book-source";
import { parseBeats, type BeatMarker } from "../core/markers";
import {
  countIn, effectivePiece, noteProgress, parseUnit, readPiece,
  type ChapterDefault, type Counts, type Piece, type PieceUnit, type Progress,
} from "../core/measure";
import { isBlankBody } from "./beats-edit";
import { readStatus, stageOf, type Stage, type StageMapping } from "../core/stages";
import type { PovValue } from "./pov";

export interface ChapterRow {
  path: string; index: number; label: string; title: string; summary: string;
  status: string; stage: Stage | null; pov: PovValue | null;
  piece: Piece | null; pieceSource: "own" | "book" | null; unit: PieceUnit;
  words: number; count: number; progress: Progress | null;
  beats: BeatMarker[]; placeholders: number; bodyBlank: boolean;   // parseBeats, core/markers.ts:138
}

/** The settings a row reads: property names. Task 2.2 may extend this. */
export interface RowSettings {
  summaryProperty?: string;
  statusProperty: string;
  povProperty: string;
  targetProperty: string;
  limitProperty: string;
  unitProperty: string;
  deadlineProperty: string;
  chapterTargetProperty: string;
}

/** Generic over the book type, so tests pass a plain object. Chapters, text and frontmatter come from the book source; the title is ChapterRef.title, the label the digits of the file name. */
export interface RowsPort<B> extends BookSource<B> {
  /** `seed` is undefined when the text came from an open editor (read's mtime is null): the measurer then reads the file itself. */
  counts(path: string, seed: { text: string; mtime: number } | undefined, unit: PieceUnit): Promise<Counts>;
  placeholders(path: string): number;          // 0 when the feature is off
  chapterDefault(book: B): ChapterDefault | null;
  resolvePov(value: unknown, path: string): PovValue | null;
  settings(): RowSettings;
  stages(): StageMapping;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(str).join(", ");
  return String(v);
}

function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, " ");
}

/** One row per chapter, in order. Reads run in parallel. */
export async function loadRows<B>(port: RowsPort<B>, book: B): Promise<ChapterRow[]> {
  const s = port.settings();
  const def = port.chapterDefault(book);
  const rows = await Promise.all(port.chapters(book).map(async (ch, i): Promise<ChapterRow | null> => {
    // a chapter renamed or deleted while rows load is skipped; the next refresh draws it
    let read: Awaited<ReturnType<typeof port.read>>;
    try { read = await port.read(ch.path); } catch { return null; }
    const basename = ch.path.slice(ch.path.lastIndexOf("/") + 1).replace(/\.md$/, "");
    const fm = port.frontmatter(ch.path) ?? {};
    const status = readStatus(fm, s.statusProperty) ?? "";
    const own = readPiece(fm, s);
    const rawUnit = fm[s.unitProperty];
    // a blank unit is no unit, so it never overrides the book's (same rule as readChapterDefault)
    const ownUnit = rawUnit === undefined || rawUnit === null || (typeof rawUnit === "string" && rawUnit.trim() === "") ? null : parseUnit(rawUnit);
    const { piece, source } = effectivePiece(own, def, ownUnit);
    const unit: PieceUnit = piece?.unit ?? ownUnit ?? "words";
    // only saved text may seed the measurer's mtime cache: an editor's buffer may be unsaved
    let counts: Counts;
    try {
      counts = await port.counts(ch.path, read.mtime === null ? undefined : { text: read.text, mtime: read.mtime }, unit);
    } catch { return null; }
    return {
      path: ch.path,
      index: i,
      label: ch.number === 0 ? "" : /^\d+/.exec(basename)?.[0] ?? String(i + 1),   // "00 Prólogo" shows no number   // the digits as written ("01"), as the view always showed them
      title: ch.title,
      summary: s.summaryProperty ? oneLine(str(fm[s.summaryProperty])) : "",
      status,
      stage: stageOf(status, port.stages()),
      pov: port.resolvePov(fm[s.povProperty], ch.path),
      piece,
      pieceSource: source,
      unit,
      words: counts.words,
      count: countIn(counts, unit),
      progress: piece ? noteProgress(counts, piece, unit) : null,
      beats: parseBeats(read.text),
      placeholders: port.placeholders(ch.path),
      bodyBlank: isBlankBody(read.text),
    };
  }));
  return rows.flatMap((r) => (r ? [r] : []));
}
