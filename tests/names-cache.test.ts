import { beforeEach, describe, expect, it } from "vitest";
import { clearNamesCaches, compileTerms, findNames, namesCacheStats, type NameSource } from "../src/core/names";

const src = (id: string, name: string): NameSource => ({
  id, name, aliases: [], person: true, firstName: true, caseSensitive: false, ignore: [],
});

describe("names caches (IMPROVEMENTS 22)", () => {
  beforeEach(() => clearNamesCaches());

  it("gives the same output cold and warm", () => {
    const table = compileTerms([src("a.md", "Inês Prado")], { lang: "pt", extraTitles: [] });
    const text = "Ines saw Inês Prado. Prado left. Ines again.";
    const cold = findNames(text, table);
    expect(namesCacheStats().fold).toBeGreaterThan(0);
    expect(findNames(text, table)).toEqual(cold);
    expect(cold.length).toBe(3);
  });

  it("keeps languages apart", () => {
    const text = "Running runs";
    const pt = compileTerms([src("a.md", "Running")], { lang: "pt", extraTitles: [] });
    const en = compileTerms([src("a.md", "Running")], { lang: "en", extraTitles: [] });
    const a = findNames(text, pt);
    const b = findNames(text, en);
    expect(findNames(text, pt)).toEqual(a);
    expect(findNames(text, en)).toEqual(b);
  });

  it("stays bounded under many distinct words", () => {
    const table = compileTerms([src("a.md", "Marta Lins")], { lang: "en", extraTitles: [] });
    const words = Array.from({ length: 130_000 }, (_, i) => "w" + i.toString(36)).join(" ");
    expect(findNames(words + " Marta", table).length).toBe(1);
    const s = namesCacheStats();
    expect(s.fold).toBeLessThanOrEqual(50_000);
    expect(s.keys).toBeLessThanOrEqual(2 * 50_000);
  });
});
