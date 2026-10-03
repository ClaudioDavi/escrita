// The universe's settings: types, English defaults and normalization (no Obsidian
// imports). EscritaSettings extends UniverseSettings; the author's own words
// (`Universo`, `personagem`, `conto`…) live in the vault's data.json, never here.

export type UniverseMode = "off" | "perBook" | "universe";

export const ENTRY_KINDS = ["character", "place", "object", "group", "event"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const FORM_KINDS = ["shortStory", "essay", "novella", "novel", "poem", "fragment"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

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

export interface UniverseSettings {
  universeMode: UniverseMode;
  /** the universe note (path, `.md` optional); its entries live in the folder beside it with the same basename */
  universeNote: string;
  /** newline-separated folders whose notes join the universe without a property */
  defaultUniverseFolders: string;
  /** the word after the thread keyword that marks a closed thread (`%% thread closed: … %%`) */
  threadClosedWord: string;
  /** property on a work or entry linking its universe note */
  universeProperty: string;
  /** property holding an entry's type */
  typeProperty: string;
  entryTypes: Record<EntryKind, EntryTypeSetting>;
  /** property holding a work's form */
  formProperty: string;
  /** the words used for each form */
  formValues: Record<FormKind, string>;
  /** newline-separated `Folder: form word` lines: the form of works in a folder without the property */
  formFolders: string;
  /** per-entry property: `true` makes the name match only with its own capitalization */
  caseSensitiveProperty: string;
  /** per-entry property: phrases where the name must not match ("rosa dos ventos") */
  ignoreProperty: string;
  /** per-entry property: `false` stops a character's first name from matching on its own */
  firstNameProperty: string;
  /** newline-separated extra titles skipped before a first name, beyond the built-in tables (core/name-titles) */
  nameTitles: string;
  /** underline recognized names in the editor (off by default) */
  underlineNames: boolean;
}

const ENTRY_DEFAULTS: Record<EntryKind, { folder: string; label: string }> = {
  character: { folder: "Characters", label: "Character" },
  place: { folder: "Places", label: "Place" },
  object: { folder: "Objects", label: "Object" },
  group: { folder: "Groups", label: "Group" },
  event: { folder: "Events", label: "Event" },
};

const FORM_DEFAULTS: Record<FormKind, string> = {
  shortStory: "short story",
  essay: "essay",
  novella: "novella",
  novel: "novel",
  poem: "poem",
  fragment: "fragment",
};

/** Fresh copies each call, so live settings never share objects with the defaults. */
export function defaultUniverseSettings(): UniverseSettings {
  const entryTypes = {} as Record<EntryKind, EntryTypeSetting>;
  for (const k of ENTRY_KINDS) {
    entryTypes[k] = { value: k, folder: ENTRY_DEFAULTS[k].folder, template: "", label: ENTRY_DEFAULTS[k].label };
  }
  return {
    universeMode: "off",
    universeNote: "Universe.md",
    defaultUniverseFolders: "",
    threadClosedWord: "closed",
    universeProperty: "universe",
    typeProperty: "type",
    entryTypes,
    formProperty: "form",
    formValues: { ...FORM_DEFAULTS },
    formFolders: "",
    caseSensitiveProperty: "caseSensitive",
    ignoreProperty: "ignore",
    firstNameProperty: "firstName",
    nameTitles: "",
    underlineNames: false,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A note path as typed: edge slashes stripped, `.md` added; blank gives the fallback. */
export function normalizeNotePath(v: string, fallback: string): string {
  const p = v.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (p === "" || p.toLowerCase() === ".md") return fallback;
  return /\.md$/i.test(p) ? p : `${p}.md`;
}

/**
 * Settings as saved (any shape: old data has none of these fields) → complete
 * universe settings. A missing or wrong-typed value takes its default; a blank
 * name or folder does too. Unknown mode → off.
 */
export function normalizeUniverse(raw: unknown): UniverseSettings {
  const src = isRecord(raw) ? raw : {};
  const d = defaultUniverseSettings();
  const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.trim() !== "" ? v.trim() : fallback);
  const entryTypes = isRecord(src.entryTypes) ? src.entryTypes : {};
  const forms = isRecord(src.formValues) ? src.formValues : {};
  for (const k of ENTRY_KINDS) {
    const e = isRecord(entryTypes[k]) ? entryTypes[k] : {};
    d.entryTypes[k] = {
      value: str(e.value, d.entryTypes[k].value),
      folder: str(e.folder, d.entryTypes[k].folder),
      template: typeof e.template === "string" ? e.template.trim() : "",
      label: str(e.label, d.entryTypes[k].label),
    };
  }
  for (const k of FORM_KINDS) d.formValues[k] = str(forms[k], d.formValues[k]);
  return {
    universeMode: src.universeMode === "perBook" || src.universeMode === "universe" ? src.universeMode : "off",
    universeNote: normalizeNotePath(str(src.universeNote, d.universeNote), d.universeNote),
    defaultUniverseFolders: typeof src.defaultUniverseFolders === "string" ? src.defaultUniverseFolders : "",
    threadClosedWord: str(src.threadClosedWord, d.threadClosedWord),
    universeProperty: str(src.universeProperty, d.universeProperty),
    typeProperty: str(src.typeProperty, d.typeProperty),
    entryTypes: d.entryTypes,
    formProperty: str(src.formProperty, d.formProperty),
    formValues: d.formValues,
    formFolders: typeof src.formFolders === "string" ? src.formFolders : "",
    caseSensitiveProperty: str(src.caseSensitiveProperty, d.caseSensitiveProperty),
    ignoreProperty: str(src.ignoreProperty, d.ignoreProperty),
    firstNameProperty: str(src.firstNameProperty, d.firstNameProperty),
    nameTitles: typeof src.nameTitles === "string" ? src.nameTitles : "",
    underlineNames: src.underlineNames === true,
  };
}
