// The order of the settings tab (PLAN-0.8 Q13, IMPROVEMENTS 11): one list that names the
// core sections and the modules' sections together, in today's visual order. Pure data and
// one function, no Obsidian imports. The tab (settings-tab.ts) makes one group per slot that
// `sectionOrder` returns, under the slot's heading (PLAN-1.0.3 Q4).

import type { FeatureId } from "./features";

export type SectionId =
  | "features" | "shared" | "books" | "dayEnds" | "forms" | "newWorks" | "goals" | "publish" | "export" | "submissions" | "outline" | "placeholders"
  | "darlings" | "editor" | "screenplay" | "lens" | "stages" | "desk" | "snapshots"
  | "universe" | "threads";

export interface SectionSlot {
  id: SectionId;
  /**
   * The i18n key of the slot's group heading (PLAN-1.0.3 Q4). Null: the slot's rows continue
   * the group above, as they sit today (the writing day under Books, the thread words under
   * the Universe). Headings are unique: Obsidian matches groups by heading on re-render.
   */
  heading: string | null;
  /** The module that draws the slot's rows; null = shared core, always drawn. */
  feature: FeatureId | null;
  /**
   * Other features that read a row the core draws in this slot (a "shared row": the
   * placeholder marker is read by publish too). The slot still draws, its core part
   * only, while any of them is loaded and the module is not.
   */
  also?: readonly FeatureId[];
}

/**
 * Today's order (settings.ts before 0.8): Features, shared names and folders, Books, the
 * writing day, Forms (1.1), New works (1.0.4), then goals, publishing, outline, placeholders, darlings, editor, lens,
 * stages, home note, snapshots, universe. The thread words sit in the middle of the universe's
 * section: its module draws them there while threads is loaded; the threads slot draws them
 * only with the universe off.
 */
export const SECTION_ORDER: readonly SectionSlot[] = [
  { id: "features", heading: "settings.features", feature: null },
  { id: "shared", heading: "settings.shared", feature: null },
  { id: "books", heading: "settings.books", feature: null },
  { id: "dayEnds", heading: null, feature: null },
  { id: "forms", heading: "settings.forms", feature: null },
  { id: "newWorks", heading: "settings.newWorks", feature: null },
  { id: "goals", heading: "settings.goals", feature: "goals" },
  { id: "publish", heading: "settings.publishing", feature: "publish" },
  { id: "export", heading: "export.settings.heading", feature: "export" },
  { id: "submissions", heading: "submissions.settings.heading", feature: "submissions" },
  { id: "outline", heading: "settings.outline", feature: "outline" },
  { id: "placeholders", heading: "settings.placeholders", feature: "placeholders", also: ["publish"] },
  { id: "darlings", heading: "settings.darlings", feature: "darlings" },
  { id: "editor", heading: "settings.editor", feature: "typing", also: ["dialogueFocus", "moveBlocks", "lens"] },
  { id: "screenplay", heading: "screenplay.settings.heading", feature: "screenplay" },
  { id: "lens", heading: "settings.lens", feature: "lens" },
  { id: "stages", heading: "settings.stages", feature: null },
  { id: "desk", heading: "settings.homeNoteHeading", feature: "desk" },
  { id: "snapshots", heading: "settings.snapshots", feature: "snapshots" },
  { id: "universe", heading: "universe.settings", feature: "universe", also: ["threads"] },
  { id: "threads", heading: null, feature: "threads" },
];

/** The slots to draw with these features loaded, in order: core always, a module's while it is loaded. */
export function sectionOrder(loaded: ReadonlySet<FeatureId>): SectionSlot[] {
  return SECTION_ORDER.filter((slot) =>
    slot.feature === null || loaded.has(slot.feature) || (slot.also?.some((id) => loaded.has(id)) ?? false));
}
