// Measuring a note (no Obsidian imports): its length in words and characters,
// the piece it is (a target, a limit, the unit they're counted in, a
// deadline), a book's goal, and how far along either is. The one amount parser
// and the one deadline parser live here. The Obsidian side (the per-file cache,
// vault events) is core/measurer.ts.

import { charLength, proseOnly, readerTextOf, wordsIn } from "./wordcount";
import { isoDay } from "./dates";

export type PieceUnit = "words" | "characters" | "characters-no-spaces";

export const PIECE_UNITS: readonly PieceUnit[] = ["words", "characters", "characters-no-spaces"];

/** The frontmatter property read for a deadline when no name is configured. */
export const DEFAULT_DEADLINE_PROPERTY = "deadline";
/** The frontmatter property read for a book's word goal when no name is configured. */
export const DEFAULT_GOAL_PROPERTY = "goal";

/** At or above this share of the limit, a piece is "near" it. */
export const NEAR_LIMIT = 0.95;

// ── Counts ───────────────────────────────────────────────────────────────

/**
 * A note's length. `words` is computed up front; the two character counts are
 * computed on first read (they cost about three times as much as the words and
 * only notes counted in characters need them), then remembered. Read them like
 * plain numbers.
 */
export interface Counts {
  readonly words: number;
  readonly characters: number;
  readonly charactersNoSpaces: number;
}

export const ZERO: Readonly<Counts> = Object.freeze({ words: 0, characters: 0, charactersNoSpaces: 0 });

/** Counts whose character fields are computed from `chars()` on first read (own, enumerable getters). */
function lazyCounts(words: number, chars: () => [number, number]): Counts {
  let memo: [number, number] | null = null;
  const get = (): [number, number] => (memo ??= chars());
  return Object.defineProperties({ words } as Counts, {
    characters: { get: () => get()[0], enumerable: true },
    charactersNoSpaces: { get: () => get()[1], enumerable: true },
  });
}

/**
 * One segment pass over a note's Markdown: words now (countWords' rule), the
 * characters with and without spaces (countCharacters' rule) when first read.
 */
export function measureText(md: string): Counts {
  let prose: string | null = proseOnly(md);
  const words = wordsIn(prose);
  return lazyCounts(words, () => {
    const r = readerTextOf(prose ?? "");
    prose = null; // computed once: let the text go
    return [charLength(r), charLength(r.replace(/ /g, ""))];
  });
}

/** The count in a unit. Reading "words" never computes the characters. */
export function countIn(c: Counts, unit: PieceUnit): number {
  if (unit === "characters") return c.characters;
  if (unit === "characters-no-spaces") return c.charactersNoSpaces;
  return c.words;
}

/** The sum of several counts (words now, characters when first read). An empty list gives zeros. */
export function sumCounts(list: Iterable<Counts>): Counts {
  const all = [...list];
  let words = 0;
  for (const c of all) words += c.words;
  return lazyCounts(words, () => {
    let a = 0, b = 0;
    for (const c of all) { a += c.characters; b += c.charactersNoSpaces; }
    return [a, b];
  });
}

/** Same words and characters. The characters are compared (and so computed) only when the words agree. */
export function sameCounts(a: Counts, b: Counts): boolean {
  if (a === b) return true;
  return a.words === b.words && a.characters === b.characters && a.charactersNoSpaces === b.charactersNoSpaces;
}

// ── Pieces and book goals ────────────────────────────────────────────────

export interface PieceProperties {
  targetProperty: string;
  limitProperty: string;
  unitProperty: string;
  /** defaults to DEFAULT_DEADLINE_PROPERTY */
  deadlineProperty?: string;
}

export interface BookGoalProperties {
  /** defaults to DEFAULT_GOAL_PROPERTY */
  goalProperty?: string;
  /** defaults to DEFAULT_DEADLINE_PROPERTY */
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
 * The only amount parser, for lengths and goals from frontmatter: 15000,
 * "15000", "15.000", "15,000", "15 000". Returns a positive whole number, or
 * undefined for anything else (0, negatives, text, "1.000,5").
 *
 * Separators only work in strings. YAML reads an unquoted `goal: 80.000` as
 * the float 80 (and `1.500` as 1.5) before Escrita sees it, and that number
 * can't be told apart from a real 80, so it is taken as 80; the settings text
 * tells writers to quote amounts with separators.
 */
export function parseAmount(v: unknown): number | undefined {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.replace(/[\s  _]/g, "");
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

/**
 * The only deadline parser. A string YYYY-MM-DD (optionally followed by "T…"
 * or a space and a time) is taken literally; rollovers like 2026-02-31 are
 * rejected. A Date at UTC midnight (how YAML dates arrive) gives its UTC day;
 * a Date at local midnight that isn't UTC midnight (built by other code) gives
 * its local day; any other Date gives its UTC day. Anything else → undefined.
 */
export function parseDeadline(v: unknown): string | undefined {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return undefined;
    const utcMidnight = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0 && v.getUTCMilliseconds() === 0;
    const localMidnight = v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0 && v.getMilliseconds() === 0;
    return !utcMidnight && localMidnight ? isoDay(v) : v.toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(v.trim());
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

/** The piece settings of a note, or null when it has no valid target, limit or deadline. */
export function readPiece(frontmatter: Record<string, unknown> | null | undefined, props: PieceProperties): Piece | null {
  if (!isRecord(frontmatter)) return null;
  const target = parseAmount(frontmatter[props.targetProperty]);
  const limit = parseAmount(frontmatter[props.limitProperty]);
  const deadline = parseDeadline(frontmatter[props.deadlineProperty || DEFAULT_DEADLINE_PROPERTY]);
  if (target === undefined && limit === undefined && deadline === undefined) return null;
  const piece: Piece = { unit: parseUnit(frontmatter[props.unitProperty]) };
  if (target !== undefined) piece.target = target;
  if (limit !== undefined) piece.limit = limit;
  if (deadline !== undefined) piece.deadline = deadline;
  return piece;
}

/**
 * The unit a note is counted in, whether or not it is a piece: a note with
 * only `unit: characters` (no target, limit or deadline) is still shown in
 * characters. "words" without frontmatter.
 */
export function readUnit(frontmatter: Record<string, unknown> | null | undefined, props: Pick<PieceProperties, "unitProperty">): PieceUnit {
  return isRecord(frontmatter) ? parseUnit(frontmatter[props.unitProperty]) : "words";
}

export interface BookGoal {
  /** words */
  goal: number | null;
  /** YYYY-MM-DD */
  deadline: string | null;
}

/** A book note's goal (via parseAmount) and deadline (via parseDeadline), under the configured names. */
export function readBookGoal(frontmatter: Record<string, unknown> | null | undefined, props: BookGoalProperties): BookGoal {
  if (!isRecord(frontmatter)) return { goal: null, deadline: null };
  return {
    goal: parseAmount(frontmatter[props.goalProperty || DEFAULT_GOAL_PROPERTY]) ?? null,
    deadline: parseDeadline(frontmatter[props.deadlineProperty || DEFAULT_DEADLINE_PROPERTY]) ?? null,
  };
}

/** A book note's default for its chapters: a target, and optionally the unit it is counted in (Q47). */
export interface ChapterDefault { target: number; unit: PieceUnit | null }

/** The book note's chapter target (via parseAmount) and unit, under the configured names; null when it sets no target (Q47). */
export function readChapterDefault(
  fm: Record<string, unknown> | null | undefined,
  props: { chapterTargetProperty: string; unitProperty: string },
): ChapterDefault | null {
  if (!isRecord(fm)) return null;
  const target = parseAmount(fm[props.chapterTargetProperty]);
  if (target === undefined) return null;
  const raw = fm[props.unitProperty];
  const hasUnit = typeof raw === "string" && raw.trim() !== "";
  return { target, unit: hasUnit ? parseUnit(raw) : null };
}

/**
 * Per field: the chapter's own target wins, else the book default (Q48). The
 * own `limit` and `deadline` are kept. The unit is `ownUnit ?? def.unit ??
 * "words"` (`ownUnit` is null when the chapter has no unit property, so
 * `own.unit` is ignored then). `source` says where the target came from.
 */
export function effectivePiece(
  own: Piece | null,
  def: ChapterDefault | null,
  ownUnit: PieceUnit | null,
): { piece: Piece | null; source: "own" | "book" | null } {
  if (!own && !def) return { piece: null, source: null };
  const unit = ownUnit ?? def?.unit ?? "words";
  const piece: Piece = { unit };
  let source: "own" | "book" | null = null;
  if (own?.target !== undefined) { piece.target = own.target; source = "own"; }
  else if (def) { piece.target = def.target; source = "book"; }
  if (own?.limit !== undefined) piece.limit = own.limit;
  if (own?.deadline !== undefined) piece.deadline = own.deadline;
  return { piece, source };
}

// ── Progress ─────────────────────────────────────────────────────────────

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

/** What the status bar, the outline, the explorer and the progress modal show about a note. */
export interface Progress {
  unit: PieceUnit;
  /** clamped: finite and ≥ 0 */
  count: number;
  /** the target, else the limit, else null */
  of: number | null;
  kind: "target" | "limit" | "none";
  target?: number;
  limit?: number;
  deadline?: string;
  state: PieceState;
  /** count − limit when over, else 0 */
  over: number;
  /** count ≥ target (false without a target) */
  reached: boolean;
  /** 0–1: count against `of` (the bar fill) */
  fraction: number;
}

type ProgressPiece = { unit?: PieceUnit; target?: number; limit?: number; deadline?: string };

/** `count` is already in the piece's unit. A null piece (or one without a unit) → unit "words", kind "none". */
export function progressOf(count: number, piece: ProgressPiece | null): Progress {
  const target = piece?.target, limit = piece?.limit;
  const p = pieceProgress({ count, target, limit });
  const c = Number.isFinite(count) && count > 0 ? count : 0;
  const t = target && Number.isFinite(target) && target > 0 ? target : undefined;
  const l = limit && Number.isFinite(limit) && limit > 0 ? limit : undefined;
  const out: Progress = {
    unit: piece?.unit ?? "words",
    count: c,
    of: t ?? l ?? null,
    kind: t !== undefined ? "target" : l !== undefined ? "limit" : "none",
    state: p.state,
    over: p.over,
    reached: p.reached,
    fraction: Math.min(1, Math.max(0, p.ratio)),
  };
  if (t !== undefined) out.target = t;
  if (l !== undefined) out.limit = l;
  if (piece?.deadline) out.deadline = piece.deadline;
  return out;
}

/**
 * A note's progress from its counts. The unit is the piece's; `unit` (from
 * readUnit) covers a note that has a unit but no target, limit or deadline.
 */
export function noteProgress(counts: Counts, piece: Piece | null, unit?: PieceUnit): Progress {
  const u = piece?.unit ?? unit ?? "words";
  return progressOf(countIn(counts, u), piece ?? { unit: u });
}

// ── Labels (keys only; src/i18n.ts turns them into text) ─────────────────

/** The plural base key for an amount in a unit ("common.unit.words", …). */
export function unitKey(unit: PieceUnit): string {
  if (unit === "characters") return "common.unit.characters";
  if (unit === "characters-no-spaces") return "common.unit.charactersNoSpaces";
  return "common.unit.words";
}

/** "goals.days" + 1 → "goals.days.one"; anything else → ".other" (right for en and pt-BR, including 0). */
export function pluralKey(base: string, n: number): string {
  return `${base}.${Math.round(n) === 1 ? "one" : "other"}`;
}
