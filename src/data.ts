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
}

export interface EscritaModule {
  load(): void | Promise<void>;
  unload?(): void;
  /** called after any setting changes and is saved */
  settingsChanged?(): void;
}
