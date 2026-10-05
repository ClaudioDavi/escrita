import { describe, expect, it } from "vitest";
import { FEATURE_GROUPS, FEATURE_IDS, FEATURE_PAGE, FEATURE_SPECS, wanted } from "../src/core/features";
import { switchesOf } from "../src/core/feature-registry";

describe("derived Features page (IMPROVEMENTS 20)", () => {
  it("every spec has a page number, unique within its group", () => {
    for (const g of FEATURE_GROUPS) {
      const pages = FEATURE_SPECS.filter((s) => s.group === g).map((s) => s.page);
      expect(pages.every((p) => typeof p === "number")).toBe(true);
      expect(new Set(pages).size).toBe(pages.length);
    }
  });

  it("lists every id once, groups in fixed order", () => {
    expect(FEATURE_PAGE.map((g) => g.group)).toEqual([...FEATURE_GROUPS]);
    expect(FEATURE_PAGE.flatMap((g) => g.ids).sort()).toEqual([...FEATURE_IDS].sort());
  });

  it("matches the approved board order, with export and submissions after publish", () => {
    expect(FEATURE_PAGE).toEqual([
      { group: "writing", ids: ["goals", "outline", "placeholders", "typing", "dialogueFocus", "moveBlocks", "templates", "spellcheck", "explorerCounts"] },
      { group: "revision", ids: ["lens", "snapshots", "darlings"] },
      { group: "desk", ids: ["stageSnapshot", "desk"] },
      { group: "publishing", ids: ["publish", "export", "submissions"] },
      { group: "world", ids: ["universe", "threads"] },
    ]);
  });

  it("export and submissions load right after publish", () => {
    const i = FEATURE_IDS.indexOf("publish");
    expect(FEATURE_IDS.slice(i, i + 3)).toEqual(["publish", "export", "submissions"]);
  });

  it("switchesOf reads the four switches and wants the new ids by default", () => {
    const sw = switchesOf({ features: { export: false }, explorerCounts: true, spellcheckOnDemand: false, universeMode: "off" });
    expect(sw).toEqual({ features: { export: false }, explorerCounts: true, spellcheckOnDemand: false, universeMode: "off" });
    const w = wanted(sw);
    expect(w.has("export")).toBe(false);
    expect(w.has("submissions")).toBe(true);
  });
});
