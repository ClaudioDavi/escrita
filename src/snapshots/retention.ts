// Which automatic snapshots to prune (no Obsidian imports). Only the automatic
// kinds (before publishing, before restoring, before the day's first edit) are
// counted and pruned, oldest first; snapshots the writer took, and stage-change
// snapshots (kind stage, not in AUTO_KINDS), are never touched.
// The caller sends pruned files to the trash, never a permanent delete.

import { AUTO_KINDS, type SnapshotEntry } from "./index-format";

/**
 * Files to prune so at most `keepAuto` (at least 1) automatic snapshots remain.
 * Files in `keep` (the one just taken, snapshots being restored or compared)
 * are never pruned; the next oldest go instead, or the count stays over for now.
 */
export function toPrune(entries: SnapshotEntry[], keepAuto: number, keep: string | Iterable<string> = []): string[] {
  const kept = new Set(typeof keep === "string" ? [keep] : keep);
  const n = Number.isFinite(keepAuto) ? Math.max(1, Math.floor(keepAuto)) : 1;
  const auto = entries
    .filter((e) => AUTO_KINDS.has(e.kind))
    .sort((a, b) => a.taken - b.taken || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  let excess = auto.length - n;
  const out: string[] = [];
  for (const e of auto) {
    if (excess <= 0) break;
    if (kept.has(e.file)) continue;
    out.push(e.file);
    excess--;
  }
  return out;
}
