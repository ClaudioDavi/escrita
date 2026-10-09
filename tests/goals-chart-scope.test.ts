import { describe, expect, it } from "vitest";
import { chartScope } from "../src/goals/chart-scope";

describe("chartScope", () => {
  it("keeps the goal-met colour for all writing", () => {
    const s = chartScope({ book: false, piece: false });
    expect(s).toMatchObject({ kind: "all", showGoalMet: true, wordsKey: "goals.legend.words", streakAllWriting: false });
  });
  it("hides it for a book and labels the scope", () => {
    const s = chartScope({ book: true, piece: false });
    expect(s).toMatchObject({ kind: "book", showGoalMet: false, wordsKey: "goals.legend.wordsBook", streakAllWriting: true });
  });
  it("hides it for a piece", () => {
    const s = chartScope({ book: false, piece: true });
    expect(s).toMatchObject({ kind: "piece", showGoalMet: false, wordsKey: "goals.legend.wordsPiece", streakAllWriting: true });
  });
});
