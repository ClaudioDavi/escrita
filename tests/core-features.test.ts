import { describe, expect, it } from "vitest";
import { FEATURE_IDS, FEATURE_SPECS, cleanFeatures } from "../src/core/features";
import { EMPTY_TABLE } from "../src/core/names";
import { NamesPort, type NamesProvider } from "../src/core/names-source";
import { NAME_TITLES } from "../src/core/name-titles";
import { defaultUniverseSettings, normalizeUniverse } from "../src/universe/settings";

describe("feature list", () => {
  it("has one spec per id, in id order, with 17 switches", () => {
    expect(FEATURE_IDS).toHaveLength(17);
    expect(FEATURE_SPECS.map((s) => s.id)).toEqual([...FEATURE_IDS]);
  });

  it("only the stage snapshot has a requirement, and it is snapshots", () => {
    const withReq = FEATURE_SPECS.filter((s) => s.requires);
    expect(withReq.map((s) => [s.id, s.requires])).toEqual([["stageSnapshot", ["snapshots"]]]);
  });

  it("three features keep their switch in an existing setting (Q10)", () => {
    expect(FEATURE_SPECS.filter((s) => s.switch).map((s) => [s.id, s.switch])).toEqual([
      ["explorerCounts", "explorerCounts"],
      ["spellcheck", "spellcheckOnDemand"],
      ["universe", "universeMode"],
    ]);
  });
});

describe("cleanFeatures", () => {
  it("keeps known ids with boolean values", () => {
    expect(cleanFeatures({ goals: false, lens: true })).toEqual({ goals: false, lens: true });
  });

  it("drops unknown ids and non-booleans", () => {
    expect(cleanFeatures({ goals: "no", lens: 0, nope: true, outline: false })).toEqual({ outline: false });
  });

  it("gives an empty record for anything that is not an object", () => {
    for (const v of [undefined, null, 3, "x", [], [true]]) expect(cleanFeatures(v)).toEqual({});
  });

  it("ignores inherited keys", () => {
    expect(cleanFeatures(Object.create({ goals: false }))).toEqual({});
  });

  it("returns a new record and leaves its input alone", () => {
    const raw = { goals: false, nope: 1 };
    const out = cleanFeatures(raw);
    expect(out).not.toBe(raw);
    expect(raw).toEqual({ goals: false, nope: 1 });
  });

  it("keeps all 17 ids when every one is a boolean", () => {
    const raw = Object.fromEntries(FEATURE_IDS.map((id, i) => [id, i % 2 === 0]));
    expect(cleanFeatures(raw)).toEqual(raw);
  });
});

describe("universe settings additions", () => {
  it("defaults: English property names, no extra titles, no underline", () => {
    const s = normalizeUniverse(undefined);
    expect(s.caseSensitiveProperty).toBe("caseSensitive");
    expect(s.ignoreProperty).toBe("ignore");
    expect(s.firstNameProperty).toBe("firstName");
    expect(s.nameTitles).toBe("");
    expect(s.underlineNames).toBe(false);
    expect(defaultUniverseSettings()).toMatchObject({ ignoreProperty: "ignore", underlineNames: false });
  });

  it("keeps valid values, restores blank names, rejects non-boolean underline", () => {
    const s = normalizeUniverse({ ignoreProperty: " ignorar ", firstNameProperty: "  ", nameTitles: "Doutor\nComandante", underlineNames: "yes" });
    expect(s.ignoreProperty).toBe("ignorar");
    expect(s.firstNameProperty).toBe("firstName");
    expect(s.nameTitles).toBe("Doutor\nComandante");
    expect(s.underlineNames).toBe(false);
    expect(normalizeUniverse({ underlineNames: true }).underlineNames).toBe(true);
  });
});

describe("name titles", () => {
  it("has built-in tables for both languages", () => {
    expect(NAME_TITLES.pt).toContain("Dona");
    expect(NAME_TITLES.pt).toContain("Vô");
    expect(NAME_TITLES.en).toContain("Mr");
    expect(NAME_TITLES.en).not.toContain("Dona");
  });

  it("has the pt titles added after the wave 0 review", () => {
    for (const t of ["Irmão", "Senhor", "Senhora", "Doutor", "Doutora"]) expect(NAME_TITLES.pt).toContain(t);
  });

  it("has no duplicates and no trailing dots", () => {
    for (const list of Object.values(NAME_TITLES)) {
      expect(new Set(list).size).toBe(list.length);
      for (const t of list) expect(t.endsWith(".")).toBe(false);
    }
  });
});

describe("NamesPort", () => {
  const provider = (version = 1): NamesProvider & { fire(): void } => {
    const cbs = new Set<() => void>();
    return {
      tableFor: () => ({ terms: [], lang: "pt", signature: "p" }),
      entryFor: (text) => (text === "Maria" ? { path: "Maria.md", name: "Maria" } : null),
      version: () => version,
      onChange: (cb) => { cbs.add(cb); return () => { cbs.delete(cb); }; },
      fire: () => { for (const cb of [...cbs]) cb(); },
    };
  };

  it("answers empty with no provider", () => {
    const port = new NamesPort();
    expect(port.tableFor("a.md")).toBe(EMPTY_TABLE);
    expect(port.entryFor("Maria", "a.md")).toBeNull();
  });

  it("delegates while provided and is empty again after withdrawal", () => {
    const port = new NamesPort();
    const stop = port.provide(provider());
    expect(port.tableFor("a.md").signature).toBe("p");
    expect(port.entryFor("Maria", "a.md")).toEqual({ path: "Maria.md", name: "Maria" });
    stop();
    expect(port.tableFor("a.md")).toBe(EMPTY_TABLE);
    expect(port.entryFor("Maria", "a.md")).toBeNull();
  });

  it("version only grows, and listeners hear provide, change and withdrawal", () => {
    const port = new NamesPort();
    let heard = 0;
    port.onChange(() => { heard++; });
    const v0 = port.version();
    const p = provider();
    const stop = port.provide(p);
    const v1 = port.version();
    p.fire();
    const v2 = port.version();
    stop();
    const v3 = port.version();
    expect(v0 < v1 && v1 < v2 && v2 < v3).toBe(true);
    expect(heard).toBe(3);
  });

  it("a stale withdrawal does not remove a newer provider", () => {
    const port = new NamesPort();
    const stopOld = port.provide(provider());
    port.provide(provider());
    stopOld();
    expect(port.tableFor("a.md").signature).toBe("p");
  });
});
