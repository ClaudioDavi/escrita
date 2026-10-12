import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_IDS, type FeatureId } from "../src/core/features";
import { SECTION_ORDER, sectionOrder } from "../src/core/settings-order";
import { coreStrings } from "../src/strings";
import { exportStrings } from "../src/export/strings";
import { submissionsStrings } from "../src/submissions/strings";
import { universeStrings } from "../src/universe/strings";

const all = new Set<FeatureId>(FEATURE_IDS);
const without = (...ids: FeatureId[]) => new Set([...FEATURE_IDS].filter((i) => !ids.includes(i)));
const ids = (loaded: ReadonlySet<FeatureId>) => sectionOrder(loaded).map((s) => s.id);

describe("sectionOrder (PLAN-0.8 Q13)", () => {
  it("with every feature loaded, keeps today's visual order", () => {
    expect(ids(all)).toEqual([
      "features", "shared", "books", "dayEnds", "goals", "publish", "export", "submissions", "outline", "placeholders", "darlings",
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

  it("gives each slot a heading key, unique, or null to continue the group above (PLAN-1.0.3 Q4)", () => {
    const keys = SECTION_ORDER.map((s) => s.heading).filter((h): h is string => h !== null);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SECTION_ORDER[0].heading).not.toBeNull();
    expect(SECTION_ORDER.filter((s) => s.heading === null).map((s) => s.id)).toEqual(["dayEnds", "threads"]);
    const tables = [coreStrings, exportStrings, submissionsStrings, universeStrings];
    for (const k of keys) {
      for (const lang of ["en", "pt-BR"] as const) expect(tables.some((s) => s[lang][k]), `${k} (${lang})`).toBe(true);
    }
  });

  it("does not change its input", () => {
    const loaded = new Set<FeatureId>(["goals"]);
    sectionOrder(loaded);
    expect([...loaded]).toEqual(["goals"]);
  });
});

// A module with a settings section and no slot would never draw (0.8: export and submissions
// were missed until this guard). Scans each feature class in src/ for its id and settingsSection
// or settingsItems.
describe("every settings section has a slot", () => {
  // drawn elsewhere: the explorer's rows sit under its switch on the Features page
  const ELSEWHERE = new Set<string>(["explorerCounts"]);
  const files = readdirSync("src", { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts")).map((f) => join("src", f));
  const withSection: string[] = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const cls of text.split(/\bclass\s+/).slice(1)) {
      const id = /readonly id(?::\s*FeatureId)?\s*=\s*"([A-Za-z]+)"/.exec(cls)?.[1];
      if (id && /\bsettings(?:Section|Items)\s*\(/.test(cls.split(/\bclass\s+/)[0]!)) withSection.push(id);
    }
  }

  it("finds the modules' sections", () => {
    expect(withSection).toContain("export");
    expect(withSection).toContain("submissions");
  });

  it("gives each one a slot", () => {
    const slotted = new Set(SECTION_ORDER.map((s) => s.feature).filter(Boolean));
    for (const id of withSection) if (!ELSEWHERE.has(id)) expect(slotted, id).toContain(id);
  });
});
