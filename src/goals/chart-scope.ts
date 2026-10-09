// What the progress window's chart and streak card are about (no Obsidian imports).
// Opened for a book or a piece, the bars are that note's words, so they are not
// compared with the daily goal (which covers all writing). The streak card always
// counts all writing, and says so when the window is scoped.

export type ChartScopeKind = "all" | "book" | "piece";

export interface ChartScopeInfo {
  kind: ChartScopeKind;
  /** colour bars that reach the daily goal, and list "goal met" in the legend */
  showGoalMet: boolean;
  /** string key for the legend entry of the bars */
  wordsKey: string;
  /** the streak card should say it counts all writing */
  streakAllWriting: boolean;
}

export function chartScope(scope: { book: boolean; piece: boolean }): ChartScopeInfo {
  if (scope.book) {
    return { kind: "book", showGoalMet: false, wordsKey: "goals.legend.wordsBook", streakAllWriting: true };
  }
  if (scope.piece) {
    return { kind: "piece", showGoalMet: false, wordsKey: "goals.legend.wordsPiece", streakAllWriting: true };
  }
  return { kind: "all", showGoalMet: true, wordsKey: "goals.legend.words", streakAllWriting: false };
}
