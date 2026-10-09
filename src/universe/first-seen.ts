// When each thread was first seen (no Obsidian imports). Kept in the plugin's
// data, never in the note: notes carry no dates Escrita made up.
//
// A thread is identified by its note and its text. The record outlives the thread
// (a thread that disappears and comes back with the same text keeps its date) and
// goes only when the note is deleted. It follows renames through path-keys.

import { dropKeys, renameKeys } from "../core/path-keys";
import { safeEntries, isRecord } from "../core/records";

/** note path → thread key → first seen (ms since epoch) */
export type SeenStore = Record<string, Record<string, number>>;

/** Spacing and Unicode form don't make a different thread. */
export function seenKey(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Saved data (any shape) → a clean store: only finite, positive times under string keys. */
export function cleanSeen(raw: unknown): SeenStore {
  const out: SeenStore = {};
  for (const [path, keys] of safeEntries(raw)) {
    if (!isRecord(keys)) continue;
    const clean: Record<string, number> = {};
    for (const [k, v] of safeEntries(keys)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) clean[k] = Math.round(v);
    }
    if (Object.keys(clean).length > 0) out[path] = clean;
  }
  return out;
}

export function seenAt(store: SeenStore, path: string, text: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(store, path)) return null;
  const rec = store[path];
  const k = seenKey(text);
  return Object.prototype.hasOwnProperty.call(rec, k) ? rec[k] : null;
}

/** Records `now` for each text not yet known in the note. Returns whether the store changed. */
export function recordSeen(store: SeenStore, path: string, texts: readonly string[], now: number): boolean {
  let changed = false;
  for (const text of texts) {
    if (seenAt(store, path, text) !== null) continue;
    if (!Object.prototype.hasOwnProperty.call(store, path)) store[path] = {};
    store[path][seenKey(text)] = now;
    changed = true;
  }
  return changed;
}

/** On a collision (a renamed note lands on a path that has a record) the earlier date of each thread wins. */
function mergeSeen(moved: Record<string, number>, existing: Record<string, number>): Record<string, number> {
  const out = { ...existing };
  for (const [k, v] of Object.entries(moved)) out[k] = k in out ? Math.min(out[k], v) : v;
  return out;
}

export function renameSeen(store: SeenStore, oldPath: string, newPath: string): boolean {
  return renameKeys(store, oldPath, newPath, mergeSeen);
}

export function dropSeen(store: SeenStore, path: string): boolean {
  return dropKeys(store, path);
}

/** Drops the records of notes that no longer exist (deleted while the plugin was off). */
export function pruneSeen(store: SeenStore, exists: (path: string) => boolean): boolean {
  let changed = false;
  for (const path of Object.keys(store)) {
    if (!exists(path)) {
      delete store[path];
      changed = true;
    }
  }
  return changed;
}
