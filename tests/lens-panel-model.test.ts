import { describe, expect, it } from "vitest";
import { enabledRules, per1000, ruleRows, stepTo, withoutDismissed } from "../src/lens/panel-model";
import { RULES } from "../src/lens/types";
import type { LensResult, Match, RuleId } from "../src/lens/types";

function m(rule: RuleId, from: number, to = from + 3): Match {
  return { rule, kind: "base", from, to, text: "x".repeat(to - from) };
}

function result(matches: Match[], words = 500): LensResult {
  const counts = {} as Record<RuleId, number>;
  for (const r of RULES) counts[r] = 0;
  for (const x of matches) counts[x.rule]++;
  return { version: 1, matches, counts, words } as unknown as LensResult;
}

describe("per1000", () => {
  it("is unrounded and safe with no words", () => {
    expect(per1000(2, 500)).toBe(4);
    expect(per1000(1, 3)).toBeCloseTo(333.333, 2);
    expect(per1000(5, 0)).toBe(0);
    expect(per1000(0, 100)).toBe(0);
  });
});

describe("withoutDismissed", () => {
  const ms = [m("adverb", 0), m("adverb", 10), m("adverb", 20), m("gerund", 30)];
  it("lowers only the dismissed rule's count", () => {
    const out = withoutDismissed(result(ms), (x) => x.from !== 10);
    expect(out.counts.adverb).toBe(2);
    expect(out.counts.gerund).toBe(1);
    expect(out.matches).toHaveLength(3);
    expect(out.words).toBe(500);
  });
  it("makes stepping say 2 / 2, not 2 / 3", () => {
    const out = withoutDismissed(result(ms), (x) => x.from !== 10);
    const s = stepTo(out.matches, "adverb", 0, 1);
    expect(s).toMatchObject({ of: 2, index: 1 });
    expect(s!.match.from).toBe(20);
  });
  it("does not mutate the input", () => {
    const r = result(ms);
    withoutDismissed(r, () => false);
    expect(r.matches).toHaveLength(4);
    expect(r.counts.adverb).toBe(3);
  });
});

describe("stepTo", () => {
  const ms = [m("echo", 5), m("adverb", 8), m("echo", 20), m("echo", 40)];
  it("steps forward and wraps", () => {
    expect(stepTo(ms, "echo", 0, 1)!.match.from).toBe(5);
    expect(stepTo(ms, "echo", 5, 1)!.match.from).toBe(20);
    expect(stepTo(ms, "echo", 40, 1)).toMatchObject({ index: 0, of: 3 });
  });
  it("steps back and wraps", () => {
    expect(stepTo(ms, "echo", 30, -1)!.match.from).toBe(20);
    expect(stepTo(ms, "echo", 20, -1)!.match.from).toBe(5);
    expect(stepTo(ms, "echo", 5, -1)).toMatchObject({ index: 2, of: 3 });
  });
  it("steps past a match the cursor is inside", () => {
    expect(stepTo(ms, "echo", 21, 1)!.match.from).toBe(40);
    expect(stepTo(ms, "echo", 21, -1)!.match.from).toBe(5);
  });
  it("handles one match and none", () => {
    expect(stepTo(ms, "adverb", 8, 1)).toMatchObject({ index: 0, of: 1 });
    expect(stepTo(ms, "adverb", 8, -1)).toMatchObject({ index: 0, of: 1 });
    expect(stepTo(ms, "long", 0, 1)).toBeNull();
    expect(stepTo([], "echo", 0, -1)).toBeNull();
  });
});

describe("enabledRules", () => {
  it("leaves out the switched-off rules and ignores unknown ids", () => {
    const s = enabledRules(["adverb", "nonsense"]);
    expect(s.has("adverb")).toBe(false);
    expect(s.size).toBe(RULES.length - 1);
    expect(enabledRules([]).size).toBe(RULES.length);
  });
});

describe("ruleRows", () => {
  const full = { crutch: ["bem"], names: ["Ana"] };
  const r = result([m("echo", 0), m("echo", 9), m("adverb", 20)], 1000);
  it("leaves out disabled rules", () => {
    const rows = ruleRows(r, enabledRules(["long", "gerund"]), full, "en");
    expect(rows.map((x) => x.rule)).toEqual(["echo", "adverb", "crutch", "name"]);
  });
  it("gives counts and rates", () => {
    const rows = ruleRows(r, enabledRules([]), full, "en");
    expect(rows.find((x) => x.rule === "echo")).toEqual({ rule: "echo", kind: "on", count: 2, rate: 2 });
  });
  it("flags empty lists independently", () => {
    const all = enabledRules([]);
    const a = ruleRows(r, all, { crutch: [], names: ["Ana"] }, "en");
    expect(a.find((x) => x.rule === "crutch")!.kind).toBe("needsLists");
    expect(a.find((x) => x.rule === "name")!.kind).toBe("on");
    const b = ruleRows(r, all, { crutch: ["bem"], names: [] }, "en");
    expect(b.find((x) => x.rule === "crutch")!.kind).toBe("on");
    expect(b.find((x) => x.rule === "name")!.kind).toBe("needsLists");
  });
  it("flags language rules when there is no language", () => {
    const rows = ruleRows(r, enabledRules([]), full, null);
    for (const rule of ["echo", "adverb", "gerund"]) {
      expect(rows.find((x) => x.rule === rule)).toMatchObject({ kind: "needsLanguage", count: 0, rate: 0 });
    }
    expect(rows.find((x) => x.rule === "long")!.kind).toBe("on");
  });
});
