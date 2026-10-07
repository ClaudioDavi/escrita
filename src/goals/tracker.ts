// Pure word-goal bookkeeping over the history in data.json (no Obsidian imports).
//
// history["2026-09-29"] = { added, deleted, books: { "Novels/A Casa.md": { added, deleted, total } } }
//
// Everything here tolerates missing or malformed records: data.json is user
// territory and may have been edited by hand or written by an older version.

import type { DayBook, DayRecord } from "../data";
import { addDays, lastDays } from "../core/dates";
import { dropFromMap, isUnder, movedPath, renameInMap, renameKeys } from "../core/path-keys";

export type History = Record<string, DayRecord>;

/** A finite, non-negative number, or 0. */
export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

function day(history: History, key: string): DayRecord {
  let rec = history[key];
  if (!rec || typeof rec !== "object") {
    rec = { added: 0, deleted: 0, books: {} };
    history[key] = rec;
  }
  rec.added = num(rec.added);
  rec.deleted = num(rec.deleted);
  if (!rec.books || typeof rec.books !== "object") rec.books = {};
  return rec;
}

function dayBook(rec: DayRecord, bookPath: string, total: number): DayBook {
  let b = rec.books[bookPath];
  if (!b || typeof b !== "object") {
    b = { added: 0, deleted: 0, total: num(total) };
    rec.books[bookPath] = b;
  }
  b.added = num(b.added);
  b.deleted = num(b.deleted);
  return b;
}

export interface BookChange {
  /** book note path, the key in `DayRecord.books` */
  path: string;
  /** the book's word count after the change (sum of its chapters) */
  total: number;
}

/**
 * Record a counted change of `delta` words on writing day `dayKey`.
 * Positive deltas go to `added`, negative to `deleted`. When the change was in a
 * chapter, the book's day record gets the same delta and its new `total`.
 * Mutates and returns `history`.
 */
export function applyDelta(history: History, dayKey: string, delta: number, book?: BookChange | null): History {
  if (!Number.isFinite(delta)) delta = 0;
  const rec = day(history, dayKey);
  if (delta > 0) rec.added += delta;
  else if (delta < 0) rec.deleted += -delta;
  if (book) {
    const b = dayBook(rec, book.path, book.total);
    if (delta > 0) b.added += delta;
    else if (delta < 0) b.deleted += -delta;
    b.total = num(book.total);
  }
  return history;
}

/** Update only a book's total (for changes that are not counted as writing, e.g. pastes). */
export function recordBookTotal(history: History, dayKey: string, book: BookChange): History {
  const rec = day(history, dayKey);
  dayBook(rec, book.path, book.total).total = num(book.total);
  return history;
}

/** Combine a moved book record with the one already at its new path: counts add, the existing total stands. */
export function sumDayBook(moved: DayBook, existing: DayBook): DayBook {
  return {
    added: num(existing?.added) + num(moved?.added),
    deleted: num(existing?.deleted) + num(moved?.deleted),
    total: num(existing?.total),
  };
}

/** Move records at `oldPath`, or under it when it is a folder, to `newPath`. Returns whether anything moved. */
export function renameBook(history: History, oldPath: string, newPath: string): boolean {
  if (oldPath === newPath) return false;
  let moved = false;
  for (const rec of Object.values(history)) {
    const books = rec?.books;
    if (!books || typeof books !== "object") continue;
    if (renameKeys(books, oldPath, newPath, sumDayBook)) moved = true;
  }
  return moved;
}

/** Words added on a day, vault-wide or for one book. */
export function addedOn(history: History, dayKey: string, bookPath?: string | null): number {
  const rec = history[dayKey];
  if (!rec) return 0;
  if (bookPath) return num(rec.books?.[bookPath]?.added);
  return num(rec.added);
}

/** Words deleted on a day, vault-wide or for one book. */
export function deletedOn(history: History, dayKey: string, bookPath?: string | null): number {
  const rec = history[dayKey];
  if (!rec) return 0;
  if (bookPath) return num(rec.books?.[bookPath]?.deleted);
  return num(rec.deleted);
}

/** Words added minus words deleted on a day. */
export function netOn(history: History, dayKey: string, bookPath?: string | null): number {
  return addedOn(history, dayKey, bookPath) - deletedOn(history, dayKey, bookPath);
}

/** A day's goal is met when it reaches a positive goal (with no goal, any writing counts). */
export function goalMet(words: number, goal: number): boolean {
  return goal > 0 ? words >= goal : words > 0;
}

/** Tells whether a writing day (YYYY-MM-DD) is a day off; see core/daysoff. */
export type IsDayOff = (day: string) => boolean;

/**
 * Consecutive days with writing (`added > 0`) ending today, or ending yesterday
 * when nothing has been written today yet (so the streak isn't "broken" at breakfast).
 *
 * With `isDayOff`, a day off with no writing is skipped: it neither breaks nor
 * extends the streak. Writing on a day off still counts and extends it.
 */
export function streak(history: History, today: string, isDayOff?: IsDayOff | null): number {
  let d = addedOn(history, today) > 0 ? today : addDays(today, -1);
  let n = 0;
  if (!isDayOff) {
    // Bounded so a corrupt history can never loop forever.
    while (n < 100000 && addedOn(history, d) > 0) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }
  // Nothing before the oldest record can extend the streak, so stop there
  // (this also ends the walk when every day is a day off).
  const oldest = oldestDay(history);
  if (oldest === null) return 0;
  for (let steps = 0; steps < 100000 && d >= oldest; steps++) {
    if (addedOn(history, d) > 0) n++;
    else if (!isDayOff(d)) break;
    d = addDays(d, -1);
  }
  return n;
}

/** The earliest well-formed day key in the history, or null. */
function oldestDay(history: History): string | null {
  let oldest: string | null = null;
  for (const k of Object.keys(history)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (oldest === null || k < oldest)) oldest = k;
  }
  return oldest;
}

/** Days in `days` whose vault-wide writing met `goal`. */
export function goalMetDays(history: History, days: string[], goal: number): number {
  return days.filter((d) => goalMet(addedOn(history, d), goal)).length;
}

/**
 * "Goal met on `met` of `of` days" over a window, with days off taken out of
 * the count: a day off where the goal wasn't met is left out of both numbers
 * (resting isn't missing the goal), while a day off where it was met counts
 * in both (the work was done). Without days off, `of` is the window length.
 */
export function goalMetSummary(
  history: History, days: string[], goal: number, isDayOff?: IsDayOff | null,
): { met: number; of: number } {
  let met = 0;
  let of = 0;
  for (const d of days) {
    const ok = goalMet(addedOn(history, d), goal);
    if (ok) met++;
    if (ok || !isDayOff?.(d)) of++;
  }
  return { met, of };
}

/** Words added per day for the given days (vault-wide, or one book). */
export function dailySeries(history: History, days: string[], bookPath?: string | null): number[] {
  return days.map((d) => addedOn(history, d, bookPath));
}

/** Sum of words added over the given days. */
export function sumAdded(history: History, days: string[], bookPath?: string | null): number {
  return dailySeries(history, days, bookPath).reduce((a, b) => a + b, 0);
}

/**
 * The book's word count at the end of each day. Days without a record carry the
 * last known total forward; days before the first record use the first record's
 * total minus that day's net words (the count before the first tracked session).
 * With no records at all, every day is `fallback` (e.g. the live count).
 */
export function bookTotalSeries(history: History, days: string[], bookPath: string, fallback = 0): number[] {
  const recorded = Object.keys(history)
    .filter((d) => {
      const b = history[d]?.books?.[bookPath];
      return !!b && typeof b === "object" && Number.isFinite(b.total);
    })
    .sort();
  if (recorded.length === 0) return days.map(() => num(fallback));
  const first = recorded[0];
  const firstRec = history[first].books[bookPath];
  const before = Math.max(0, num(firstRec.total) - (num(firstRec.added) - num(firstRec.deleted)));
  let i = 0;
  let last = before;
  const sortedDays = days.map((d, idx) => ({ d, idx })).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const out: number[] = new Array<number>(days.length).fill(0);
  for (const { d, idx } of sortedDays) {
    while (i < recorded.length && recorded[i] <= d) {
      last = num(history[recorded[i]].books[bookPath].total);
      i++;
    }
    out[idx] = last;
  }
  return out;
}

/**
 * Average words per day over the last `n` days. Uses the window ending yesterday
 * when nothing has been added today yet, so a fresh morning doesn't drag it down.
 * `net` averages added minus deleted (floored at 0), which is what grows a book.
 *
 * With `isDayOff`, the average is per writing day: days off without any
 * activity are left out of the denominator (a rest day doesn't drag the pace
 * down), while a day off with writing counts like any other day. Pacing
 * projects over writing days only, so the two agree.
 */
export function dailyAverage(
  history: History,
  today: string,
  opts: { days?: number; bookPath?: string | null; net?: boolean; isDayOff?: IsDayOff | null } = {},
): number {
  const n = Math.max(1, Math.floor(opts.days ?? 7));
  const end = addedOn(history, today, opts.bookPath) > 0 ? today : addDays(today, -1);
  let window = lastDays(end, n);
  const off = opts.isDayOff;
  if (off) {
    window = window.filter((d) => !off(d) || addedOn(history, d, opts.bookPath) > 0 || deletedOn(history, d, opts.bookPath) > 0);
    if (window.length === 0) return 0;
  }
  const values = window.map((d) => (opts.net ? netOn(history, d, opts.bookPath) : addedOn(history, d, opts.bookPath)));
  const avg = values.reduce((a, b) => a + b, 0) / (off ? window.length : n);
  return Number.isFinite(avg) ? Math.max(0, avg) : 0;
}

/**
 * Per-day state for the streak segments: "met", "wrote" (below goal), "none",
 * or "off" for a day off without writing (only with `isDayOff`).
 */
export function dayStates(
  history: History, days: string[], goal: number, isDayOff?: IsDayOff | null,
): ("met" | "wrote" | "none" | "off")[] {
  return days.map((d) => {
    const w = addedOn(history, d);
    if (w <= 0) return isDayOff?.(d) ? "off" : "none";
    return goalMet(w, goal) ? "met" : "wrote";
  });
}

/**
 * Whether a single change should count as writing: jumps bigger than
 * `ignoreOver` words (pastes, imports, syncs) don't.
 */
export function countsAsWriting(delta: number, ignoreOver: number): boolean {
  if (!Number.isFinite(delta) || delta === 0) return false;
  if (!(ignoreOver > 0)) return true;
  return Math.abs(delta) <= ignoreOver;
}

/**
 * Which files count as "being typed in". The active file does, and so does a
 * file that stopped being active less than `graceMs` ago: the editor saves on a
 * debounce, so the last words typed before switching tabs land a moment later.
 */
export class ActiveFiles {
  private current: string | null = null;
  private left = new Map<string, number>();

  constructor(private graceMs = 5000) {}

  /** `path` became the active file (null = none) at `now`. */
  focus(path: string | null, now: number): void {
    if (this.current === path) return;
    if (this.current) this.left.set(this.current, now);
    this.current = path;
    if (path) this.left.delete(path);
    for (const [p, at] of this.left) if (now - at >= this.graceMs) this.left.delete(p);
  }

  /** Whether a change to `path` at `now` comes from typing. `active` is the workspace's active file right now. */
  accepts(path: string, active: string | null, now: number): boolean {
    if (active !== null && active === path) return true;
    const at = this.left.get(path);
    return at !== undefined && now - at < this.graceMs;
  }

  rename(oldPath: string, newPath: string): void {
    if (this.current !== null) {
      const to = movedPath(this.current, oldPath, newPath);
      if (to !== null) this.current = to;
    }
    renameInMap(this.left, oldPath, newPath);
  }

  forget(path: string): void {
    if (this.current !== null && isUnder(this.current, path)) this.current = null;
    dropFromMap(this.left, path);
  }
}
