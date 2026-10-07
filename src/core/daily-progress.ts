// The daily progress port (1.0, Wave 2 seams): today's words against the daily goal, the
// same numbers as the goals status bar. The goals module provides it while loaded; writing
// mode's counter ("today 312 / 500", board 39, task 2.4) reads it through
// `dailyProgressOf(plugin.features)` and never imports goals. With goals off there is no
// counter. Pure, no Obsidian imports.

import type { FeatureId } from "./features";

export interface DailyProgress {
  /** words added on today's writing day (goals' `addedOn`, honouring "the day ends at") */
  words: number;
  /** the daily goal setting; 0 means no daily goal */
  goal: number;
}

export interface DailyProgressSource {
  current(): DailyProgress;
  /** called whenever the status bar would redraw (a recorded edit, a settings change, the minute tick); returns the unsubscribe */
  onChange(cb: () => void): () => void;
}

/** What the goals module exposes: `features.get<DailyProgressHost>("goals")?.dailyProgress`. */
export interface DailyProgressHost {
  dailyProgress?: DailyProgressSource;
}

/** Today's progress while goals are on, else null (a soft dependency on "goals"). */
export function dailyProgressOf(features: { get<T>(id: FeatureId): T | undefined }): DailyProgressSource | null {
  return features.get<DailyProgressHost>("goals")?.dailyProgress ?? null;
}
