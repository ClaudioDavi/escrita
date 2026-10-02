// The live list of works and their desk entries (no Obsidian imports).

import type { Piece, PieceUnit } from "./measure";
import { STAGES, type Stage } from "./stages";
import type { IndexChange } from "./vault-index";

export type DeskRole = "book" | "note" | "chapter" | "unstaged";

export interface DeskEntry {
  role: DeskRole;
  stage: Stage | null;
  title: string;
  /** book note path, for chapters */
  book?: string;
  target?: number;
  limit?: number;
  unit?: PieceUnit;
  deadline?: string;
  goal?: number;
}

export interface WorksReader {
  get(path: string): DeskEntry | undefined;
  list(): Iterable<[string, DeskEntry]>;
  isReady(): boolean;
  onReady(cb: () => void): () => void;
  onChange(cb: (c: readonly IndexChange<DeskEntry>[]) => void): () => void;
}

function hasStatus(status: unknown): boolean {
  return (typeof status === "string" || typeof status === "number") && String(status).trim() !== "";
}

/**
 * The desk entry for a file, or undefined when it is not on the desk. Books and
 * notes take the stage classify() found; the raw status only tells an unknown
 * word (unstaged) from no status at all. Chapters carry the stage of their own status.
 */
export function deskEntry(
  p: { kind: string; tracked: boolean; snapshot: boolean; piece: Piece | null; stage: Stage | null; bookNotePath?: string; title: string },
  status: unknown,
  stageOf: (s: unknown) => Stage | null,
  bookGoal?: number,
): DeskEntry | undefined {
  if (p.snapshot || !p.tracked) return undefined;
  if (p.kind === "chapter") {
    const e: DeskEntry = { role: "chapter", stage: stageOf(status), title: p.title };
    if (p.bookNotePath !== undefined) e.book = p.bookNotePath;
    return e;
  }
  if (p.kind !== "book-note" && p.kind !== "note") return undefined;
  if (p.stage === null) {
    return hasStatus(status) ? { role: "unstaged", stage: null, title: p.title } : undefined;
  }
  const e: DeskEntry = { role: p.kind === "book-note" ? "book" : "note", stage: p.stage, title: p.title };
  if (e.role === "book") {
    if (bookGoal !== undefined) e.goal = bookGoal;
  } else if (p.piece) {
    if (p.piece.target !== undefined) e.target = p.piece.target;
    if (p.piece.limit !== undefined) e.limit = p.piece.limit;
    e.unit = p.piece.unit;
    if (p.piece.deadline !== undefined) e.deadline = p.piece.deadline;
  }
  return e;
}

export function sameDeskEntry(a: DeskEntry, b: DeskEntry): boolean {
  return a.role === b.role && a.stage === b.stage && a.title === b.title && a.book === b.book
    && a.target === b.target && a.limit === b.limit && a.unit === b.unit
    && a.deadline === b.deadline && a.goal === b.goal;
}

/** Chapters of a book at `min` stage or later, out of all its chapters. */
export function bookChapterProgress(
  entries: Iterable<[string, DeskEntry]>,
  bookNotePath: string,
  min: Stage,
): { done: number; total: number } {
  const from = STAGES.indexOf(min);
  let done = 0, total = 0;
  for (const [, e] of entries) {
    if (e.role !== "chapter" || e.book !== bookNotePath) continue;
    total++;
    if (e.stage !== null && STAGES.indexOf(e.stage) >= from) done++;
  }
  return { done, total };
}
