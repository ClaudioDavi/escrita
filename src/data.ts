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

/** The last export of a work (Q17): enough to repeat it, and to say what it was. */
export interface LastExport {
  format: "md" | "docx";
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
  format: "md" | "docx";
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
  if ((c.format !== "md" && c.format !== "docx") || typeof c.preset !== "string" || typeof c.whole !== "boolean") return undefined;
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
    if (!c || (c.format !== "md" && c.format !== "docx") || typeof c.preset !== "string" || typeof c.whole !== "boolean") continue;
    const choice: ExportChoice = { format: c.format, preset: c.preset, whole: c.whole };
    const chapters = cleanSelection(c.chapters);
    if (chapters) choice.chapters = chapters;
    const last = cleanLast(c.last);
    if (last) choice.last = last;
    out[path] = choice;
  }
  return out;
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
}
