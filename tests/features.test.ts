import { describe, expect, it } from "vitest";
import { FEATURE_IDS, planApply, switchedOn, wanted, type FeatureId, type FeatureSwitches } from "../src/core/features";

function sw(over: Partial<FeatureSwitches> = {}): FeatureSwitches {
  return { features: {}, explorerCounts: true, spellcheckOnDemand: true, universeMode: "universe", ...over };
}

describe("switchedOn", () => {
  it("a missing key means on", () => {
    const s = sw();
    for (const id of FEATURE_IDS) expect(switchedOn(id, s)).toBe(true);
  });

  it("a false key means off, and only for that feature", () => {
    const s = sw({ features: { lens: false } });
    expect(switchedOn("lens", s)).toBe(false);
    expect(switchedOn("goals", s)).toBe(true);
  });

  it("an explicit true is on", () => {
    expect(switchedOn("goals", sw({ features: { goals: true } }))).toBe(true);
  });

  it("explorerCounts follows its own setting, not the features record", () => {
    expect(switchedOn("explorerCounts", sw({ explorerCounts: false }))).toBe(false);
    expect(switchedOn("explorerCounts", sw({ explorerCounts: false, features: { explorerCounts: true } }))).toBe(false);
    expect(switchedOn("explorerCounts", sw({ explorerCounts: true, features: { explorerCounts: false } }))).toBe(true);
  });

  it("spellcheck follows spellcheckOnDemand", () => {
    expect(switchedOn("spellcheck", sw({ spellcheckOnDemand: false }))).toBe(false);
    expect(switchedOn("spellcheck", sw({ spellcheckOnDemand: true }))).toBe(true);
  });

  it("the universe is on in perBook and universe modes and off in off", () => {
    expect(switchedOn("universe", sw({ universeMode: "off" }))).toBe(false);
    expect(switchedOn("universe", sw({ universeMode: "perBook" }))).toBe(true);
    expect(switchedOn("universe", sw({ universeMode: "universe" }))).toBe(true);
  });

  it("threads is independent of the universe mode", () => {
    expect(switchedOn("threads", sw({ universeMode: "off" }))).toBe(true);
  });
});

describe("wanted", () => {
  it("is every feature when all switches are on", () => {
    expect([...wanted(sw())]).toEqual([...FEATURE_IDS]);
  });

  it("snapshots off takes the stage snapshot off, and its stored value is untouched", () => {
    const features = { snapshots: false, stageSnapshot: true };
    const w = wanted(sw({ features }));
    expect(w.has("snapshots")).toBe(false);
    expect(w.has("stageSnapshot")).toBe(false);
    expect(features).toEqual({ snapshots: false, stageSnapshot: true });
    // and it comes back with snapshots
    expect(wanted(sw({ features: { stageSnapshot: true } })).has("stageSnapshot")).toBe(true);
  });

  it("the stage snapshot off alone leaves snapshots on", () => {
    const w = wanted(sw({ features: { stageSnapshot: false } }));
    expect(w.has("snapshots")).toBe(true);
    expect(w.has("stageSnapshot")).toBe(false);
  });

  it("combines the three setting-backed switches", () => {
    const w = wanted(sw({ explorerCounts: false, spellcheckOnDemand: false, universeMode: "off" }));
    expect([...w].filter((id) => ["explorerCounts", "spellcheck", "universe"].includes(id))).toEqual([]);
    expect(w.size).toBe(FEATURE_IDS.length - 3);
  });
});

describe("planApply", () => {
  const set = (...ids: FeatureId[]) => new Set<FeatureId>(ids);

  it("loads in FEATURE_IDS order, whatever order the set was built in", () => {
    expect(planApply(set(), set("lens", "goals", "publish", "outline"))).toEqual({
      unload: [],
      load: ["goals", "outline", "lens", "publish"],
    });
  });

  it("unloads in reverse FEATURE_IDS order", () => {
    expect(planApply(set("goals", "lens", "publish", "outline"), set())).toEqual({
      unload: ["publish", "lens", "outline", "goals"],
      load: [],
    });
  });

  it("only touches what changed", () => {
    expect(planApply(set("goals", "outline", "lens"), set("goals", "lens", "publish"))).toEqual({
      unload: ["outline"],
      load: ["publish"],
    });
  });

  it("is empty when nothing changed", () => {
    const s = set("goals", "lens");
    expect(planApply(s, new Set(s))).toEqual({ unload: [], load: [] });
  });

  it("a full switch-off then on keeps the orders mirrored", () => {
    const all = new Set<FeatureId>(FEATURE_IDS);
    const off = planApply(all, set());
    const on = planApply(set(), all);
    expect(off.unload).toEqual([...on.load].reverse());
  });
});
