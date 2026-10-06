import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { nameRuns, namesMask } from "../src/core/name-runs";
import { NAME_TITLES } from "../src/core/name-titles";
import { foldName } from "../src/core/names";
import { sentences } from "../src/core/sentences";
import { tokens } from "../src/core/tokens";
import { analyze, type AnalyzeOptions } from "../src/lens/analyze";
import { NEW_NAME_IN_NOTE, newNames } from "../src/lens/rules-names";
import { RULES, type RuleId } from "../src/lens/types";

const dir = "tests/fixtures/universe-names/";
const expected = JSON.parse(readFileSync(dir + "expected.json", "utf8"));
const contos = readdirSync(dir + "Contos").map((f) => ({ f, text: readFileSync(dir + "Contos/" + f, "utf8") }));

const KNOWN = new Set(
  ["Beatriz Lemos", "Bia", "Beatriz", "Teodoro Ramos", "Teo", "Teodoro", "Porto Alto", "Portinho", "Serra Azul", ...NAME_TITLES.pt]
    .map(foldName),
);

function works(): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of contos) {
    const md = segment(c.text);
    const mask = namesMask(md);
    const keys = new Set(nameRuns(tokens(mask), sentences(mask, md, "pt"), mask, "pt").map((r) => r.key));
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function marked(notNames: string[]): { text: string; works: number; countInNote?: number }[] {
  const w = works();
  const byText = new Map<string, { works: number; count: number }>();
  for (const c of contos) {
    const o: AnalyzeOptions = {
      lang: "pt-BR", rules: new Set<RuleId>([...RULES, "newName"]), echoWindow: 40, longSentence: 45,
      lists: { crutch: [], names: [], ignore: [] }, skipQuotes: false, quoteStyle: "curly", paragraphStyle: "blank",
      newName: { notNames, query: { known: (t) => KNOWN.has(foldName(t)), works: (t) => w.get(foldName(t)) ?? 0 } },
    };
    const r = analyze(segment(c.text), o);
    const per = new Map<string, number>();
    for (const m of r.matches.filter((x) => x.rule === "newName")) per.set(m.text, (per.get(m.text) ?? 0) + 1);
    for (const [text, n] of per) {
      const e = byText.get(text) ?? { works: w.get(foldName(text)) ?? 0, count: 0 };
      e.count = Math.max(e.count, n);
      byText.set(text, e);
    }
  }
  return [...byText].sort(([a], [b]) => a.localeCompare(b)).map(([text, e]) =>
    e.works < 2 ? { text, works: e.works, countInNote: e.count } : { text, works: e.works });
}

describe("lens names rule on the universe-names fixture", () => {
  it("marks the expected names without 'Not names'", () => {
    expect(marked([])).toEqual(expected.names.without);
  });
  it("respects 'Not names'", () => {
    expect(marked(["Deus"])).toEqual(expected.names.with);
  });
  it("marks nothing without a query", () => {
    const md = segment(contos[0].text);
    const mask = namesMask(md);
    const o = { lang: "pt-BR" as const, lists: { crutch: [], names: [], ignore: [] } };
    expect(newNames(tokens(mask), sentences(mask, md, "pt"), mask, o)).toEqual([]);
  });
  it("counts in the note and honors the lens names list", () => {
    expect(NEW_NAME_IN_NOTE).toBe(5);
    const base = { lang: "en" as const, lists: { crutch: [], names: [] as string[], ignore: [] } };
    const nn = { notNames: [], query: { known: () => false, works: () => 0 } };
    const run = (text: string, names: string[] = []) => {
      const md = segment(text);
      const m = namesMask(md);
      return newNames(tokens(m), sentences(m, md, "en"), m, { ...base, lists: { ...base.lists, names }, newName: nn });
    };
    expect(run("Vimos Quirino. " + "Ele viu Quirino. ".repeat(4))).toEqual([]);
    expect(run("Vimos Quirino. " + "Ele viu Quirino. ".repeat(5)).length).toBe(5);
    expect(run("Vimos Quirino. " + "Ele viu Quirino. ".repeat(5), ["quirino"])).toEqual([]);
  });
});
