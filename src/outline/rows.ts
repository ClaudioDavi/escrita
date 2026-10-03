// A chapter's row, loaded once for the outline view and the board (0.7 plan Q51,
// IMPROVEMENTS 7). Pure: no Obsidian or CodeMirror imports, no i18n.

import { chapterNumber, chapterTitle } from "../core/book";
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

/** Generic over the book type, so tests pass a plain object; titles and labels come from chapterTitle/chapterNumber (core/book.ts). */
export interface RowsPort<B> {
  chapters(book: B): { path: string; basename: string }[];
  read(path: string): Promise<{ text: string; mtime: number }>;
  frontmatter(path: string): Record<string, unknown> | undefined;
  counts(path: string, seed: { text: string; mtime: number }, unit: PieceUnit): Promise<Counts>;
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
  return Promise.all(port.chapters(book).map(async (ch, i): Promise<ChapterRow> => {
    const seed = await port.read(ch.path);
    const fm = port.frontmatter(ch.path) ?? {};
    const status = readStatus(fm, s.statusProperty) ?? "";
    const own = readPiece(fm, s);
    const ownUnit = fm[s.unitProperty] === undefined || fm[s.unitProperty] === null ? null : parseUnit(fm[s.unitProperty]);
    const { piece, source } = effectivePiece(own, def, ownUnit);
    const unit: PieceUnit = piece?.unit ?? ownUnit ?? "words";
    const counts = await port.counts(ch.path, seed, unit);
    return {
      path: ch.path,
      index: i,
      label: String(chapterNumber(ch.basename) ?? i + 1),
      title: chapterTitle(ch.basename),
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
      beats: parseBeats(seed.text),
      placeholders: port.placeholders(ch.path),
      bodyBlank: isBlankBody(seed.text),
    };
  }));
}
