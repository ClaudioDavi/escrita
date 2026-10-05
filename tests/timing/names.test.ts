import { describe, expect, it } from "vitest";
import { compileTerms, findNames, type NameSource, type TermTable } from "../../src/core/names";

const src = (id: string, name: string, o: Partial<NameSource> = {}): NameSource => ({
  id, name, aliases: [], person: true, firstName: true, caseSensitive: false, ignore: [], ...o,
});
const pt = (s: NameSource[], extraTitles: string[] = []): TermTable => compileTerms(s, { lang: "pt", extraTitles });

describe("speed", () => {
  const words = ["o", "a", "casa", "rio", "vento", "dia", "noite", "disse", "foi", "viu", "mar", "terra", "ele", "ela"];
  const names = Array.from({ length: 300 }, (_, i) => src(`e${i}`, `Nome${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) | 0))} Sobrenome`));
  const table = pt(names);
  const note = Array.from({ length: 10000 }, (_, i) => (i % 97 === 0 ? "Nomeab" : words[i % words.length])).join(" ");
  it("300 entries over 10,000 words: under 100 ms (CI ceiling)", () => {
    findNames(note, table);
    const t0 = performance.now();
    findNames(note, table);
    expect(performance.now() - t0).toBeLessThan(100);
  });
  it.skipIf(!!process.env.CI)("local budget: under 20 ms (median of the fastest half, to ride out a loaded machine)", () => {
    const runs: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      findNames(note, table);
      runs.push(performance.now() - t0);
    }
    runs.sort((a, b) => a - b);
    expect(runs[3]).toBeLessThan(20); // median of the fastest 7
  });
});
