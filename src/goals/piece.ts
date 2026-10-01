// Pure helpers for showing a piece's progress (no Obsidian imports): the
// status bar segment, the tile's bar with its target and limit marks, and the
// pace in the piece's own unit. The counting, the target/limit rules and the
// status bar's Progress live in core/measure.ts.

import type { Piece, PieceUnit } from "../core/measure";

export interface PieceBar {
  /** 0–1: how much of the bar is filled */
  fill: number;
  /** 0–1: where the target falls on the bar, or null when it is the bar's end (or absent) */
  targetMark: number | null;
  /** 0–1: where the limit falls on the bar, or null when it is the bar's end (or absent) */
  limitMark: number | null;
}

/**
 * The tile's bar. Its scale is the largest of target, limit and count, so a
 * piece past its target or over its limit shows by how much, and a limit
 * beyond the target shows as a mark on the way. A mark at the very end of the
 * bar is left out (the end already shows it).
 */
export function pieceBar(count: number, piece: Pick<Piece, "target" | "limit">): PieceBar {
  const c = Number.isFinite(count) && count > 0 ? count : 0;
  const target = piece.target && piece.target > 0 ? piece.target : 0;
  const limit = piece.limit && piece.limit > 0 ? piece.limit : 0;
  const scale = Math.max(target, limit, c);
  if (scale <= 0) return { fill: 0, targetMark: null, limitMark: null };
  const mark = (v: number) => (v > 0 && v / scale < 0.999 ? v / scale : null);
  return { fill: c / scale, targetMark: mark(target), limitMark: mark(limit) };
}

/**
 * Words per day turned into the piece's unit. Writing history is kept in
 * words, so for a piece counted in characters the pace is estimated with the
 * piece's own characters per word (its current character count over its
 * current word count), which reflects its language and style. Null when that
 * ratio isn't known yet (no words).
 */
export function paceInUnit(wordsPerDay: number, unit: PieceUnit, count: number, words: number): number | null {
  const avg = Number.isFinite(wordsPerDay) && wordsPerDay > 0 ? wordsPerDay : 0;
  if (unit === "words") return avg;
  if (!(words > 0) || !(count > 0)) return null;
  return avg * (count / words);
}
