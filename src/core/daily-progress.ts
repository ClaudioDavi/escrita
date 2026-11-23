// The daily progress port (1.0, Wave 2 seams): today's words against the daily goal, the
// same numbers as the goals status bar. The goals module provides it while loaded; writing
// mode's counter ("today 312 / 500", board 39) reads it through
// `dailyProgressOf(plugin.features)` and never imports goals. With goals off there is no
// counter. Pure, no Obsidian imports.

import { port, type PortSource } from "./feature-ports";

export interface DailyProgress {
  /** words added on today's writing day (goals' `addedOn`, honouring "the day ends at") */
  words: number;
  /** the daily goal setting; 0 means no daily goal */
  goal: number;
}

export interface DailyProgressSource {
  current(): DailyProgress;
  /** called when today's words or the goal change (a recorded edit, a settings change, the day rolling over); returns the unsubscribe */
  onChange(cb: () => void): () => void;
}

/** What the goals module exposes: `port(features, "goals")?.dailyProgress` (core/feature-ports.ts). */
export interface DailyProgressHost {
  dailyProgress?: DailyProgressSource;
}

/** Today's progress while goals are on, else null (a soft dependency on "goals"). */
export function dailyProgressOf(features: PortSource): DailyProgressSource | null {
  return port(features, "goals")?.dailyProgress ?? null;
}
