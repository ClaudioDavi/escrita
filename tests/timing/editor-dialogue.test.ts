import { describe, it, expect } from "vitest";
import { dimPlan, type DialogueOptions } from "../../src/core/dialogue";
import { segment } from "../../src/core/markdown";
import { dialogueNote } from "../support/dialogue-note";

const BLANK: DialogueOptions = { quoteStyle: "curly", paragraphStyle: "blank" };

describe("performance: viewport-limited", () => {
  const md = segment(dialogueNote());

  it("builds a viewport's decorations quickly", () => {
    dimPlan(md, 0, 60, BLANK); // warm up (math overlay cache)
    const runs = 200;
    const t0 = performance.now();
    for (let i = 0; i < runs; i++) {
      const from = (i * 13) % (md.lineCount - 60);
      dimPlan(md, from, from + 60, BLANK);
    }
    const per = (performance.now() - t0) / runs;
    // a 60-line viewport should cost well under a millisecond; the bound is loose for CI
    expect(per).toBeLessThan(5);
  });

  it("a viewport costs much less than the whole note", () => {
    const time = (f: () => void, n: number) => {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) f();
      return (performance.now() - t0) / n;
    };
    const whole = time(() => dimPlan(md, 0, md.lineCount - 1, BLANK), 5);
    const view = time(() => dimPlan(md, 1500, 1560, BLANK), 50);
    expect(view).toBeLessThan(whole);
  });
});
