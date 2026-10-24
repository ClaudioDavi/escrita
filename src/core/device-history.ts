// Pure history merging for several devices (PLAN-1.2.3, D3, D5, D8). No Obsidian imports.
//
// Each device writes only its own section of data.json; readers see one merged History.

import type { DayBook, DayRecord } from "../data";
import { renameKeys } from "./path-keys";
import { isRecord, safeEntries } from "./records";

/** Same shape as `History` in goals/tracker (core imports no module folder). */
export type History = Record<string, DayRecord>;

/** A book or folder rename, shared between devices so old sections can follow it. */
export interface Rename {
  from: string;
  to: string;
  /** ms timestamp of the rename */
  at: number;
}

export const RENAME_KEEP_MS = 400 * 24 * 60 * 60 * 1000;

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** The record's time; a record without `at` is the oldest (-1). */
function when(b: DayBook): number {
  return typeof b.at === "number" && Number.isFinite(b.at) ? b.at : -1;
}

function copyBook(b: DayBook): DayBook {
  const out: DayBook = { added: n(b.added), deleted: n(b.deleted), total: n(b.total) };
  if (typeof b.at === "number" && Number.isFinite(b.at)) out.at = b.at;
  return out;
}

function withAt(out: DayBook, at: number): DayBook {
  if (at >= 0) out.at = at;
  return out;
}

/** Counts add; the total comes from the record with the latest `at` (a tie takes the larger total). */
function sumBook(a: DayBook, b: DayBook): DayBook {
  const newer = when(a) > when(b) || (when(a) === when(b) && n(a.total) >= n(b.total)) ? a : b;
  return withAt(
    { added: n(a.added) + n(b.added), deleted: n(a.deleted) + n(b.deleted), total: n(newer.total) },
    Math.max(when(a), when(b)),
  );
}

/** Counts take the larger; the total comes from the newer record (a tie takes the larger total). */
function maxBook(a: DayBook, b: DayBook): DayBook {
  const newer = when(a) > when(b) || (when(a) === when(b) && n(a.total) >= n(b.total)) ? a : b;
  return withAt(
    { added: Math.max(n(a.added), n(b.added)), deleted: Math.max(n(a.deleted), n(b.deleted)), total: n(newer.total) },
    Math.max(when(a), when(b)),
  );
}

function has(o: object, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

function combine(
  sections: History[],
  book: (a: DayBook, b: DayBook) => DayBook,
  num: (a: number, b: number) => number,
): History {
  const out: History = {};
  for (const section of sections) {
    for (const [key, rec] of safeEntries(section)) {
      if (!isRecord(rec)) continue;
      const src = rec as unknown as DayRecord;
      let dst = out[key];
      if (!dst) {
        dst = { added: 0, deleted: 0, books: {} };
        out[key] = dst;
      }
      dst.added = num(dst.added, n(src.added));
      dst.deleted = num(dst.deleted, n(src.deleted));
      for (const [path, b] of safeEntries(src.books)) {
        if (!isRecord(b)) continue;
        const cur = copyBook(b as unknown as DayBook);
        dst.books[path] = has(dst.books, path) ? book(dst.books[path], cur) : cur;
      }
    }
  }
  return out;
}

/** Apply renames, in `at` order, to a copy of one section's book keys. */
function renamed(section: History, renames: Rename[]): History {
  const copy = combine([section], maxBook, Math.max);
  const sorted = [...renames].sort((a, b) => a.at - b.at);
  for (const r of sorted) {
    for (const rec of Object.values(copy)) renameKeys(rec.books, r.from, r.to, sumBook);
  }
  return copy;
}

/**
 * The view readers use: per day and per book, `added` and `deleted` summed over the base and every
 * device; `total` from the record with the latest `at`. Renames apply in `at` order to each section
 * first. Inputs are never changed.
 */
export function mergeHistories(base: History, devices: Record<string, History>, renames: Rename[]): History {
  const sections = [base, ...safeEntries(devices).map(([, h]) => h as History)];
  const fixed = sections.map((s) => renamed(s, renames));
  return combine(fixed, sumBook, (a, b) => a + b);
}

/** Per day and field the larger value; per book the larger counts and the newer total. Pure. */
export function maxHistory(a: History, b: History): History {
  return combine([a, b], maxBook, Math.max);
}

/**
 * `maxHistory` for the frozen base, which a 1.2.2 device still writes (and re-keys on a rename, with
 * no `renames` entry). Per day, when both sides have the same added and deleted totals but different
 * book keys, the disk side's books win (a rename written by an old version) instead of keeping both
 * and doubling the book's row: only when each side has a key the other lacks, as a rename leaves.
 * Otherwise the day merges as `maxHistory` does. Pure.
 */
export function maxBase(memory: History, disk: History): History {
  const out = maxHistory(memory, disk);
  for (const [key, d] of safeEntries(disk)) {
    const m = memory[key];
    if (!m || !isRecord(d) || !isRecord(m)) continue;
    const mk = Object.keys(m.books ?? {}).sort();
    const dk = Object.keys(d.books ?? {}).sort();
    if (n(m.added) !== n(d.added) || n(m.deleted) !== n(d.deleted)) continue;
    // a rename drops a key and adds one; a file that only lacks a key (stale, or a book total
    // memory has since read) merges as maxHistory and keeps it
    if (!dk.some((k) => !mk.includes(k)) || !mk.some((k) => !dk.includes(k))) continue;
    const books: Record<string, DayBook> = {};
    for (const [path, b] of safeEntries(d.books)) if (isRecord(b)) books[path] = copyBook(b as unknown as DayBook);
    out[key] = { added: n(d.added), deleted: n(d.deleted), books };
  }
  return out;
}

/** Union by from+to+at, dropping entries older than 400 days before `now`, sorted by `at`. */
export function unionRenames(a: Rename[], b: Rename[], now: number): Rename[] {
  const seen = new Map<string, Rename>();
  for (const r of [...a, ...b]) {
    if (r.at < now - RENAME_KEEP_MS) continue;
    const key = JSON.stringify([r.from, r.to, r.at]);
    if (!seen.has(key)) seen.set(key, { from: r.from, to: r.to, at: r.at });
  }
  return [...seen.values()].sort((x, y) => x.at - y.at);
}

/** One History from untrusted JSON: bad days and books are dropped, bad numbers become 0. */
export function cleanHistory(raw: unknown): History {
  const out: History = {};
  for (const [key, rec] of safeEntries(raw)) {
    if (!isRecord(rec)) continue;
    const day: DayRecord = { added: n(rec.added), deleted: n(rec.deleted), books: {} };
    for (const [path, b] of safeEntries(rec.books)) {
      if (!isRecord(b)) continue;
      day.books[path] = copyBook(b as unknown as DayBook);
    }
    out[key] = day;
  }
  return out;
}

/** The devices map from untrusted JSON. */
export function cleanDevices(raw: unknown): Record<string, History> {
  const out: Record<string, History> = {};
  for (const [id, h] of safeEntries(raw)) {
    if (isRecord(h)) out[id] = cleanHistory(h);
  }
  return out;
}

/** The renames list from untrusted JSON: only entries with two strings and a finite `at`. */
export function cleanRenames(raw: unknown): Rename[] {
  if (!Array.isArray(raw)) return [];
  const out: Rename[] = [];
  for (const r of raw) {
    if (!isRecord(r)) continue;
    if (typeof r.from !== "string" || typeof r.to !== "string" || r.from === "") continue;
    if (typeof r.at !== "number" || !Number.isFinite(r.at)) continue;
    out.push({ from: r.from, to: r.to, at: r.at });
  }
  return out;
}
