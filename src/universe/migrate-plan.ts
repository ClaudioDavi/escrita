// Pure helpers for the migration preview and its final notice (no Obsidian
// imports). The plan itself comes from planMigration (migration.ts); this file
// decides what the preview shows and what the closing notice says.

import type { Conflict, MigrationPlan, PlannedMove } from "./migration";

export const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
export const dirname = (path: string): string => {
  const i = path.lastIndexOf("/");
  return i < 0 ? "" : path.slice(0, i);
};

export type PreviewRow =
  | { type: "move"; name: string; addType: string | null }
  | { type: "clash"; name: string; folder: string };

export interface GroupPreview {
  rows: PreviewRow[];
  /** moves left out of `rows` ("+ 2") */
  hidden: number;
  /** notes that will move */
  moved: number;
  /** notes that would move or clash: the "of N" total */
  total: number;
}

/**
 * One group's visible rows: up to `max` moves (the rest counted in `hidden`), then
 * every clash, which is never hidden because the writer must see what stays.
 * `addType` only shows on a row when the "add type" box is ticked.
 */
export function previewGroup(
  group: { moves: PlannedMove[]; conflicts: Conflict[] }, addTypeChecked: boolean, max = 5,
): GroupPreview {
  const shown = group.moves.slice(0, max);
  const rows: PreviewRow[] = shown.map((m) => ({
    type: "move", name: basename(m.from), addType: addTypeChecked ? m.addType : null,
  }));
  for (const c of group.conflicts) rows.push({ type: "clash", name: basename(c.from), folder: dirname(c.to) });
  return {
    rows,
    hidden: group.moves.length - shown.length,
    moved: group.moves.length,
    total: group.moves.length + group.conflicts.length,
  };
}

/** The plan's moves with the type value kept only when the box is ticked. */
export function effectiveMoves(plan: MigrationPlan, addType: boolean): PlannedMove[] {
  return plan.moves.map((m) => (addType || m.addType === null ? m : { ...m, addType: null }));
}

/** The universe property value to write: a link to the universe note by its name. */
export function universeLink(universeNote: string): string {
  return `[[${basename(universeNote).replace(/\.md$/i, "")}]]`;
}

/** Folder names for the "no entry folders" notice: the first two, then an ellipsis when there are more. */
export function folderHint(folders: string[]): string {
  const clean = folders.map((f) => basename(f.replace(/\/+$/, ""))).filter((f) => f !== "");
  return clean.length > 2 ? `${clean.slice(0, 2).join(", ")}…` : clean.join(", ");
}

export interface MigrationResult {
  moved: number;
  /** left in place: the name was taken (found in the plan, or at the moment of moving) */
  clashes: Conflict[];
  /** paths whose rename threw */
  failed: string[];
  typesAdded: number;
  universeAdded: boolean;
}

export interface ResultNotice {
  moved: number;
  clashCount: number;
  /** the folder the clashes stayed in; the book folder when they come from several */
  clashFolder: string;
  clashNames: string;
  failedCount: number;
  failedNames: string;
}

const namesOf = (paths: string[]): string => paths.map(basename).join(", ");

export function resultNotice(result: MigrationResult, bookFolder: string): ResultNotice {
  const folders = new Set(result.clashes.map((c) => dirname(c.from)));
  return {
    moved: result.moved,
    clashCount: result.clashes.length,
    clashFolder: folders.size === 1 ? [...folders][0] : bookFolder,
    clashNames: namesOf(result.clashes.map((c) => c.from)),
    failedCount: result.failed.length,
    failedNames: namesOf(result.failed),
  };
}
