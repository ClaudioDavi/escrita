// The universe's entry kinds and their settings shape (no Obsidian imports). In core since
// 1.1.1, so the settings table (core/settings-schema.ts) and the default sets need no import
// from the universe; universe/settings.ts re-exports them.

export const ENTRY_KINDS = ["character", "place", "object", "group", "event"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** One entry type: the value of the type property, where new entries go and an optional template note. */
export interface EntryTypeSetting {
  value: string;
  /** folder for new entries: inside the universe folder (the one beside the universe note), or inside the book (per-book mode) */
  folder: string;
  /** vault path of the template note for new entries; empty = none */
  template: string;
  /** the name shown in menus and the panel ("Character"); the writer's own word */
  label: string;
}
