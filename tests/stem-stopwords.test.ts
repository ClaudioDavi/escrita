import { describe, expect, it } from "vitest";
import { isStopWord, stopWordCount } from "../src/core/stem/stopwords";

describe("stop words", () => {
  it("list sizes stay in the 150-250 range", () => {
    for (const lang of ["pt", "en"] as const) {
      expect(stopWordCount(lang)).toBeGreaterThanOrEqual(150);
      expect(stopWordCount(lang)).toBeLessThanOrEqual(250);
    }
  });

  it("matches common function words", () => {
    for (const w of ["de", "a", "do", "da", "no", "na", "pelo", "num", "dum", "que", "está"]) {
      expect(isStopWord(w, "pt")).toBe(true);
    }
    for (const w of ["the", "of", "and", "was", "with", "they"]) {
      expect(isStopWord(w, "en")).toBe(true);
    }
  });

  it("normalizes: NFD and capitals match", () => {
    expect(isStopWord("não".normalize("NFD"), "pt")).toBe(true);
    expect(isStopWord("Não", "pt")).toBe(true);
    expect(isStopWord("THE", "en")).toBe(true);
  });

  it("does not fold accents: está is not esta-as-noun and não is not nao", () => {
    expect(isStopWord("nao", "pt")).toBe(false);
  });

  it("said-verbs are stop words", () => {
    expect(isStopWord("disse", "pt")).toBe(true);
    expect(isStopWord("disseram", "pt")).toBe(true);
    expect(isStopWord("said", "en")).toBe(true);
    expect(isStopWord("says", "en")).toBe(true);
  });

  it("English contractions match whole, with either apostrophe", () => {
    expect(isStopWord("don't", "en")).toBe(true);
    expect(isStopWord("don’t", "en")).toBe(true);
    expect(isStopWord("she'd", "en")).toBe(true);
  });

  it("is per language", () => {
    expect(isStopWord("the", "pt")).toBe(false);
    expect(isStopWord("disse", "en")).toBe(false);
  });

  it("content words are not stop words", () => {
    expect(isStopWord("casa", "pt")).toBe(false);
    expect(isStopWord("olhou", "pt")).toBe(false);
    expect(isStopWord("house", "en")).toBe(false);
    expect(isStopWord("looked", "en")).toBe(false);
  });
});
