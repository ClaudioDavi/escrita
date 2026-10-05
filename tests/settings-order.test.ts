import { describe, expect, it } from "vitest";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import { SECTION_ORDER, sectionOrder } from "../src/core/settings-order";

const all = new Set<FeatureId>(FEATURE_IDS);
const without = (...ids: FeatureId[]) => new Set([...FEATURE_IDS].filter((i) => !ids.includes(i)));
const ids = (loaded: ReadonlySet<FeatureId>) => sectionOrder(loaded).map((s) => s.id);

describe("sectionOrder (PLAN-0.8 Q13)", () => {
  it("with every feature loaded, keeps today's visual order", () => {
    expect(ids(all)).toEqual([
      "features", "shared", "books", "dayEnds", "goals", "publish", "outline", "placeholders", "darlings",
      "editor", "lens", "stages", "desk", "snapshots", "universe", "threads",
    ]);
  });

  it("with nothing loaded, only the core sections draw", () => {
    expect(ids(new Set())).toEqual(["features", "shared", "books", "dayEnds", "stages"]);
  });

  it("a section is gone with its module", () => {
    expect(ids(without("lens"))).not.toContain("lens");
    expect(ids(without("goals"))).not.toContain("goals");
    expect(ids(without("desk"))).not.toContain("desk");
    expect(ids(without("snapshots"))).not.toContain("snapshots");
  });

  it("a section with shared rows stays while another reader is loaded", () => {
    // the marker is read by publish too
    expect(ids(without("placeholders"))).toContain("placeholders");
    expect(ids(without("placeholders", "publish"))).not.toContain("placeholders");
    // the paragraph and quote styles are read by the dialogue focus, the block mover and the lens
    expect(ids(without("typing"))).toContain("editor");
    expect(ids(without("typing", "dialogueFocus", "moveBlocks", "lens"))).not.toContain("editor");
    // the universe heading holds the thread words
    expect(ids(without("universe"))).toContain("universe");
    expect(ids(without("universe", "threads"))).not.toContain("universe");
  });

  it("names every slot once, and only known features", () => {
    const seen = SECTION_ORDER.map((s) => s.id);
    expect(new Set(seen).size).toBe(seen.length);
    for (const s of SECTION_ORDER) {
      if (s.feature !== null) expect(FEATURE_IDS).toContain(s.feature);
      for (const a of s.also ?? []) expect(FEATURE_IDS).toContain(a);
    }
  });

  it("does not change its input", () => {
    const loaded = new Set<FeatureId>(["goals"]);
    sectionOrder(loaded);
    expect([...loaded]).toEqual(["goals"]);
  });
});
