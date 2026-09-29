// Pure word-goal bookkeeping over the history in data.json (no Obsidian imports).
//
// history["2026-09-29"] = { added, deleted, books: { "Novels/A Casa.md": { added, deleted, total } } }
//
// Everything here tolerates missing or malformed records: data.json is user
// territory and may have been edited by hand or written by an older version.

import type { DayBook, DayRecord } from "../data";
import { addDays, lastDays } from "../core/dates";

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

/** Move a book's records to a new note path (the book note was renamed). Returns whether anything moved. */
export function renameBook(history: History, oldPath: string, newPath: string): boolean {
  if (oldPath === newPath) return false;
  let moved = false;
  for (const rec of Object.values(history)) {
    const books = rec?.books;
    if (!books || typeof books !== "object" || !(oldPath in books)) continue;
    const from = books[oldPath];
    const to = books[newPath];
    books[newPath] = to
      ? { added: num(to.added) + num(from?.added), deleted: num(to.deleted) + num(from?.deleted), total: num(to.total) }
      : from;
    delete books[oldPath];
    moved = true;
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

/**
 * Consecutive days with writing (`added > 0`) ending today, or ending yesterday
 * when nothing has been written today yet (so the streak isn't "broken" at breakfast).
 */
export function streak(history: History, today: string): number {
  let d = addedOn(history, today) > 0 ? today : addDays(today, -1);
  let n = 0;
  // Bounded so a corrupt history can never loop forever.
  while (n < 100000 && addedOn(history, d) > 0) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Days in `days` whose vault-wide writing met `goal`. */
export function goalMetDays(history: History, days: string[], goal: number): number {
  return days.filter((d) => goalMet(addedOn(history, d), goal)).length;
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
  const out: number[] = new Array(days.length).fill(0);
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
 */
export function dailyAverage(
  history: History,
  today: string,
  opts: { days?: number; bookPath?: string | null; net?: boolean } = {},
): number {
  const n = Math.max(1, Math.floor(opts.days ?? 7));
  const end = addedOn(history, today, opts.bookPath) > 0 ? today : addDays(today, -1);
  const window = lastDays(end, n);
  const values = window.map((d) => (opts.net ? netOn(history, d, opts.bookPath) : addedOn(history, d, opts.bookPath)));
  const avg = values.reduce((a, b) => a + b, 0) / n;
  return Number.isFinite(avg) ? Math.max(0, avg) : 0;
}

/** Per-day state for the streak segments: "met", "wrote" (below goal) or "none". */
export function dayStates(history: History, days: string[], goal: number): ("met" | "wrote" | "none")[] {
  return days.map((d) => {
    const w = addedOn(history, d);
    if (w <= 0) return "none";
    return goalMet(w, goal) ? "met" : "wrote";
  });
}

/** Whether `path` is `folder` itself or inside it. */
export function inFolder(path: string, folder: string): boolean {
  const f = folder.replace(/^\/+|\/+$/g, "");
  if (!f) return true;
  return path === f || path.startsWith(f + "/");
}

/**
 * Whether writing in `path` counts: a Markdown file inside one of `track` (or
 * anywhere when `track` is empty), not inside `exclude`, and not the chapter template.
 */
export function isTrackedPath(path: string, track: string[], exclude: string[], template = ""): boolean {
  if (!/\.md$/i.test(path)) return false;
  if (track.length > 0 && !track.some((f) => inFolder(path, f))) return false;
  if (exclude.some((f) => f.replace(/^\/+|\/+$/g, "") && inFolder(path, f))) return false;
  const tpl = template.trim().replace(/^\/+/, "");
  if (tpl) {
    const withExt = /\.md$/i.test(tpl) ? tpl : `${tpl}.md`;
    if (path === withExt) return false;
  }
  return true;
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
    if (this.current === oldPath) this.current = newPath;
    const at = this.left.get(oldPath);
    if (at !== undefined) { this.left.delete(oldPath); this.left.set(newPath, at); }
  }

  forget(path: string): void {
    if (this.current === path) this.current = null;
    this.left.delete(path);
  }
}
