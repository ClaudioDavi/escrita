import type { EscritaSettings } from "./settings";
import type { LeftOff } from "./core/left-off";
import type { Dismissal } from "./lens/types";

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
}

export interface EscritaModule {
  load(): void | Promise<void>;
  unload?(): void;
  /** called after any setting changes and is saved */
  settingsChanged?(): void;
}
