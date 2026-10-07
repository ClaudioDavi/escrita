import { describe, expect, it } from "vitest";
import { FEATURE_IDS, FEATURE_SPECS, switchedOn, wanted, type FeatureSwitches } from "../src/core/features";
import { PRESETS, PRESET_IDS, matchingPreset, presetChanges, presetSwitches } from "../src/core/feature-presets";

const allOn = (): FeatureSwitches => ({ features: {}, explorerCounts: true, spellcheckOnDemand: true, universeMode: "off" });
// the author's 0.9 fixture: spellcheck off (the default), features { lens, snapshots }
const fixture = (): FeatureSwitches => ({
  features: { lens: true, snapshots: true }, explorerCounts: true, spellcheckOnDemand: false, universeMode: "off",
});

describe("PRESETS", () => {
  it("has the sizes of board 38, without the universe", () => {
    expect(PRESETS.essentials).toHaveLength(9);
    expect(PRESETS.writer).toHaveLength(16);
    expect(PRESETS.everything).toHaveLength(18);
    for (const id of PRESET_IDS) expect(PRESETS[id]).not.toContain("universe");
  });
  it("is closed under requires and nested", () => {
    for (const id of PRESET_IDS) {
      for (const spec of FEATURE_SPECS) {
        if (PRESETS[id].includes(spec.id)) for (const r of spec.requires ?? []) expect(PRESETS[id]).toContain(r);
      }
    }
    for (const f of PRESETS.essentials) expect(PRESETS.writer).toContain(f);
    for (const f of PRESETS.writer) expect(PRESETS.everything).toContain(f);
  });
});

describe("presetSwitches", () => {
  it("writes an explicit boolean for each record feature and leaves the input alone", () => {
    const cur = allOn();
    const out = presetSwitches("essentials", cur);
    expect(cur.features).toEqual({});
    expect(out.features.goals).toBe(true);
    expect(out.features.threads).toBe(false);
    expect(out.features.universe).toBeUndefined();
    expect(out.explorerCounts).toBe(false);
    expect(out.spellcheckOnDemand).toBe(false);
  });
  it("keeps universeMode", () => {
    for (const mode of ["off", "perBook", "universe"] as const) {
      for (const id of PRESET_IDS) expect(presetSwitches(id, { ...allOn(), universeMode: mode }).universeMode).toBe(mode);
    }
  });
  it("round-trips to its own preset and wanted() equals the list", () => {
    for (const id of PRESET_IDS) {
      const out = presetSwitches(id, fixture());
      expect(matchingPreset(out)).toBe(id);
      expect([...wanted(out)].filter((f) => f !== "universe").sort()).toEqual([...PRESETS[id]].sort());
    }
  });
});

describe("matchingPreset", () => {
  it("reads an all-on 0.9 install as everything", () => {
    expect(matchingPreset(allOn())).toBe("everything");
  });
  it("reads the author's fixture as Custom", () => {
    expect(matchingPreset(fixture())).toBeNull();
  });
  it("ignores the universe", () => {
    for (const mode of ["off", "perBook", "universe"] as const) {
      expect(matchingPreset({ ...presetSwitches("writer", allOn()), universeMode: mode })).toBe("writer");
    }
  });
  it("reads a single changed switch as Custom", () => {
    const s = presetSwitches("writer", allOn());
    s.features.lens = false;
    expect(matchingPreset(s)).toBeNull();
  });
  it("at most one preset matches", () => {
    for (const id of PRESET_IDS) {
      const s = presetSwitches(id, allOn());
      expect(PRESET_IDS.filter((p) => FEATURE_IDS.every((f) => f === "universe" || switchedOn(f, presetSwitches(p, allOn())) === switchedOn(f, s)))).toEqual([id]);
    }
  });
});

describe("presetChanges", () => {
  it("is empty when already on the preset", () => {
    for (const id of PRESET_IDS) expect(presetChanges(presetSwitches(id, allOn()), id)).toEqual({ off: [], on: [] });
  });
  it("lists off and on in FEATURE_IDS order, never the universe", () => {
    const c = presetChanges({ ...allOn(), universeMode: "universe" }, "essentials");
    expect(c.on).toEqual([]);
    expect(c.off).toEqual(FEATURE_IDS.filter((f) => f !== "universe" && !PRESETS.essentials.includes(f)));
    expect(c.off).toContain("threads");
    expect(c.off).not.toContain("universe");
    const up = presetChanges(presetSwitches("essentials", allOn()), "everything");
    expect(up.off).toEqual([]);
    expect(up.on).toContain("threads");
    expect(up.on).not.toContain("universe");
  });
  it("pulls in snapshots when stageSnapshot is on and snapshots off", () => {
    const s = presetSwitches("writer", allOn());
    s.features.snapshots = false;
    expect(presetChanges(s, "writer")).toEqual({ off: [], on: ["snapshots"] });
  });
});
