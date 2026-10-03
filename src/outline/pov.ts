// POV colours, filters and the status tally for the outline (0.7 plan Q40-Q45, N 1).
// Pure: no Obsidian or CodeMirror imports, no i18n. Stubs until 2.2.

import type { Stage, StageMapping } from "../core/stages";
import type { ChapterRow } from "./rows";

export const POV_PALETTE = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;
export type PovColor = typeof POV_PALETTE[number];

export interface PovValue { key: string; label: string; path: string | null }

export function povValue(value: unknown, resolve: (link: string) => { path: string; name: string } | null): PovValue | null {
  throw new Error("todo");
}

/** True when it added a key. */
export function assignColors(keys: readonly string[], store: Record<string, PovColor>): boolean {
  throw new Error("todo");
}

export function cleanPovColors(raw: unknown): Record<string, PovColor> {
  throw new Error("todo");
}

export function renamePovKey(store: Record<string, PovColor>, oldPath: string, newPath: string): boolean {
  throw new Error("todo");
}

export interface TallyItem { stage: Stage | null; word: string; n: number }

export function statusTally(rows: readonly ChapterRow[], stages: StageMapping): TallyItem[] {
  throw new Error("todo");
}

/** Stage ids or "other:<word>"; pov keys. */
export interface RowFilter { stages: ReadonlySet<string>; povs: ReadonlySet<string> }

export function rowMatches(row: ChapterRow, f: RowFilter): boolean {
  throw new Error("todo");
}

export function filterActive(f: RowFilter): boolean {
  throw new Error("todo");
}

/** Q44: drag and "Renumber chapters" only when no filter is on (rule 1). */
export function canReorder(f: RowFilter): boolean {
  throw new Error("todo");
}
