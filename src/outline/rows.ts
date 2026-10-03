// A chapter's row, loaded once for the outline view and the board (0.7 plan Q51,
// IMPROVEMENTS 7). Pure: no Obsidian or CodeMirror imports, no i18n. Stub until 2.2.

import type { Book } from "../core/books";
import type { BeatMarker } from "../core/markers";
import type { ChapterDefault, Counts, Piece, PieceUnit, Progress } from "../core/measure";
import type { Stage } from "../core/stages";
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

export interface RowsPort {
  chapters(book: Book): { path: string; basename: string }[];
  read(path: string): Promise<{ text: string; mtime: number }>;
  frontmatter(path: string): Record<string, unknown> | undefined;
  counts(path: string, seed: { text: string; mtime: number }, unit: PieceUnit): Promise<Counts>;
  placeholders(path: string): number;          // 0 when the feature is off
  chapterDefault(book: Book): ChapterDefault | null;
  resolvePov(value: unknown, path: string): PovValue | null;
  settings(): RowSettings;
}

export function loadRows(port: RowsPort, book: Book): Promise<ChapterRow[]> {
  throw new Error("todo");
}
