// POV colours, filters and the status tally for the outline (0.7 plan Q40-Q45, N 1).
// Pure: no Obsidian or CodeMirror imports, no i18n.

import { foldName } from "../core/names";
import { linkText } from "../core/scope";
import { STAGES, writtenWord, type Stage, type StageMapping } from "../core/stages";
import type { ChapterRow } from "./rows";
import { safeEntries } from "../core/records";

export const POV_PALETTE = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"] as const;
export type PovColor = typeof POV_PALETTE[number];

export interface PovValue { key: string; label: string; path: string | null }

/** Q41: one key per resolved note (its path), else per folded text; the label as written (or the entry's name). */
export function povValue(value: unknown, resolve: (link: string) => { path: string; name: string } | null): PovValue | null {
  const text = linkText(value);
  if (!text) return null;
  const hit = resolve(text);
  if (hit) return { key: hit.path, label: hit.name, path: hit.path };
  const key = foldName(text);
  return key ? { key, label: text, path: null } : null;
}

/** Q42: a new key gets the first colour no key uses, in order; after eight they repeat. Never reassigns. True when it added a key. */
export function assignColors(keys: readonly string[], store: Record<string, PovColor>): boolean {
  let added = false;
  for (const key of keys) {
    if (!key || key === "__proto__" || Object.prototype.hasOwnProperty.call(store, key)) continue;
    const used = new Set<string>(Object.values(store));
    const free = POV_PALETTE.find((c) => !used.has(c));
    store[key] = free ?? POV_PALETTE[Object.keys(store).length % POV_PALETTE.length];
    added = true;
  }
  return added;
}

/** Loads `data.povColors`: keeps only entries whose value is a palette colour. */
export function cleanPovColors(raw: unknown): Record<string, PovColor> {
  const out: Record<string, PovColor> = {};
  for (const [k, v] of safeEntries(raw)) {
    if ((POV_PALETTE as readonly unknown[]).includes(v)) out[k] = v as PovColor;
  }
  return out;
}

/** A renamed note keeps its colour. When the new key already has one, it stays and the old one is dropped. True when the store changed. */
export function renamePovKey(store: Record<string, PovColor>, oldPath: string, newPath: string): boolean {
  if (oldPath === newPath || !Object.prototype.hasOwnProperty.call(store, oldPath)) return false;
  if (!Object.prototype.hasOwnProperty.call(store, newPath)) store[newPath] = store[oldPath];
  delete store[oldPath];
  return true;
}

/** `word` is "" for chapters with no status (the view says "no status"). */
export interface TallyItem { stage: Stage | null; word: string; n: number }

const otherKey = (status: string) => `other:${status.trim().toLowerCase()}`;

/** Q45: by stage in stage order, labelled with the writer's word; unknown statuses under their own word after the stages; no status last. */
export function statusTally(rows: readonly ChapterRow[], stages: StageMapping): TallyItem[] {
  const byStage = new Map<Stage, number>();
  const others = new Map<string, TallyItem>();
  let none = 0;
  for (const r of rows) {
    if (r.stage) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
    else if (r.status.trim()) {
      const k = otherKey(r.status);
      const it = others.get(k);
      if (it) it.n++;
      else others.set(k, { stage: null, word: r.status.trim(), n: 1 });
    } else none++;
  }
  const out: TallyItem[] = [];
  for (const st of STAGES) {
    const n = byStage.get(st);
    if (n) out.push({ stage: st, word: writtenWord(stages, st), n });
  }
  out.push(...others.values());
  if (none) out.push({ stage: null, word: "", n: none });
  return out;
}

/** Stage ids or "other:<word>"; pov keys. */
export interface RowFilter { stages: ReadonlySet<string>; povs: ReadonlySet<string> }

/** The filter key of a row's status: its stage id, "other:<word>" for an unknown status, null for none. */
export function stageKey(row: ChapterRow): string | null {
  if (row.stage) return row.stage;
  return row.status.trim() ? otherKey(row.status) : null;
}

/** OR within a group, AND across groups; an empty group doesn't filter. */
export function rowMatches(row: ChapterRow, f: RowFilter): boolean {
  if (f.stages.size) {
    const k = stageKey(row);
    if (k === null || !f.stages.has(k)) return false;
  }
  if (f.povs.size && !(row.pov && f.povs.has(row.pov.key))) return false;
  return true;
}

export function filterActive(f: RowFilter): boolean {
  return f.stages.size > 0 || f.povs.size > 0;
}

/** Q44: drag and "Renumber chapters" only when no filter is on (rule 1). */
export function canReorder(f: RowFilter): boolean {
  return !filterActive(f);
}

/**
 * Rule 1: Tab on an empty chapter (or a new line) writes a beat into the chapter above
 * in the book. While a filter hides that chapter, the beat would land where the writer
 * can't see it, so the move is refused. `row` undefined (no chapter above) is not hidden.
 */
export function hiddenByFilter(row: ChapterRow | undefined, f: RowFilter): boolean {
  return !!row && filterActive(f) && !rowMatches(row, f);
}
