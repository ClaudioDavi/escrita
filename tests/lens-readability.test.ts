import { describe, expect, it } from "vitest";
import { BANDS, bandOf, readability } from "../src/lens/readability";

describe("readability formulas", () => {
  it("computes the pt-BR (Martins et al.) value", () => {
    // ASL 10, ASW 2: 248.835 - 10.15 - 169.2 = 69.485
    const r = readability(200, 20, 400, "pt-BR")!;
    expect(r.asl).toBe(10);
    expect(r.asw).toBe(2);
    expect(r.raw).toBeCloseTo(69.485, 6);
    expect(r.score).toBeCloseTo(69.485, 6);
    expect(r.band).toBe("easy");
  });
  it("computes the en (Flesch) value", () => {
    // ASL 10, ASW 1.5: 206.835 - 10.15 - 126.9 = 69.785
    const r = readability(200, 20, 300, "en")!;
    expect(r.raw).toBeCloseTo(69.785, 6);
    expect(r.band).toBe("fairlyEasy"); // shown as 70, the band the shown number is in
  });
});

describe("readability bands", () => {
  it("has four pt-BR bands and seven en bands, easiest first", () => {
    expect(BANDS["pt-BR"].map((b) => b.min)).toEqual([75, 50, 25, 0]);
    expect(BANDS.en.map((b) => b.min)).toEqual([90, 80, 70, 60, 50, 30, 0]);
  });
  // With 100 words, 10 sentences (ASL 10) the score is base - 10.15 - 84.6 * ASW.
  // Choose the syllable count that lands exactly on a band's min.
  function atScore(lang: "pt-BR" | "en", target: number) {
    const base = lang === "pt-BR" ? 248.835 : 206.835;
    const asw = (base - 10.15 - target) / 84.6;
    return readability(100, 10, asw * 100, lang)!;
  }
  it("puts a score equal to a band's min in that band", () => {
    expect(atScore("pt-BR", 75).band).toBe("veryEasy");
    expect(atScore("pt-BR", 50).band).toBe("easy");
    expect(atScore("pt-BR", 25).band).toBe("hard");
    expect(atScore("en", 90).band).toBe("veryEasy");
    expect(atScore("en", 60).band).toBe("standard");
    expect(atScore("en", 30).band).toBe("hard");
  });
  it("puts a score just under a min in the next band down", () => {
    expect(atScore("pt-BR", 74.4).band).toBe("easy");
    expect(atScore("en", 79.4).band).toBe("fairlyEasy");
    expect(atScore("en", 29.4).band).toBe("veryHard");
  });
});

describe("readability clamping and thresholds", () => {
  it("clamps the shown score to 0-100 and keeps the raw value", () => {
    const easy = readability(100, 50, 100, "en")!;   // ASL 2, ASW 1
    expect(easy.raw).toBeGreaterThan(100);
    expect(easy.score).toBe(100);
    const hard = readability(100, 3, 400, "en")!;    // ASL 33, ASW 4
    expect(hard.raw).toBeLessThan(0);
    expect(hard.score).toBe(0);
    expect(hard.band).toBe("veryHard");
  });
  it("is null under 100 words or 3 sentences", () => {
    expect(readability(99, 10, 150, "pt-BR")).toBeNull();
    expect(readability(200, 2, 300, "en")).toBeNull();
    expect(readability(0, 0, 0, "en")).toBeNull();
    expect(readability(100, 3, 150, "en")).not.toBeNull();
  });
});

describe("band agrees with the shown (rounded) score", () => {
  it("74.6 shows 75 and is in the 75 band", () => {
    expect(Math.round(74.6)).toBe(75);
    expect(bandOf(74.6, "pt-BR")).toBe("veryEasy");
    expect(atScoreBand(74.6)).toBe("veryEasy");
    expect(bandOf(74.4, "pt-BR")).toBe("easy");
    expect(bandOf(89.5, "en")).toBe("veryEasy");
    expect(bandOf(29.6, "en")).toBe("hard");
  });
});

function atScoreBand(target: number): string {
  const asw = (248.835 - 10.15 - target) / 84.6;
  return readability(100, 10, asw * 100, "pt-BR")!.band;
}
