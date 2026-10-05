// The order of the settings tab (PLAN-0.8 Q13, IMPROVEMENTS 11): one list that names the
// core sections and the modules' sections together, in today's visual order. Pure data and
// one function, no Obsidian imports. settings.ts draws what `sectionOrder` returns.

import type { FeatureId } from "./features";

export type SectionId =
  | "features" | "shared" | "books" | "dayEnds" | "goals" | "publish" | "export" | "submissions" | "outline" | "placeholders"
  | "darlings" | "editor" | "lens" | "stages" | "desk" | "snapshots"
  | "universe" | "threads";

export interface SectionSlot {
  id: SectionId;
  /** The module that draws the slot's rows; null = shared core, always drawn. */
  feature: FeatureId | null;
  /**
   * Other features that read a row the core draws in this slot (a "shared row": the
   * placeholder marker is read by publish too). The slot still draws, its core part
   * only, while any of them is loaded and the module is not. In a slot with `also` the
   * core draws the heading, so the module's section draws its rows only; in every other
   * slot the module's section draws its own heading.
   */
  also?: readonly FeatureId[];
}

/**
 * Today's order (settings.ts before 0.8): Features, shared names and folders, Books, the
 * writing day, then goals, publishing, outline, placeholders, darlings, editor, lens,
 * stages, home note, snapshots, universe. The thread words sit in the middle of the universe's
 * section: its module draws them there while threads is loaded; the threads slot draws them
 * only with the universe off.
 */
export const SECTION_ORDER: readonly SectionSlot[] = [
  { id: "features", feature: null },
  { id: "shared", feature: null },
  { id: "books", feature: null },
  { id: "dayEnds", feature: null },
  { id: "goals", feature: "goals" },
  { id: "publish", feature: "publish" },
  { id: "export", feature: "export" },
  { id: "submissions", feature: "submissions" },
  { id: "outline", feature: "outline" },
  { id: "placeholders", feature: "placeholders", also: ["publish"] },
  { id: "darlings", feature: "darlings" },
  { id: "editor", feature: "typing", also: ["dialogueFocus", "moveBlocks", "lens"] },
  { id: "lens", feature: "lens" },
  { id: "stages", feature: null },
  { id: "desk", feature: "desk" },
  { id: "snapshots", feature: "snapshots" },
  { id: "universe", feature: "universe", also: ["threads"] },
  { id: "threads", feature: "threads" },
];

/** The slots to draw with these features loaded, in order: core always, a module's while it is loaded. */
export function sectionOrder(loaded: ReadonlySet<FeatureId>): SectionSlot[] {
  return SECTION_ORDER.filter((slot) =>
    slot.feature === null || loaded.has(slot.feature) || (slot.also?.some((id) => loaded.has(id)) ?? false));
}
