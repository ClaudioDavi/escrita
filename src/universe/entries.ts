// Universe entries as the vault index sees them (no Obsidian imports): which notes
// are entries, their names and aliases, and the queries over them.
//
// An entry is a note whose type property holds one of the five entry type values.
// The type comes from the property, never from the folder (the folder is only where
// new entries are created). Notes in the templates folder, and the entry templates
// themselves, are never entries.

import { inFolder, snapshotsRoot } from "../core/classify";
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
  /** the scope the entry belongs to, per scopeFor ("none" when it belongs to nothing) */
  scope: Scope;
}

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

export function basenameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}

export function sameEntry(a: Entry, b: Entry): boolean {
  return a.path === b.path && a.name === b.name && a.kind === b.kind
    && a.aliases.length === b.aliases.length && a.aliases.every((x, i) => x === b.aliases[i])
    && sameScope(a.scope, b.scope) && a.scope.note === b.scope.note;
}

/** The settings the entries index (and the threads index) depend on. */
export type EntriesSettings = Pick<UniverseSettings,
  "universeMode" | "universeNote" | "defaultUniverseFolders" | "universeProperty" | "typeProperty" | "entryTypes"> & {
  chaptersFolder: string;
  snapshotsFolder: string;
  templatesFolder: string;
  chapterTemplate: string;
};

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
  scope(f: F): Scope;
}

/** Changes whenever a setting that decides who is an entry changes. */
export function entriesSettingsKey(s: EntriesSettings): string {
  return JSON.stringify([
    s.universeMode, s.universeNote, s.defaultUniverseFolders, s.universeProperty, s.typeProperty,
    ENTRY_KINDS.map((k) => [s.entryTypes[k].value, s.entryTypes[k].template]),
    s.chaptersFolder, s.snapshotsFolder, s.templatesFolder, s.chapterTemplate,
  ]);
}

export function entriesSpec<F extends IndexFile>(deps: EntriesDeps<F>): IndexSpec<F, Entry> {
  return {
    name: "universe-entries",
    mode: "metadata",
    // an entry's scope depends on other notes (its book note's `universe` property)
    structural: true,
    include: (f) => deps.settings().universeMode !== "off" && isUniverseNote(f, deps.settings()),
    compute: (f) => {
      const s = deps.settings();
      const fm = deps.frontmatter(f);
      const kind = kindOf(fm?.[s.typeProperty], s.entryTypes);
      if (kind === null) return undefined;
      return { path: f.path, name: basenameOf(f.path), aliases: aliasesOf(fm), kind, scope: deps.scope(f) };
    },
    same: sameEntry,
    settingsKey: () => entriesSettingsKey(deps.settings()),
  };
}

/** The entries of a scope (same kind and root), by type order then name. A scope of kind none matches nothing. */
export function entriesIn(all: Iterable<Entry>, scope: Scope): Entry[] {
  if (scope.kind === "none") return [];
  const out: Entry[] = [];
  for (const e of all) if (sameScope(e.scope, scope)) out.push(e);
  return out.sort((a, b) =>
    ENTRY_KINDS.indexOf(a.kind) - ENTRY_KINDS.indexOf(b.kind) || a.name.localeCompare(b.name));
}

/** Entries grouped by kind, in type order, empty kinds included. */
export function groupByKind(entries: Entry[]): { kind: EntryKind; entries: Entry[] }[] {
  return ENTRY_KINDS.map((kind) => ({ kind, entries: entries.filter((e) => e.kind === kind) }));
}

/** Folds case and accents so "mae" finds "Mãe". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

/** Entries whose name or an alias contains the query (folded); an empty query keeps all. */
export function searchEntries(entries: Entry[], query: string): Entry[] {
  const q = foldText(query.trim());
  if (q === "") return entries;
  return entries.filter((e) => foldText(e.name).includes(q) || e.aliases.some((a) => foldText(a).includes(q)));
}
