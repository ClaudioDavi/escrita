// Planning "Move this book's entries to the universe" (no Obsidian imports).
// The plan only describes: the builder of the preview applies it one note at a
// time with fileManager.renameFile, and never overwrites. Properties are only
// added where missing (and only when the writer ticks the box), never changed.

import { inFolder } from "../core/classify";
import { ENTRY_KINDS, type EntryKind, type UniverseSettings } from "./settings";

/** What the planner needs to know about one file inside the book folder. */
export interface MigrationFile {
  path: string;
  /** whether the note already has the type property (any value) */
  hasType: boolean;
}

export interface MigrationInput {
  /** the book folder, e.g. "Romances/A Casa" */
  bookFolder: string;
  /** the book note path, e.g. "Romances/A Casa.md" */
  bookNote: string;
  /** whether the book note already has the universe property */
  bookHasUniverse: boolean;
  /** the universe's folder (beside the universe note) */
  universeRoot: string;
  /** every markdown file inside the book folder */
  files: MigrationFile[];
  /** whether a path exists in the vault (for destination conflicts) */
  exists(path: string): boolean;
  /** the per-type folders and values */
  types: UniverseSettings["entryTypes"];
}

export interface PlannedMove {
  kind: EntryKind;
  from: string;
  to: string;
  /** the type value to add when the note has no type property; null when it has one */
  addType: string | null;
}

export interface Conflict {
  kind: EntryKind;
  from: string;
  /** the existing destination (or the earlier note that takes it) */
  to: string;
}

export interface MigrationPlan {
  /** per kind, in type order: the folders and what moves (kinds with nothing in the book are left out) */
  groups: { kind: EntryKind; fromFolder: string; toFolder: string; moves: PlannedMove[]; conflicts: Conflict[] }[];
  moves: PlannedMove[];
  conflicts: Conflict[];
  /** notes that move without a type property, for the "add type" checkbox count */
  missingType: number;
  /** the book note lacks the universe property */
  needsUniverse: boolean;
}

const trim = (p: string) => p.replace(/^\/+|\/+$/g, "");

export function planMigration(input: MigrationInput): MigrationPlan {
  const book = trim(input.bookFolder);
  const uni = trim(input.universeRoot);
  const taken = new Set<string>();
  const groups: MigrationPlan["groups"] = [];
  for (const kind of ENTRY_KINDS) {
    const folder = trim(input.types[kind].folder);
    if (folder === "") continue;
    const fromFolder = `${book}/${folder}`;
    const toFolder = `${uni}/${folder}`;
    const moves: PlannedMove[] = [];
    const conflicts: Conflict[] = [];
    // a nested type folder (places/"World", groups/"World/Groups") takes its own notes: the deepest folder wins
    const deeper = ENTRY_KINDS
      .map((k) => `${book}/${trim(input.types[k].folder)}`)
      .filter((d) => d.length > fromFolder.length && inFolder(d, fromFolder));
    const inside = input.files
      .filter((f) => inFolder(f.path, fromFolder) && f.path !== fromFolder && !deeper.some((d) => inFolder(f.path, d)))
      .sort((a, b) => a.path.localeCompare(b.path));
    for (const f of inside) {
      const to = `${toFolder}/${f.path.slice(fromFolder.length + 1)}`;
      if (input.exists(to) || taken.has(to)) {
        conflicts.push({ kind, from: f.path, to });
        continue;
      }
      taken.add(to);
      moves.push({ kind, from: f.path, to, addType: f.hasType ? null : input.types[kind].value });
    }
    if (moves.length > 0 || conflicts.length > 0) groups.push({ kind, fromFolder, toFolder, moves, conflicts });
  }
  const moves = groups.flatMap((g) => g.moves);
  return {
    groups,
    moves,
    conflicts: groups.flatMap((g) => g.conflicts),
    missingType: moves.filter((m) => m.addType !== null).length,
    needsUniverse: !input.bookHasUniverse,
  };
}
