// Targets per piece (no Obsidian imports). Any note can carry a target length,
// a hard limit (often a contest's, often in characters with spaces), the unit
// they're counted in, and a deadline. Property names come from settings.

import { countCharacters, countWords } from "./wordcount";

export type PieceUnit = "words" | "characters" | "characters-no-spaces";

export const PIECE_UNITS: readonly PieceUnit[] = ["words", "characters", "characters-no-spaces"];

/** The frontmatter property books and pieces use for their deadline (not configurable). */
export const DEADLINE_PROPERTY = "deadline";

/** At or above this share of the limit, a piece is "near" it. */
export const NEAR_LIMIT = 0.95;

export interface PieceProperties {
  targetProperty: string;
  limitProperty: string;
  unitProperty: string;
  /** defaults to DEADLINE_PROPERTY */
  deadlineProperty?: string;
}

export interface Piece {
  target?: number;
  limit?: number;
  unit: PieceUnit;
  /** YYYY-MM-DD */
  deadline?: string;
}

/**
 * A length from frontmatter: 15000, "15000", "15.000", "15,000", "15 000".
 * Returns a positive whole number, or undefined for anything else (0, negatives, text).
 */
export function parseAmount(v: unknown): number | undefined {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.replace(/[\s  _]/g, "");
    if (/^\d{1,3}(?:([.,])\d{3})(?:\1\d{3})*$/.test(s)) n = Number(s.replace(/[.,]/g, ""));
    else if (/^\d+(?:[.,]\d+)?$/.test(s)) n = Number(s.replace(",", "."));
    else return undefined;
  } else return undefined;
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r > 0 ? r : undefined;
}

/** A unit value from frontmatter → PieceUnit. Accepts a few spellings (and Portuguese); unknown or empty → "words". */
export function parseUnit(v: unknown): PieceUnit {
  if (typeof v !== "string") return "words";
  const s = v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  if (/^(characters?|chars?|caracteres?)(-with-spaces|-com-espacos)?$/.test(s)) return "characters";
  if (/^(characters?|chars?|caracteres?)-(no|without|sem)-espacos$|^(characters?|chars?)-(no|without)-spaces$/.test(s)) {
    return "characters-no-spaces";
  }
  return "words";
}

/** YYYY-MM-DD (string or Date from YAML) → YYYY-MM-DD, or undefined; rejects rollovers like 2026-02-31. */
export function parseDeadline(v: unknown): string | undefined {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return undefined;
    // YAML dates parse as UTC midnight.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(v.trim());
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** The piece settings of a note, or null when it has no valid target, limit or deadline. */
export function readPiece(frontmatter: Record<string, unknown> | null | undefined, props: PieceProperties): Piece | null {
  if (!frontmatter || typeof frontmatter !== "object") return null;
  const target = parseAmount(frontmatter[props.targetProperty]);
  const limit = parseAmount(frontmatter[props.limitProperty]);
  const deadline = parseDeadline(frontmatter[props.deadlineProperty || DEADLINE_PROPERTY]);
  if (target === undefined && limit === undefined && deadline === undefined) return null;
  const piece: Piece = { unit: parseUnit(frontmatter[props.unitProperty]) };
  if (target !== undefined) piece.target = target;
  if (limit !== undefined) piece.limit = limit;
  if (deadline !== undefined) piece.deadline = deadline;
  return piece;
}

/** Length of a note's Markdown in the piece's unit. */
export function pieceCount(md: string, unit: PieceUnit): number {
  if (unit === "characters") return countCharacters(md, { spaces: true });
  if (unit === "characters-no-spaces") return countCharacters(md, { spaces: false });
  return countWords(md);
}

export type PieceState = "none" | "under" | "near" | "over";

export interface PieceProgress {
  /** count / target when there is a target, else count / limit, else 0 (not clamped) */
  ratio: number;
  /**
   * Relation to the limit: "over" past it, "near" at ≥ 95% of it (up to and
   * including the limit), "under" below that or when there is only a target,
   * "none" when there is neither a target nor a limit.
   */
  state: PieceState;
  /** count − limit when over, else 0 */
  over: number;
  /** count ≥ target (false without a target) */
  reached: boolean;
  targetRatio?: number;
  limitRatio?: number;
}

export function pieceProgress(p: { count: number; target?: number | null; limit?: number | null }): PieceProgress {
  const count = Number.isFinite(p.count) && p.count > 0 ? p.count : 0;
  const target = p.target && Number.isFinite(p.target) && p.target > 0 ? p.target : undefined;
  const limit = p.limit && Number.isFinite(p.limit) && p.limit > 0 ? p.limit : undefined;
  const out: PieceProgress = { ratio: 0, state: "none", over: 0, reached: false };
  if (target !== undefined) {
    out.targetRatio = count / target;
    out.reached = count >= target;
  }
  if (limit !== undefined) out.limitRatio = count / limit;
  out.ratio = out.targetRatio ?? out.limitRatio ?? 0;
  if (limit !== undefined) {
    if (count > limit) { out.state = "over"; out.over = count - limit; }
    else if (count >= NEAR_LIMIT * limit) out.state = "near";
    else out.state = "under";
  } else if (target !== undefined) out.state = "under";
  return out;
}
