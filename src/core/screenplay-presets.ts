// The screenplay page (SP 6, PLAN-1.1; no Obsidian imports): plain data that
// core/screenplay-pages.ts and the PDF writer read, like the prose presets in core/presets.ts.
// Courier 12 everywhere: 10 characters per inch, 6 lines per inch, so every column below is
// a whole number of characters. Lengths are in points (72 per inch).

import type { ScriptElementType } from "./fountain";

export type ScreenplayPageId = "letter" | "a4";

/** Where an element's lines sit: columns in characters from the left page edge, right edge exclusive. */
export interface ElementColumns {
  left: number;
  right: number;
}

export interface ScreenplayPreset {
  id: ScreenplayPageId;
  page: { width: number; height: number };
  /** the body's top and bottom in points from the top edge; the page number sits above `top` */
  top: number;
  /** body lines per page (55 on Letter, SP 6) */
  linesPerPage: number;
  /** columns per element type; transitions are right-aligned to their `right` */
  columns: Record<Exclude<ScriptElementType, "pageBreak" | "section" | "synopsis">, ElementColumns>;
  /** printed under a speech that goes on to the next page: "(MORE)", "(MAIS)" */
  more: string;
  /** after the name where the speech goes on: "(CONT'D)", "(CONT.)" */
  continued: string;
  /** scene numbers in both margins */
  sceneNumbers: boolean;
}

/** Columns from the usual US layout: action 1.5"–7.5", dialogue 2.5"–6", parenthetical 3"–5.5", cue at 3.7". */
const US_COLUMNS: ScreenplayPreset["columns"] = {
  scene: { left: 15, right: 75 },
  action: { left: 15, right: 75 },
  character: { left: 37, right: 75 },
  parenthetical: { left: 30, right: 55 },
  dialogue: { left: 25, right: 60 },
  lyric: { left: 25, right: 60 },
  transition: { left: 15, right: 75 },
};

/**
 * The two pages (PLAN-1.1, decided 2026-10-16: Letter by default, A4 for Brazil and Europe).
 * A4 keeps the same left margin and columns, narrowed to its width, and gains lines from its
 * height. The A4 numbers are a first guess that Wave 1 C checks against the reference (Q10).
 */
const LETTER_PAGE = { id: "letter" as const, page: { width: 612, height: 792 }, top: 72, linesPerPage: 55, columns: US_COLUMNS };
const A4_PAGE = {
  id: "a4" as const,
  page: { width: 595.28, height: 841.89 },
  top: 72,
  linesPerPage: 58,
  columns: { ...US_COLUMNS, scene: { left: 15, right: 72 }, action: { left: 15, right: 72 }, character: { left: 37, right: 72 }, transition: { left: 15, right: 72 } },
};

/** The preset for a page id with the writer's labels and scene numbers (settings, rule 6). */
export function screenplayPreset(
  id: ScreenplayPageId,
  s: { screenplayMore: string; screenplayContinued: string; screenplaySceneNumbers: boolean },
): ScreenplayPreset {
  const base = id === "a4" ? A4_PAGE : LETTER_PAGE;
  return {
    ...base,
    columns: { ...base.columns },
    more: s.screenplayMore,
    continued: s.screenplayContinued,
    sceneNumbers: s.screenplaySceneNumbers,
  };
}

export const SCREENPLAY_PAGES: readonly ScreenplayPageId[] = ["letter", "a4"];
