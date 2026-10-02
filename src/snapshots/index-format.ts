// The per-note index.json (no Obsidian imports). The .txt files are the source
// of truth: the index only holds metadata (kind, name, time, words, a hash for
// dedupe) and is reconciled against the files on every listing. A file without
// an entry becomes a manual entry (never pruned: the safe direction); an entry
// without a file is dropped; a corrupt index is rebuilt. No file is ever
// discarded because of the index.

import { isoDay } from "../core/dates";
import { parseSnapshotFileName } from "./paths";

export type SnapshotKind = "manual" | "publish" | "restore" | "daily" | "stage";

const KINDS: readonly SnapshotKind[] = ["manual", "publish", "restore", "daily", "stage"];

/** Kinds Escrita takes on its own; only these are pruned. */
export const AUTO_KINDS: ReadonlySet<SnapshotKind> = new Set<SnapshotKind>(["publish", "restore", "daily"]);

export interface SnapshotEntry {
  /** file name inside the note's snapshot folder */
  file: string;
  /** the name the writer gave; "" for automatic ones (the kind's label is shown) */
  name: string;
  kind: SnapshotKind;
  /** epoch ms */
  taken: number;
  /** writing day (YYYY-MM-DD) it was taken on */
  day: string;
  /** words by Escrita's rules; -1 = not known yet */
  words: number;
  /** the note's path when it was taken */
  notePath: string;
  /** fnv1a of the text; "" = not known */
  hash: string;
  /** UTF-16 length of the text; -1 = not known */
  length: number;
  /** kind "stage": the stage ids the note moved between */
  stage?: { from: string; to: string };
}

export interface SnapshotIndex {
  version: 1;
  note: string;
  entries: SnapshotEntry[];
}

export function emptyIndex(note: string): SnapshotIndex {
  return { version: 1, note, entries: [] };
}

function isSnapshotFile(v: unknown): v is string {
  return typeof v === "string" && v.endsWith(".txt") && v.length > 4 && !v.includes("/") && !v.includes("\\");
}

function int(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
}

function entryFrom(v: unknown, note: string): SnapshotEntry | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isSnapshotFile(o.file)) return null;
  const parsed = parseSnapshotFileName(o.file);
  const taken = int(o.taken, parsed?.taken ?? 0);
  const day = typeof o.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : isoDay(new Date(taken));
  const st = o.stage;
  const stage =
    typeof st === "object" && st !== null && !Array.isArray(st) &&
    typeof (st as Record<string, unknown>).from === "string" && (st as Record<string, unknown>).from !== "" &&
    typeof (st as Record<string, unknown>).to === "string" && (st as Record<string, unknown>).to !== ""
      ? { from: (st as { from: string }).from, to: (st as { to: string }).to }
      : undefined;
  return {
    file: o.file,
    name: typeof o.name === "string" ? o.name : parsed?.name ?? "",
    kind: KINDS.includes(o.kind as SnapshotKind) ? (o.kind as SnapshotKind) : "manual",
    taken,
    day,
    words: int(o.words, -1),
    notePath: typeof o.notePath === "string" && o.notePath !== "" ? o.notePath : note,
    hash: typeof o.hash === "string" && /^[0-9a-f]{8}$/.test(o.hash) ? o.hash : "",
    length: int(o.length, -1),
    ...(stage ? { stage } : {}),
  };
}

/** The index in `json`, or an empty one. Never throws: malformed parts are dropped, valid entries salvaged whatever the version. */
export function parseIndex(json: string | null, note: string): SnapshotIndex {
  const index = emptyIndex(note);
  if (json === null || json.trim() === "") return index;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return index;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return index;
  const raw = (data as Record<string, unknown>).entries;
  if (!Array.isArray(raw)) return index;
  const seen = new Set<string>();
  for (const v of raw) {
    const e = entryFrom(v, note);
    if (e && !seen.has(e.file)) {
      seen.add(e.file);
      index.entries.push(e);
    }
  }
  return index;
}

/** The note an index.json says it belongs to, or null when it doesn't say (or isn't valid JSON). */
export function indexNote(json: string | null): string | null {
  if (json === null) return null;
  try {
    const data: unknown = JSON.parse(json);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    const note = (data as Record<string, unknown>).note;
    return typeof note === "string" && note !== "" ? note : null;
  } catch {
    return null;
  }
}

export function serializeIndex(i: SnapshotIndex): string {
  return `${JSON.stringify({ version: 1, note: i.note, entries: i.entries }, null, 2)}\n`;
}

/** An entry for a .txt file the index doesn't know (copied in, or the index was lost): manual, so never pruned. */
export function orphanEntry(file: string, note: string): SnapshotEntry {
  const parsed = parseSnapshotFileName(file);
  const taken = parsed?.taken ?? 0;
  return {
    file, name: parsed?.name ?? file.slice(0, -4), kind: "manual", taken, day: isoDay(new Date(taken)),
    words: -1, notePath: note, hash: "", length: -1,
  };
}

/** The index made to agree with the .txt files in the folder: files are the truth. */
export function reconcile(i: SnapshotIndex, txtFiles: string[]): { index: SnapshotIndex; changed: boolean } {
  const files = new Set(txtFiles.filter(isSnapshotFile));
  const seen = new Set<string>();
  const entries: SnapshotEntry[] = [];
  for (const e of i.entries) {
    if (!files.has(e.file) || seen.has(e.file)) continue;
    seen.add(e.file);
    entries.push(e);
  }
  let changed = entries.length !== i.entries.length;
  for (const f of files) {
    if (seen.has(f)) continue;
    entries.push(orphanEntry(f, i.note));
    changed = true;
  }
  return { index: { version: 1, note: i.note, entries }, changed };
}

/** `e` added; an entry for the same file is replaced. */
export function addEntry(i: SnapshotIndex, e: SnapshotEntry): SnapshotIndex {
  return { ...i, entries: [...i.entries.filter((x) => x.file !== e.file), e] };
}

export function removeEntry(i: SnapshotIndex, file: string): SnapshotIndex {
  return { ...i, entries: i.entries.filter((x) => x.file !== file) };
}

export function updateEntry(i: SnapshotIndex, file: string, patch: Partial<SnapshotEntry>): SnapshotIndex {
  return { ...i, entries: i.entries.map((x) => (x.file === file ? { ...x, ...patch } : x)) };
}

/**
 * `from`'s entries moved into `into` (a note renamed onto a path that already
 * has snapshots). `renames` maps a moved file's old name to the name it got to
 * avoid a collision. On a clash `into` keeps its own entry.
 */
export function mergeIndexes(into: SnapshotIndex, from: SnapshotIndex, renames: Record<string, string>): SnapshotIndex {
  const entries = [...into.entries];
  const seen = new Set(entries.map((e) => e.file));
  for (const e of from.entries) {
    const file = Object.prototype.hasOwnProperty.call(renames, e.file) ? renames[e.file] : e.file;
    if (seen.has(file)) continue;
    seen.add(file);
    entries.push({ ...e, file });
  }
  return { version: 1, note: into.note, entries };
}

/** Newest first; a tie on time goes by file name, descending (" (2)" after the first of that minute). */
export function newestFirst(entries: SnapshotEntry[]): SnapshotEntry[] {
  return [...entries].sort((a, b) => b.taken - a.taken || (a.file < b.file ? 1 : a.file > b.file ? -1 : 0));
}

export function latest(i: SnapshotIndex): SnapshotEntry | null {
  return newestFirst(i.entries)[0] ?? null;
}

/** 32-bit FNV-1a over UTF-16 code units, as 8 hex chars. Only a dedupe gate: equal hashes are confirmed by comparing texts. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** "no" when the entry surely holds another text; "maybe" when the caller must compare the file with `text`. */
export function sameText(e: SnapshotEntry | null, text: string): "no" | "maybe" {
  if (!e) return "no";
  if (e.length >= 0 && e.length !== text.length) return "no";
  if (e.hash !== "" && e.hash !== fnv1a(text)) return "no";
  return "maybe";
}

/** What the writer sees: the given name, else the kind's label. */
export function label(e: SnapshotEntry, kindLabel: (k: SnapshotKind) => string): string {
  return e.name.trim() !== "" ? e.name : kindLabel(e.kind);
}
