import { beforeAll, describe, expect, it } from "vitest";
import { FEATURE_IDS, FEATURE_PAGE, FEATURE_SPECS, wanted } from "../src/core/features";
import { registerStrings } from "../src/i18n";
import { coreStrings } from "../src/strings";
import { DEFAULT_SETTINGS, SETTING_FEATURES, rowShown, setFeature } from "../src/settings";
import { switchesOf } from "../src/core/feature-registry";
import { defaultUniverseSettings } from "../src/universe/settings";

beforeAll(() => registerStrings(coreStrings));

const langs = ["en", "pt-BR"] as const;
const groups = ["writing", "revision", "desk", "publishing", "world"] as const;

describe("the Features page text", () => {
  it.each(langs)("every feature has a name and a line in %s", (lang) => {
    const dict = coreStrings[lang];
    for (const id of FEATURE_IDS) {
      expect(dict[`settings.features.${id}`], `${id} name`).toBeTruthy();
      expect(dict[`settings.features.${id}.desc`], `${id} line`).toBeTruthy();
    }
  });

  it.each(langs)("has group names, the stages row, the dependency texts and the new property rows in %s", (lang) => {
    const dict = coreStrings[lang];
    const keys = [
      ...groups.map((g) => `settings.features.group.${g}`),
      "settings.features", "settings.features.desc", "settings.language", "settings.language.desc",
      "settings.language.auto", "settings.language.pt", "settings.language.en",
      "settings.features.stages", "settings.features.stages.desc", "settings.features.alwaysOn",
      "settings.features.uses.snapshots", "settings.features.needs.snapshots", "settings.features.needs.snapshots.desc",
      "settings.features.turnOn.snapshots", "settings.features.snapshots.off",
      "settings.features.export", "settings.features.export.desc",
      "settings.shared", "settings.shared.desc",
      "settings.povProperty", "settings.povProperty.desc", "settings.chapterTargetProperty", "settings.chapterTargetProperty.desc",
    ];
    for (const k of keys) expect(dict[k], k).toBeTruthy();
  });

  it("the page lists every feature once, in its own group", () => {
    const listed = FEATURE_PAGE.flatMap((g) => g.ids);
    expect([...listed].sort()).toEqual([...FEATURE_IDS].sort());
    for (const g of FEATURE_PAGE) {
      for (const id of g.ids) expect(FEATURE_SPECS.find((f) => f.id === id)?.group).toBe(g.group);
    }
  });
});

describe("settings rows and features (Q13)", () => {
  // The switches and the universe section's own rows are not rows of this table.
  const notRows = new Set(["features", "explorerCounts", "spellcheckOnDemand", ...Object.keys(defaultUniverseSettings())]);
  const rowKeys = Object.keys(DEFAULT_SETTINGS).filter((k) => !notRows.has(k));

  it("every settings row maps to a feature or to always", () => {
    expect(Object.keys(SETTING_FEATURES).sort()).toEqual([...rowKeys].sort());
    for (const [key, f] of Object.entries(SETTING_FEATURES)) {
      if (f === "always") continue;
      expect(f.length, key).toBeGreaterThan(0);
      for (const id of f) expect(FEATURE_IDS, `${key} -> ${id}`).toContain(id);
    }
  });

  it("the property names and the track folders are always shown", () => {
    for (const k of ["targetProperty", "limitProperty", "unitProperty", "deadlineProperty", "goalProperty",
      "povProperty", "chapterTargetProperty", "trackFolders", "excludeFolders", "lensLanguage"]) {
      expect(SETTING_FEATURES[k], k).toBe("always");
    }
  });

  it("a row draws while any feature that reads it is on", () => {
    const all = new Set(FEATURE_IDS);
    const without = (...ids: string[]) => new Set([...FEATURE_IDS].filter((i) => !ids.includes(i)));
    expect(rowShown("dailyGoal", all)).toBe(true);
    expect(rowShown("dailyGoal", without("goals"))).toBe(false);
    // the writing day is read by goals, darlings, snapshots and publish
    expect(rowShown("dayEndsAt", without("goals"))).toBe(true);
    expect(rowShown("dayEndsAt", without("goals", "darlings", "snapshots", "publish"))).toBe(false);
    // the marker is read by placeholders and by publish
    expect(rowShown("placeholderMarker", without("placeholders"))).toBe(true);
    expect(rowShown("placeholderMarker", without("placeholders", "publish"))).toBe(false);
    // quotes: typing, dialogue focus and the lens
    expect(rowShown("quoteStyle", without("typing", "dialogueFocus"))).toBe(true);
    expect(rowShown("quoteStyle", without("typing", "dialogueFocus", "lens"))).toBe(false);
    expect(rowShown("paragraphStyle", without("typing", "dialogueFocus", "lens"))).toBe(true); // move blocks
    expect(rowShown("lensEchoWindow", without("lens"))).toBe(false);
    expect(rowShown("explorerShowTarget", without("explorerCounts"))).toBe(false);
    expect(rowShown("targetProperty", new Set())).toBe(true);
  });

  it("with the defaults, only spellcheck on demand and the universe are off", () => {
    const want = wanted(switchesOf({ ...DEFAULT_SETTINGS, universeMode: "off" }));
    expect([...FEATURE_IDS].filter((i) => !want.has(i)).sort()).toEqual(["spellcheck", "universe"]);
  });
});

describe("setFeature", () => {
  const fresh = () => ({ ...DEFAULT_SETTINGS, features: {} });

  it("saves a plain feature in `features` and keeps the others", () => {
    const s = fresh();
    setFeature(s, "lens", false);
    setFeature(s, "goals", false);
    setFeature(s, "lens", true);
    expect(s.features).toEqual({ lens: true, goals: false });
  });

  it("word counts and spellcheck on demand live in their own settings (Q10)", () => {
    const s = fresh();
    setFeature(s, "explorerCounts", false);
    setFeature(s, "spellcheck", true);
    expect(s.explorerCounts).toBe(false);
    expect(s.spellcheckOnDemand).toBe(true);
    expect(s.features).toEqual({});
  });

  it("the universe switch is the mode", () => {
    const s = fresh();
    setFeature(s, "universe", true);
    expect(s.universeMode).toBe("perBook");
    s.universeMode = "universe";
    setFeature(s, "universe", true);
    expect(s.universeMode).toBe("universe");
    setFeature(s, "universe", false);
    expect(s.universeMode).toBe("off");
  });

  it("the stage snapshot keeps its stored value while snapshots is off", () => {
    const s = fresh();
    setFeature(s, "snapshots", false);
    expect(wanted(switchesOf(s)).has("stageSnapshot")).toBe(false);
    expect((s.features as Record<string, boolean>).stageSnapshot).toBeUndefined();
    setFeature(s, "snapshots", true);
    expect(wanted(switchesOf(s)).has("stageSnapshot")).toBe(true);
  });
});
