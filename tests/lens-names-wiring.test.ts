import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { namesMask } from "../src/core/name-runs";
import { readMask } from "../src/core/wordcount";
import { enabledRules, newNameGroups, ruleRows } from "../src/lens/panel-model";
import { addNotName, parseNotNames } from "../src/lens/settings";
import type { LensResult, Match } from "../src/lens/types";

const dir = "tests/fixtures/universe-names/Contos/";
const fixtures = readdirSync(dir).map((f) => readFileSync(dir + f, "utf8"));

const EXTRA = [
  "---\ntitle: Zefa\n---\n\n# Zefa\n\nEle viu Zefa na praia.\n\n## Teo\n\nOutra linha com Teo.\n",
  "Antes.\n\n$$\nZefa + Teo\n$$\n\nDepois Zefa.\n",
  "Antes.\n\n$$ Zefa $$\n\n```\nZefa\n```\n\n%% Zefa %%\n\nEle viu `Zefa` e [[Zefa]] e *Teo*.\n",
  "> Ele viu Zefa.\n\n- Ele viu Teo.\n",
  "",
];

describe("the lens mask and the names index's mask agree (counts agree)", () => {
  it.each([...fixtures, ...EXTRA].map((t, i) => [i, t] as const))("text %i: what the lens reads is what namesMask reads", (_i, text) => {
    const md = segment(text);
    expect(readMask(md, { skipQuotes: false })).toBe(namesMask(md));
  });

  it("skipQuotes is the one difference: quote lines the lens never reads, the index does", () => {
    const md = segment(EXTRA[3]);
    const lens = readMask(md, { skipQuotes: true });
    expect(lens).not.toBe(namesMask(md));
    expect(lens.length).toBe(namesMask(md).length);
  });
});

describe("Not names", () => {
  it("parses one per line, trimmed, blanks dropped, each once", () => {
    expect(parseNotNames("Zefa\n  Dona Zefa \r\n\nZefa\n")).toEqual(["Zefa", "Dona Zefa"]);
    expect(parseNotNames("")).toEqual([]);
  });

  it("adds a name as a new last line, once, ignoring case and accents", () => {
    expect(addNotName("", "Zefa")).toBe("Zefa");
    expect(addNotName("Teo\n", "Zefa")).toBe("Teo\nZefa");
    expect(addNotName("Inês", "ines")).toBeNull();
    expect(addNotName("Teo", "  ")).toBeNull();
  });
});

describe("the panel's names", () => {
  const m = (text: string, from: number): Match => ({ rule: "newName", kind: "base", from, to: from + text.length, text });

  it("groups the marked names by fold, most frequent first, the first spelling kept", () => {
    const groups = newNameGroups([m("Zefa", 0), m("Teo", 10), m("Inês", 20), m("Teo", 30), m("Ines", 40), m("Teo", 50),
      { rule: "echo", kind: "base", from: 60, to: 63, text: "ele" }]);
    expect(groups).toEqual([
      { key: "teo", text: "Teo", count: 3 },
      { key: "ines", text: "Inês", count: 2 },
      { key: "zefa", text: "Zefa", count: 1 },
    ]);
  });

  it("the rule is off until lensRulesOn lists it, and says it needs the universe when there is none", () => {
    expect(enabledRules([], []).has("newName")).toBe(false);
    expect(enabledRules([], ["newName"]).has("newName")).toBe(true);
    expect(enabledRules(["newName"], ["newName"]).has("newName")).toBe(false);
    const r = { words: 100, counts: { echo: 0, adverb: 0, gerund: 0, crutch: 0, name: 0, long: 0, newName: 3 } } as unknown as LensResult;
    const lists = { crutch: ["x"], names: ["y"] };
    const only = new Set(enabledRules([], ["newName"]));
    const on = ruleRows(r, only, lists, "pt-BR", true).find((x) => x.rule === "newName");
    expect(on).toMatchObject({ kind: "on", count: 3 });
    const off = ruleRows(r, only, lists, "pt-BR", false).find((x) => x.rule === "newName");
    expect(off).toMatchObject({ kind: "needsUniverse", count: 0 });
  });
});
