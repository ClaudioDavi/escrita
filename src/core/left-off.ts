// Where the writer left off in a note (no Obsidian imports).
// Wave 0 contract: types only.

export interface LeftOff { offset: number; before: string; after: string; at: number }

export interface LeftOffEvents { onChange(cb: (paths: readonly string[]) => void): () => void }

import { contextAt, findRestoreOffset } from "./anchor";
import { parseBeats } from "./markers";
import { segment } from "./markdown";
import type { DeskRole } from "./works";

/** Editor and file offsets agree only on LF text, so everything works on that. */
function lf(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/** Remember a spot: a small context around `offset` keeps data.json small. */
export function makeLeftOff(text: string, offset: number, now: number, ctx = 48): LeftOff {
  return { ...contextAt(lf(text), offset, ctx), at: now };
}

/** Where the remembered spot is now: the exact place if it still matches, else the anchor rule. */
export function findLeftOff(text: string, e: LeftOff): number | null {
  const src = lf(text);
  if ((e.before || e.after) && e.offset >= 0 && e.offset <= src.length
    && src.slice(Math.max(0, e.offset - e.before.length), e.offset) === e.before
    && src.startsWith(e.after, e.offset)) {
    return e.offset;
  }
  return findRestoreOffset(src, e.before, e.after);
}

/** Start of the line after the first unwritten beat; the end of the beat line when it is the last line. */
export function firstUnwrittenBeatOffset(text: string): number | null {
  const src = lf(text);
  const beat = parseBeats(src).find((b) => !b.written);
  if (!beat) return null;
  const md = segment(src);
  return beat.line + 1 < md.lineCount ? md.lineStart(beat.line + 1) : md.lineEnd(beat.line);
}

/** Where to open a note: the record, else the first unwritten beat, else the end. */
/** Where a note should open, as an editor line and column on LF text. */
export function spotPosition(text: string, e: LeftOff | null): { line: number; ch: number } {
  const body = lf(text);
  const { offset } = noteSpot(body, e);
  const before = body.slice(0, Math.max(0, Math.min(offset, body.length)));
  const nl = before.lastIndexOf("\n");
  let line = 0;
  for (let i = 0; i < before.length; i++) if (before.charCodeAt(i) === 10) line++;
  return { line, ch: before.length - (nl + 1) };
}

export function noteSpot(text: string, e: LeftOff | null): { offset: number; via: "left-off" | "beat" | "end" } {
  if (e) {
    const at = findLeftOff(text, e);
    if (at !== null) return { offset: at, via: "left-off" };
  }
  const beat = firstUnwrittenBeatOffset(text);
  if (beat !== null) return { offset: beat, via: "beat" };
  return { offset: lf(text).length, via: "end" };
}

/** The chapter with the newest record; the earlier one in the list wins a tie. */
export function lastEditedChapter(rec: Record<string, LeftOff>, chapterPaths: readonly string[]): string | null {
  let best: string | null = null;
  for (const p of chapterPaths) {
    const e = Object.prototype.hasOwnProperty.call(rec, p) ? rec[p] : undefined;
    if (e && (best === null || e.at > rec[best].at)) best = p;
  }
  return best;
}

/** A book's spot: its newest chapter record, else the chapters to scan for a beat; null with no chapters. */
export function bookTarget(
  chapterPaths: readonly string[],
  rec: Record<string, LeftOff>,
): { path: string; spot: LeftOff } | { scan: string[] } | null {
  if (chapterPaths.length === 0) return null;
  const path = lastEditedChapter(rec, chapterPaths);
  return path !== null ? { path, spot: rec[path] } : { scan: [...chapterPaths] };
}

/** Edits are recorded in note works and in chapters whose book note is a work. */
export function shouldRecord(
  role: DeskRole | null,
  bookRole: (bookNotePath: string) => DeskRole | null,
  bookNotePath?: string,
): boolean {
  if (role === "note") return true;
  if (role === "chapter") return bookNotePath !== undefined && bookRole(bookNotePath) === "book";
  return false;
}

/** Merge for a rename collision: the newer record wins; a tie keeps the moved one. */
export function newestLeftOff(moved: LeftOff, existing: LeftOff): LeftOff {
  return moved.at >= existing.at ? moved : existing;
}

/** Drop records of files that are gone; true when something was removed. */
export function pruneMissing(rec: Record<string, LeftOff>, exists: (path: string) => boolean): boolean {
  let changed = false;
  for (const k of Object.keys(rec)) {
    if (!exists(k)) { delete rec[k]; changed = true; }
  }
  return changed;
}

/** Keep only well-typed entries of whatever data.json held. */
export function cleanLeftOff(raw: unknown): Record<string, LeftOff> {
  const out: Record<string, LeftOff> = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    const e = v as Record<string, unknown>;
    if (typeof e.offset !== "number" || !Number.isFinite(e.offset) || e.offset < 0) continue;
    if (typeof e.at !== "number" || !Number.isFinite(e.at) || e.at < 0) continue;
    if (typeof e.before !== "string" || typeof e.after !== "string") continue;
    out[k] = { offset: e.offset, before: e.before, after: e.after, at: e.at };
  }
  return out;
}
