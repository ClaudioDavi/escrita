import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { clearStemCache, stem, type StemProfile } from "../src/core/stem";
import { splitClitic } from "../src/core/stem/pt";

function rows(file: string): string[][] {
  return readFileSync(`tests/fixtures/stem/${file}`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "" && !l.startsWith("#"))
    .map((l) => l.split("\t").map((s) => s.trim()).filter((s) => s !== ""));
}

const pt = (w: string, p: StemProfile = "word") => stem(w, "pt", p);

beforeEach(() => clearStemCache());

describe("portuguese stemmer fixtures", () => {
  const merges: [string, StemProfile, number][] = [["pt-merge.tsv", "word", 150], ["pt-name-merge.tsv", "name", 30]];
  for (const [file, profile, min] of merges) {
    const groups = rows(file);
    it(`${file}: has at least ${min} groups`, () => {
      expect(groups.length).toBeGreaterThanOrEqual(min);
    });
    it(`${file}: every group shares one key`, () => {
      const bad = groups.filter((g) => new Set(g.map((w) => pt(w, profile))).size !== 1)
        .map((g) => g.map((w) => `${w}=${pt(w, profile)}`).join(" "));
      expect(bad).toEqual([]);
    });
  }
  const splits: [string, StemProfile, number][] = [["pt-split.tsv", "word", 100], ["pt-name-split.tsv", "name", 30]];
  for (const [file, profile, min] of splits) {
    const pairs = rows(file);
    it(`${file}: has at least ${min} pairs`, () => {
      expect(pairs.length).toBeGreaterThanOrEqual(min);
    });
    it(`${file}: every pair differs`, () => {
      const bad = pairs.filter(([a, b]) => pt(a!, profile) === pt(b!, profile))
        .map(([a, b]) => `${a} | ${b} = ${pt(a!, profile)}`);
      expect(bad).toEqual([]);
    });
  }
});

describe("portuguese stemmer behaviour", () => {
  it("is idempotent on the name profile for every fixture group", () => {
    for (const g of rows("pt-name-merge.tsv")) {
      for (const w of g) expect(pt(pt(w, "name"), "name")).toBe(pt(w, "name"));
    }
  });

  it("is idempotent on the word profile where the key is a bare stem", () => {
    // Documented: a word key is a stem, not a word; stemming it again is only
    // guaranteed for plain stems like these (no verb ending left to cut).
    for (const w of ["olh", "gat", "cas", "amig", "livr", "bonit", "flor", "luz", "mulh", "frances"]) {
      expect(pt(pt(w))).toBe(pt(w));
    }
  });

  it("does not throw on empty, one-letter, digit or hyphen-only tokens", () => {
    for (const w of ["", "a", "é", "7", "2024", "-", "--", "-a", "a-", "-me", "1-2", "ç", "'"]) {
      for (const p of ["word", "name"] as const) expect(() => pt(w, p)).not.toThrow();
    }
    expect(pt("")).toBe("");
    expect(pt("2024")).toBe("2024");
  });

  it("reads NFD and uppercase input like NFC lowercase", () => {
    const nfd = "Não".normalize("NFD");
    expect(pt(nfd)).toBe(pt("não"));
    expect(pt("JOÃOZINHO".normalize("NFD"), "name")).toBe(pt("joãozinho", "name"));
    expect(pt("Maria", "name")).toBe(pt("MARIA", "name"));
  });

  it("keeps the diminutive spelling rules", () => {
    expect(pt("amiguinho")).toBe(pt("amigo"));
    expect(pt("banquinho")).toBe(pt("banco"));
    expect(pt("cafezinho")).toBe(pt("café"));
    expect(pt("pássaro")).toBe(pt("passarinho"));
  });

  it("leaves the listed -inho, -ão and -ona words whole", () => {
    for (const w of ["caminho", "vizinho", "linha", "cozinha", "rainha", "farinha", "marinho", "pinho", "vinho", "ninho", "espinho", "carinho", "padrinho", "madrinha", "focinho", "moinho", "sardinha", "bainha", "galinha", "campainha", "andorinha", "adivinho", "mesquinho"]) {
      expect(pt(w).length).toBeGreaterThanOrEqual(3);
      expect(pt(w)).not.toBe(pt(w.replace(/inh[oa]$/, "")));
    }
    for (const w of ["mão", "pão", "chão", "irmão", "coração", "não", "então", "cão", "grão", "são", "dona", "zona", "poltrona"]) {
      expect(pt(w).length).toBeGreaterThanOrEqual(2);
    }
    expect(pt("coração")).toBe(pt("corações"));
    expect(pt("dona")).not.toBe(pt("do"));
  });

  it("does not run a noun-suffix step (Q2)", () => {
    expect(pt("casamento")).not.toBe(pt("casa"));
    expect(pt("mentira")).not.toBe(pt("mente"));
    expect(pt("felicidade")).toBe(pt("felicidades"));
  });

  it("treats -mente as an adverb only with 3 letters before it", () => {
    expect(pt("mente")).toBe("mente");
    expect(pt("semente")).not.toBe(pt("sem"));
    expect(pt("rapidamente")).toBe(pt("rápido"));
  });

  it("name profile: no feminine, no vowel or accent removal", () => {
    expect(pt("Mariano", "name")).not.toBe(pt("Mariana", "name"));
    expect(pt("Mário", "name")).toBe("mário");
    expect(pt("Joãozinho", "name")).toBe("joão");
  });
});

describe("splitClitic", () => {
  it("splits the last hyphen when a known clitic follows", () => {
    expect(splitClitic("dizendo-lhe")).toEqual({ base: "dizendo", clitic: "lhe" });
    expect(splitClitic("olhando-a")).toEqual({ base: "olhando", clitic: "a" });
    expect(splitClitic("olhou-me")).toEqual({ base: "olhou", clitic: "me" });
    expect(splitClitic("dizê-lo")).toEqual({ base: "dizê", clitic: "lo" });
  });

  it("leaves compounds and other hyphens alone", () => {
    expect(splitClitic("guarda-chuva")).toEqual({ base: "guarda-chuva", clitic: null });
    expect(splitClitic("couve-flor")).toEqual({ base: "couve-flor", clitic: null });
    expect(splitClitic("olhou")).toEqual({ base: "olhou", clitic: null });
  });

  it("looks only at the last part: dir-se-ia has no clitic", () => {
    expect(splitClitic("dir-se-ia")).toEqual({ base: "dir-se-ia", clitic: null });
    expect(splitClitic("dir-se-á-lo")).toEqual({ base: "dir-se-á", clitic: "lo" });
  });

  it("is safe on degenerate input", () => {
    for (const w of ["", "-", "--", "-me", "me-", "-a-", "a-a"]) {
      expect(() => splitClitic(w)).not.toThrow();
    }
    expect(splitClitic("-me")).toEqual({ base: "-me", clitic: null });
    expect(splitClitic("-")).toEqual({ base: "-", clitic: null });
  });
});
