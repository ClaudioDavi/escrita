import { describe, expect, it } from "vitest";
import { clearSyllableMemo, syllables } from "../src/lens/syllables";
import { segment } from "../src/core/markdown";
import { sentences } from "../src/core/sentences";

describe("syllables memo", () => {
  it("returns the same counts on repeat and after a clear", () => {
    const words = ["história", "série", "voo", "ainda", "Beautiful", "didn't", "co-operate", "123", "—"];
    const langs = ["pt-BR", "en"] as const;
    const first = langs.map((l) => words.map((w) => syllables(w, l)));
    const again = langs.map((l) => words.map((w) => syllables(w, l)));
    clearSyllableMemo();
    const cold = langs.map((l) => words.map((w) => syllables(w, l)));
    expect(again).toEqual(first);
    expect(cold).toEqual(first);
    expect(syllables("123", "en")).toBe(0);
    expect(syllables("história", "pt-BR")).toBe(4);
  });
  it("keeps languages apart and stays correct past the bound", () => {
    expect(syllables("area", "en")).toBe(3);
    expect(syllables("area", "pt-BR")).toBe(3);
    for (let i = 0; i < 50050; i++) syllables("w" + i + "a", "en");
    expect(syllables("beautiful", "en")).toBe(3);
  });
});

describe("sentences whitespace by char code", () => {
  it("treats unicode spaces like \\s", () => {
    for (const sp of [" ", " ", " ", "　", "\t"]) {
      const text = `Ela foi.${sp}Ele ficou.`;
      const md = segment(text);
      expect(sentences(text, md, "pt").length).toBe(2);
    }
    const t = "Fim.​Ainda";
    expect(sentences(t, segment(t), "pt").length).toBe(1);
  });
});
