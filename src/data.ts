import type { EscritaSettings } from "./settings";

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
  /** keyed by book note path */
  books: Record<string, DayBook>;
}

export interface EscritaData {
  version: 1;
  settings: EscritaSettings;
  /** keyed by writing day, YYYY-MM-DD */
  history: Record<string, DayRecord>;
}

export interface EscritaModule {
  load(): void | Promise<void>;
  unload?(): void;
  /** called after any setting changes and is saved */
  settingsChanged?(): void;
}
