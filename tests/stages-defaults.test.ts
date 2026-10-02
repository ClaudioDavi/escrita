import { describe, it, expect } from "vitest";
import { DEFAULT_STAGES, STAGES, ownStages } from "../src/core/stages";
import { mergeDefaults } from "../src/core/merge";

describe("default stages are never shared", () => {
  it("are deep-frozen", () => {
    expect(Object.isFrozen(DEFAULT_STAGES)).toBe(true);
    for (const k of STAGES) expect(Object.isFrozen(DEFAULT_STAGES[k])).toBe(true);
    expect(() => { (DEFAULT_STAGES.draft as { words: string }).words = "x"; }).toThrow();
  });
  it("mergeDefaults shares the reference, ownStages breaks it", () => {
    const merged = mergeDefaults({ stages: DEFAULT_STAGES }, {});
    expect(merged.stages).toBe(DEFAULT_STAGES);
    const own = ownStages(merged.stages);
    expect(own).not.toBe(DEFAULT_STAGES);
    expect(own).toEqual(DEFAULT_STAGES);
    own.draft.words = "rascunho";
    expect(DEFAULT_STAGES.draft.words).toBe("draft");
  });
  it("ownStages keeps a writer's own mutable mapping", () => {
    const mine = ownStages(DEFAULT_STAGES);
    expect(ownStages(mine)).toBe(mine);
  });
});
