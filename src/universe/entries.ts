// Universe entries as the vault index sees them (no Obsidian imports): which notes
// are entries, their names and aliases, and the queries over them.
//
// An entry is a note whose type property holds one of the five entry type values.
// The type comes from the property, never from the folder (the folder is only where
// new entries are created). Notes in the templates folder, and the entry templates
// themselves, are never entries.

import { foldName } from "../core/names";
import { classifyKey, inFolder, snapshotsRoot, type ClassifySettings } from "../core/classify";
import type { IndexFile, IndexSpec } from "../core/vault-index";
import { sameScope, type Scope } from "./scope";
import { ENTRY_KINDS, type EntryKind, type UniverseSettings } from "./settings";

export interface Entry {
  path: string;
  /** the note's basename */
  name: string;
  /** the `aliases` property, as written (strings only) */
  aliases: string[];
  kind: EntryKind;
  /** per-entry property `caseSensitive`: the name matches only with its own capitalization */
  caseSensitive: boolean;
  /** per-entry property `ignore`: phrases where the name must not match */
  ignore: string[];
  /** per-entry property `firstName`: false stops a character's first name matching on its own (default true) */
  firstName: boolean;
}

/** An entry with the scope it belongs to, read live (never stored in the index, Q20). */
export type ScopedEntry = Entry & { scope: Scope };

const nfc = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** The entry kind a type property value names, or null. Case, spacing and a first list item are forgiven. */
export function kindOf(value: unknown, types: UniverseSettings["entryTypes"]): EntryKind | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string" && typeof v !== "number") return null;
  const word = nfc(String(v));
  if (word === "") return null;
  for (const k of ENTRY_KINDS) if (nfc(types[k].value) === word) return k;
  return null;
}

/** The aliases a note declares: `aliases` or `alias`, a string (comma-separated) or a list. */
export function aliasesOf(fm: Record<string, unknown> | undefined): string[] {
  if (!fm) return [];
  const raw = fm.aliases ?? fm.alias;
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const out: string[] = [];
  for (const i of items) {
    if (typeof i !== "string" && typeof i !== "number") continue;
    const a = String(i).trim();
    if (a !== "" && !out.includes(a)) out.push(a);
  }
  return out;
}

/** A YAML boolean, or the string "true"/"false" (trimmed, any case); anything else is `fallback`. */
export function boolOf(value: unknown, fallback: boolean): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const w = v.trim().toLowerCase();
    if (w === "true") return true;
    if (w === "false") return false;
  }
  return fallback;
}

/** The phrases of the `ignore` property: a list, or one string (comma-separated); empty ones dropped. */
export function phrasesOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const out: string[] = [];
  for (const i of items) {
    if (typeof i !== "string" && typeof i !== "number") continue;
    const p = String(i).trim();
    if (p !== "" && !out.includes(p)) out.push(p);
  }
  return out;
}

export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

export function sameEntry(a: Entry, b: Entry): boolean {
  return a.path === b.path && a.name === b.name && a.kind === b.kind
    && a.aliases.length === b.aliases.length && a.aliases.every((x, i) => x === b.aliases[i])
    && a.caseSensitive === b.caseSensitive && a.firstName === b.firstName
    && a.ignore.length === b.ignore.length && a.ignore.every((x, i) => x === b.ignore[i]);
}

/** The settings the entries index (and the threads index) depend on. */
export type EntriesSettings = Pick<UniverseSettings,
  "universeMode" | "universeNote" | "defaultUniverseFolders" | "universeProperty" | "typeProperty" | "entryTypes"
  | "caseSensitiveProperty" | "ignoreProperty" | "firstNameProperty"> & {
  templatesFolder: string;
} & Pick<ClassifySettings, "chaptersFolder" | "snapshotsFolder" | "chapterTemplate"> & Partial<ClassifySettings>;

/**
 * classifyKey of the settings an index reads. Real settings are whole; `classifyKey`
 * reads every field through `str()` and defaults, so a partial one (a test's) is safe.
 */
export function classifyKeyOf(s: Partial<ClassifySettings>): string {
  return classifyKey(s as ClassifySettings);
}

/** Whether the note is a template (the templates folder, an entry template or the chapter template). */
export function isTemplatePath(path: string, s: Pick<EntriesSettings, "templatesFolder" | "chapterTemplate" | "entryTypes">): boolean {
  const norm = (p: string) => p.trim().replace(/^\/+/, "").replace(/(?<!\.md)$/i, ".md");
  if (s.templatesFolder.trim() !== "" && inFolder(path, s.templatesFolder)) return true;
  const templates = [s.chapterTemplate, ...ENTRY_KINDS.map((k) => s.entryTypes[k].template)];
  return templates.some((p) => p.trim() !== "" && norm(p) === path);
}

/** True for a markdown note that may hold entries or threads: not a snapshot, not a template. */
export function isUniverseNote(f: IndexFile, s: EntriesSettings): boolean {
  return f.extension === "md" && !inFolder(f.path, snapshotsRoot(s.snapshotsFolder)) && !isTemplatePath(f.path, s);
}

export interface EntriesDeps<F extends IndexFile> {
  settings(): EntriesSettings;
  frontmatter(f: F): Record<string, unknown> | undefined;
}

/** Changes whenever a setting that decides who is an entry changes. */
export function entriesSettingsKey(s: EntriesSettings): string {
  return JSON.stringify([
    s.universeMode, s.universeNote, s.defaultUniverseFolders, s.universeProperty, s.typeProperty,
    s.caseSensitiveProperty, s.ignoreProperty, s.firstNameProperty,
    ENTRY_KINDS.map((k) => [s.entryTypes[k].value, s.entryTypes[k].template]),
    s.templatesFolder, classifyKeyOf(s),
  ]);
}

export function entriesSpec<F extends IndexFile>(deps: EntriesDeps<F>): IndexSpec<F, Entry> {
  return {
    name: "universe-entries",
    mode: "metadata",
    include: (f) => deps.settings().universeMode !== "off" && isUniverseNote(f, deps.settings()),
    compute: (f) => {
      const s = deps.settings();
      const fm = deps.frontmatter(f);
      const kind = kindOf(fm?.[s.typeProperty], s.entryTypes);
      if (kind === null) return undefined;
      return {
        path: f.path, name: basenameOf(f.path), aliases: aliasesOf(fm), kind,
        caseSensitive: boolOf(fm?.[s.caseSensitiveProperty], false),
        ignore: phrasesOf(fm?.[s.ignoreProperty]),
        firstName: boolOf(fm?.[s.firstNameProperty], true),
      };
    },
    same: sameEntry,
    settingsKey: () => entriesSettingsKey(deps.settings()),
  };
}

/** The entries of a scope (same kind and root), by type order then name. A scope of kind none matches nothing. */
export function entriesIn(all: Iterable<ScopedEntry>, scope: Scope): ScopedEntry[] {
  if (scope.kind === "none") return [];
  const out: ScopedEntry[] = [];
  for (const e of all) if (sameScope(e.scope, scope)) out.push(e);
  return out.sort((a, b) =>
    ENTRY_KINDS.indexOf(a.kind) - ENTRY_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
}

/** Entries grouped by kind, in type order, empty kinds included. */
export function groupByKind<E extends Entry>(entries: E[]): { kind: EntryKind; entries: E[] }[] {
  return ENTRY_KINDS.map((kind) => ({ kind, entries: entries.filter((e) => e.kind === kind) }));
}

/** Folds case and accents so "mae" finds "Mãe": the one fold, core/names.ts (kept under its old name). */
export { foldName as foldText };

/** Entries whose name or an alias contains the query (folded); an empty query keeps all. */
export function searchEntries<E extends Entry>(entries: E[], query: string): E[] {
  const q = foldName(query.trim());
  if (q === "") return entries;
  return entries.filter((e) => foldName(e.name).includes(q) || e.aliases.some((a) => foldName(a).includes(q)));
}
