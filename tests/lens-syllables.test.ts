import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { syllables } from "../src/lens/syllables";

function rows(file: string): [string, number][] {
  return readFileSync(`tests/fixtures/syllables/${file}`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => {
      const [w, n] = l.split("\t");
      return [w, Number(n)] as [string, number];
    });
}

describe("syllables pt-BR", () => {
  const fixture = rows("pt-BR.tsv");
  it("has a fixture to read", () => {
    expect(fixture.length).toBeGreaterThanOrEqual(300);
  });
  it("matches every fixture row", () => {
    const wrong = fixture.filter(([w, n]) => syllables(w, "pt-BR") !== n)
      .map(([w, n]) => `${w}: want ${n}, got ${syllables(w, "pt-BR")}`);
    expect(wrong).toEqual([]);
  });
  it("pins the rising sequences at 2 (Q27)", () => {
    expect(syllables("história", "pt-BR")).toBe(4);
    expect(syllables("série", "pt-BR")).toBe(3);
  });
  it("handles case, hyphens and punctuation", () => {
    expect(syllables("Guilherme", "pt-BR")).toBe(3);
    expect(syllables("guarda-chuva", "pt-BR")).toBe(4);
    expect(syllables("olhou-me", "pt-BR")).toBe(3);
  });
  it("returns 0 without letters and 1 without vowels", () => {
    expect(syllables("123", "pt-BR")).toBe(0);
    expect(syllables("—", "pt-BR")).toBe(0);
    expect(syllables("", "pt-BR")).toBe(0);
    expect(syllables("tv", "pt-BR")).toBe(1);
  });
});

describe("syllables en", () => {
  const fixture = rows("en.tsv");
  it("has a fixture to read", () => {
    expect(fixture.length).toBeGreaterThanOrEqual(600);
  });
  it("is at least 95% exact on the fixture", () => {
    const wrong = fixture.filter(([w, n]) => syllables(w, "en") !== n);
    expect(1 - wrong.length / fixture.length).toBeGreaterThanOrEqual(0.95);
  });
  it("is exact on the irregular words", () => {
    const irregular: [string, number][] = [
      ["quiet", 2], ["science", 2], ["audience", 3], ["people", 2], ["something", 2],
      ["business", 2], ["colonel", 2], ["isle", 1], ["aisle", 1], ["rhythm", 2],
      ["every", 2], ["hour", 1], ["fire", 1], ["being", 2], ["poem", 2], ["create", 2],
    ];
    for (const [w, n] of irregular) expect(syllables(w, "en"), w).toBe(n);
  });
  it("handles silent e, -ed, -es and -le", () => {
    expect(syllables("make", "en")).toBe(1);
    expect(syllables("walked", "en")).toBe(1);
    expect(syllables("wanted", "en")).toBe(2);
    expect(syllables("boxes", "en")).toBe(2);
    expect(syllables("hopes", "en")).toBe(1);
    expect(syllables("table", "en")).toBe(2);
    expect(syllables("settled", "en")).toBe(2);
  });
  it("handles case, contractions, hyphens and apostrophes", () => {
    expect(syllables("The", "en")).toBe(1);
    expect(syllables("don't", "en")).toBe(1);
    expect(syllables("didn't", "en")).toBe(2);
    expect(syllables("James's", "en")).toBe(1);
    expect(syllables("well-known", "en")).toBe(2);
  });
  it("returns 0 without letters", () => {
    expect(syllables("42", "en")).toBe(0);
    expect(syllables("...", "en")).toBe(0);
  });
});
