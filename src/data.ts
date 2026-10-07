import type { EscritaSettings } from "./settings";
import type { LeftOff } from "./core/left-off";
import type { Dismissal } from "./lens/types";
import type { SeenStore } from "./universe/first-seen";
import type { PovColor } from "./outline/pov";

/** One book's writing on one day. `total` is the book's word count at the last change that day. */
export interface DayBook {
  added: number;
  deleted: number;
  total: number;
}

/** All tracked writing on one writing day (see core/dates.writingDay). */
export interface DayRecord {
  added: number;
  deleted: number;
  /** keyed by book note path, or by the path of a standalone piece note (same shape) */
  books: Record<string, DayBook>;
}

/**
 * Which chapters of a book an export takes (PLAN-0.8 Q4). Chapters left out by
 * `compile: false` are never in, whatever the selection says.
 * - `all`: every included chapter.
 * - `range`: positions `from` to `to` (1-based, inclusive) in the list of included chapters.
 * - `pick`: the ticked chapters, by vault path.
 */
export type ExportSelection =
  | { mode: "all" }
  | { mode: "range"; from: number; to: number }
  | { mode: "pick"; paths: string[] };

/** The export formats (0.8: Markdown and DOCX; 0.9 adds EPUB, PLAN-0.9 Q5). */
export type ExportFormat = "md" | "docx" | "epub";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["md", "docx", "epub"];

function isFormat(v: unknown): v is ExportFormat {
  return typeof v === "string" && (EXPORT_FORMATS as readonly string[]).includes(v);
}

/** The last export of a work (Q17): enough to repeat it, and to say what it was. */
export interface LastExport {
  format: ExportFormat;
  preset: string;
  whole: boolean;
  chapters: ExportSelection;
  /** how many chapters went into a book export; absent for a single note */
  chapterCount?: number;
  /** when it was written, ISO 8601 */
  at: string;
  /** the vault path of the file it wrote */
  path: string;
  /** the folder and the file name it wrote: a file that is no longer both has been moved or renamed (Q17) */
  folder?: string;
  name?: string;
  /** the note a single export (a chapter) came from; absent for a whole book */
  source?: string;
}

/** The export modal's last choices for one work (PLAN-0.8 Q4, Q17); the export module reads and cleans them. */
export interface ExportChoice {
  format: ExportFormat;
  /** preset id, e.g. "shunn" or "ptbr" */
  preset: string;
  /** export the whole book, or only this note */
  whole: boolean;
  /** the chapter selection of a book export; absent = all */
  chapters?: ExportSelection;
  /** the last export of this work; absent before the first one */
  last?: LastExport;
}

function cleanSelection(raw: unknown): ExportSelection | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (c.mode === "all") return { mode: "all" };
  if (c.mode === "range" && Number.isFinite(c.from) && Number.isFinite(c.to)) {
    return { mode: "range", from: Math.max(1, Math.floor(c.from as number)), to: Math.max(1, Math.floor(c.to as number)) };
  }
  if (c.mode === "pick" && Array.isArray(c.paths)) return { mode: "pick", paths: c.paths.filter((p): p is string => typeof p === "string") };
  return undefined;
}

function cleanLast(raw: unknown): LastExport | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Partial<LastExport>;
  if (!isFormat(c.format) || typeof c.preset !== "string" || typeof c.whole !== "boolean") return undefined;
  if (typeof c.at !== "string" || typeof c.path !== "string" || c.path === "") return undefined;
  const out: LastExport = {
    format: c.format, preset: c.preset, whole: c.whole,
    chapters: cleanSelection(c.chapters) ?? { mode: "all" },
    at: c.at, path: c.path,
  };
  if (typeof c.chapterCount === "number" && Number.isFinite(c.chapterCount)) out.chapterCount = c.chapterCount;
  if (typeof c.folder === "string") out.folder = c.folder;
  if (typeof c.name === "string" && c.name !== "") out.name = c.name;
  if (typeof c.source === "string" && c.source !== "") out.source = c.source;
  return out;
}

/** Drop entries that aren't an ExportChoice (data saved by hand or by a later version). */
export function cleanExportChoices(raw: unknown): Record<string, ExportChoice> {
  const out: Record<string, ExportChoice> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [path, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = v as Partial<ExportChoice> | null;
    if (!c || !isFormat(c.format) || typeof c.preset !== "string" || typeof c.whole !== "boolean") continue;
    const choice: ExportChoice = { format: c.format, preset: c.preset, whole: c.whole };
    const chapters = cleanSelection(c.chapters);
    if (chapters) choice.chapters = chapters;
    const last = cleanLast(c.last);
    if (last) choice.last = last;
    out[path] = choice;
  }
  return out;
}

/**
 * Where the writer stopped in "Read the book" (0.9, N 8; PLAN-0.9 Q14), per book.
 * `chapter` is the chapter's vault path, `line` the 0-based source line of the block
 * at the top of the view (ReaderBlock.line).
 */
export interface ReadPosition {
  chapter: string;
  line: number;
}

/** Drop entries that aren't a ReadPosition; a line is a whole number, at least 0. */
export function cleanReadPositions(raw: unknown): Record<string, ReadPosition> {
  const out: Record<string, ReadPosition> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [book, v] of Object.entries(raw as Record<string, unknown>)) {
    const c = v as Partial<ReadPosition> | null;
    if (!c || typeof c !== "object" || typeof c.chapter !== "string" || c.chapter === "") continue;
    if (typeof c.line !== "number" || !Number.isFinite(c.line)) continue;
    out[book] = { chapter: c.chapter, line: Math.max(0, Math.floor(c.line)) };
  }
  return out;
}

/**
 * Whether the first-run notice ("Set up a writing vault", board 35 a) has had its one
 * chance (PLAN-1.0 Q5). A saved boolean wins. Absent, it is derived: true when the data
 * holds a saved `settings` object (an install from before 1.0, which never sees the
 * notice), false otherwise (a fresh install). Every 1.0 save writes the field, so after
 * the first save the derivation never runs again; a fresh install's first-load save
 * (task 1.4) writes `false`, and the notice sets it true when it shows, whatever the
 * answer. Running the setup command also sets it. Not a setting: no row, no reset.
 */
export function cleanSetupOffered(raw: { setupOffered?: unknown; settings?: unknown } | null | undefined): boolean {
  if (!raw || typeof raw !== "object") return false;
  if (typeof raw.setupOffered === "boolean") return raw.setupOffered;
  return !!raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings);
}

/** What Escrita remembers about a note it published (see the publish module). */
export interface PublishRecord {
  /** the status value the note had before "Publish this note"; "Unpublish" restores it */
  previousStatus?: string;
}

export interface EscritaData {
  version: 1;
  settings: EscritaSettings;
  /** keyed by writing day, YYYY-MM-DD */
  history: Record<string, DayRecord>;
  /** keyed by note path; absent in data saved by 0.1 (loaded as {}) */
  publish: Record<string, PublishRecord>;
  /** keyed by note path; absent before 0.4 (loaded as {}) */
  leftOff: Record<string, LeftOff>;
  /** revision lens "Ignore here" records, keyed by note path; absent before 0.5 (loaded as {}) */
  lensDismissed: Record<string, Dismissal[]>;
  /** when each open thread was first seen: note path → thread text → ms; absent before 0.6 (loaded as {}); never written into notes */
  threadSeen: SeenStore;
  /** the outline's POV colours: key (note path or folded text) → palette colour; absent before 0.7 (loaded as {}) */
  povColors: Record<string, PovColor>;
  /** the export modal's last choices, keyed by work path (book note or note); absent before 0.8 (loaded as {}).
   *  Path-keyed: the export module keeps it current through a data follower (task 3.1) */
  exportChoices: Record<string, ExportChoice>;
  /** "Read the book" positions, keyed by book note path; absent before 0.9 (loaded as {}).
   *  Path-keyed, book and chapter both: kept current through plugin.index.follow (task 2.6) */
  readPosition: Record<string, ReadPosition>;
  /** the first-run notice has been shown, or never will be (1.0, Q5); see cleanSetupOffered. A flag, not a setting */
  setupOffered: boolean;
}
