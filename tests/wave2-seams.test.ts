import { describe, expect, it } from "vitest";
import { writingModeOf, type WritingModePort } from "../src/core/writing-mode";
import { dailyProgressOf, type DailyProgressSource } from "../src/core/daily-progress";
import { VIEW_TYPES } from "../src/core/view-types";
import type { FeatureId } from "../src/core/features";

// The Wave 2 seams (PLAN-1.0, "Wave 2 seams"): the soft-dependency readers and the view ids.
function features(on: Partial<Record<FeatureId, unknown>>) {
  return { get: <T>(id: FeatureId): T | undefined => on[id] as T | undefined };
}

describe("Wave 2 seams", () => {
  it("writing mode only while the desk is on", () => {
    const port = { isActive: () => false } as unknown as WritingModePort;
    expect(writingModeOf(features({}))).toBeNull();
    expect(writingModeOf(features({ desk: {} }))).toBeNull();
    expect(writingModeOf(features({ desk: { writingMode: port } }))).toBe(port);
  });

  it("daily progress only while goals are on", () => {
    const src = { current: () => ({ words: 3, goal: 500 }) } as unknown as DailyProgressSource;
    expect(dailyProgressOf(features({}))).toBeNull();
    expect(dailyProgressOf(features({ goals: { dailyProgress: src } }))).toBe(src);
  });

  it("the view ids are the ones saved in workspaces since 0.x", () => {
    expect(VIEW_TYPES).toEqual({
      outline: "escrita-outline", lens: "escrita-lens", placeholders: "escrita-placeholders", universe: "escrita-universe",
    });
  });
});
