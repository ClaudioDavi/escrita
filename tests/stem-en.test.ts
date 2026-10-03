import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { clearStemCache, stem, type StemProfile } from "../src/core/stem";

function rows(file: string): string[][] {
  return readFileSync(`tests/fixtures/stem/${file}`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t").map((s) => s.trim()).filter((s) => s !== ""));
}

const en = (w: string, p: StemProfile = "word") => stem(w, "en", p);

beforeEach(() => clearStemCache());

describe("english stemmer fixtures", () => {
  const cases: [string, StemProfile][] = [["en-merge.tsv", "word"], ["en-name-merge.tsv", "name"]];
  for (const [file, profile] of cases) {
    const groups = rows(file);
    it(`${file}: has at least ${profile === "word" ? 120 : 30} groups`, () => {
      expect(groups.length).toBeGreaterThanOrEqual(profile === "word" ? 120 : 30);
    });
    it(`${file}: every group shares one key`, () => {
      const bad = groups.filter((g) => new Set(g.map((w) => en(w, profile))).size !== 1)
        .map((g) => g.map((w) => `${w}=${en(w, profile)}`).join(" "));
      expect(bad).toEqual([]);
    });
  }
  const splits: [string, StemProfile][] = [["en-split.tsv", "word"], ["en-name-split.tsv", "name"]];
  for (const [file, profile] of splits) {
    const pairs = rows(file);
    it(`${file}: has at least ${profile === "word" ? 80 : 30} pairs`, () => {
      expect(pairs.length).toBeGreaterThanOrEqual(profile === "word" ? 80 : 30);
    });
    it(`${file}: every pair differs`, () => {
      const bad = pairs.filter(([a, b]) => en(a!, profile) === en(b!, profile))
        .map(([a, b]) => `${a}=${b}=${en(a!, profile)}`);
      expect(bad).toEqual([]);
    });
  }
});

describe("english word profile", () => {
  it("handles Porter2 special words", () => {
    expect(en("skis")).toBe("ski");
    expect(en("skies")).toBe("sky");
    expect(en("dying")).toBe("die");
    expect(en("lying")).toBe("lie");
    expect(en("tying")).toBe("tie");
    for (const w of ["sky", "news", "howe", "atlas", "cosmos", "bias", "andes"]) expect(en(w)).toBe(w);
  });
  it("keeps the R1 exceptions", () => {
    expect(en("generate")).not.toBe(en("general"));
    expect(en("communicate")).not.toBe(en("commune"));
    expect(en("arsenic")).not.toBe(en("arsenal"));
  });
  it("treats y as a consonant at the start and after a vowel", () => {
    expect(en("yes")).toBe("yes");
    expect(en("keys")).toBe(en("key"));
    expect(en("flies")).toBe(en("fly"));
    expect(en("by")).toBe("by");
    expect(en("cry")).toBe("cri");
  });
  it("undoubles and restores e", () => {
    expect(en("stopped")).toBe(en("stop"));
    expect(en("hoped")).toBe(en("hope"));
    expect(en("hoped")).not.toBe(en("hop"));
    expect(en("conflated")).toBe(en("conflate"));
    expect(en("troubled")).toBe(en("trouble"));
  });
  it("strips -ly only on stems of 4 or more letters, and not on exceptions", () => {
    expect(en("quickly")).toBe(en("quick"));
    expect(en("belly")).not.toBe(en("bell"));
    expect(en("only")).not.toBe(en("on"));
    expect(en("family")).not.toBe(en("fam"));
    expect(en("happily")).toBe(en("happy"));
  });
  it("leaves steps 2 to 4 out", () => {
    expect(en("universe")).not.toBe(en("university"));
    expect(en("national")).not.toBe(en("nation"));
  });
  it("leaves contractions whole", () => {
    for (const w of ["don't", "she'd", "I'm", "we'll", "they've", "isn't", "it's", "let's", "o'clock"]) {
      expect(en(w)).toBe(w.toLowerCase());
    }
  });
  it("strips possessives, curly or straight", () => {
    expect(en("dog’s")).toBe(en("dog"));
    expect(en("dogs'")).toBe(en("dog"));
    expect(en("James’s")).toBe(en("james"));
  });
  it("is case-folded and NFC-normalized", () => {
    expect(en("WALKING")).toBe(en("walk"));
    expect(en("cafés")).toBe(en("cafés"));
  });
  it("does not throw on odd tokens", () => {
    for (const w of ["", "a", "s", "'", "''", "-", "--", "123", "1990s", "ed", "ing", "ly", "ies", "sses", "eed", "yy", "y", "e", "---ing", "ß", "日本"]) {
      for (const p of ["word", "name"] as const) {
        expect(() => en(w, p)).not.toThrow();
        expect(typeof en(w, p)).toBe("string");
      }
    }
  });
  it("is stable: a key stemmed again gives the same key", () => {
    for (const g of rows("en-merge.tsv")) {
      const k = en(g[0]!);
      expect(en(k)).toBe(k);
    }
  });
});

describe("english name profile", () => {
  it("never Porter-stems a name", () => {
    expect(en("James", "name")).toBe("james");
    expect(en("Charles", "name")).toBe("charles");
    expect(en("Hopkins", "name")).toBe("hopkin");
    expect(en("Hopper", "name")).toBe("hopper");
    expect(en("Stanley", "name")).toBe("stanley");
  });
  it("handles possessives and a simple plural", () => {
    expect(en("Teo's", "name")).toBe("teo");
    expect(en("Teo’s", "name")).toBe("teo");
    expect(en("Teos", "name")).toBe("teo");
    expect(en("Jones'", "name")).toBe(en("Jones", "name"));
    expect(en("Maxes", "name")).toBe("max");
  });
  it("keeps names that end in s whole", () => {
    expect(en("Ross", "name")).toBe("ross");
    expect(en("Marcus", "name")).toBe("marcus");
    expect(en("Paris", "name")).toBe("paris");
    expect(en("Moses", "name")).not.toBe(en("Mose", "name"));
  });
  it("requires a stem of 3 or more letters for the plural", () => {
    expect(en("Les", "name")).toBe("les");
    expect(en("Jo", "name")).toBe("jo");
  });
  it("leaves contractions and inner apostrophes whole", () => {
    expect(en("O'Brien", "name")).toBe("o'brien");
    expect(en("O'Brien's", "name")).toBe("o'brien");
  });
  it("is memoized per profile", () => {
    expect(en("Teos", "name")).toBe("teo");
    expect(en("Teos", "word")).toBe(en("teos"));
    expect(en("Teos", "name")).toBe("teo");
  });
});
