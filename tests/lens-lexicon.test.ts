import { describe, it, expect } from "vitest";
import { LEXICON } from "../src/lens/lexicon";
import type { Lexicon } from "../src/lens/types";

const FIELDS: (keyof Lexicon)[] = ["adverbExceptions", "gerundExceptions", "irForms", "estarForms", "startedForms"];
const LANGS = Object.keys(LEXICON) as (keyof typeof LEXICON)[];

describe("lens lexicon", () => {
  it("has no empty entry or surrounding space, no duplicates, and is NFC and lowercase", () => {
    for (const lang of LANGS) {
      for (const f of FIELDS) {
        const list = LEXICON[lang][f];
        for (const w of list) {
          expect(w.length, `${lang}.${f}`).toBeGreaterThan(0);
          expect(w, `${lang}.${f} ${w}`).toBe(w.trim());
          expect(w, `${lang}.${f} ${w}`).toBe(w.normalize("NFC"));
          expect(w, `${lang}.${f} ${w}`).toBe(w.toLowerCase());
        }
        expect(new Set(list).size, `${lang}.${f} duplicates`).toBe(list.length);
      }
    }
  });

  it("pt adverb exceptions are reachable by the -mente rule", () => {
    for (const w of LEXICON["pt-BR"].adverbExceptions) {
      expect(w.endsWith("mente"), w).toBe(true);
      expect(w.length - "mente".length, w).toBeGreaterThanOrEqual(3);
    }
  });

  it("pt gerund exceptions end in -ndo", () => {
    for (const w of LEXICON["pt-BR"].gerundExceptions) expect(w.endsWith("ndo"), w).toBe(true);
  });

  it("irForms holds no form of poder or dever", () => {
    const bad = /^(pod|pud|dev)/;
    for (const w of LEXICON["pt-BR"].irForms) expect(bad.test(w), w).toBe(false);
    for (const w of ["pode", "podem", "deve", "devem", "poderia", "devia"]) {
      expect(LEXICON["pt-BR"].irForms).not.toContain(w);
    }
    expect(LEXICON["pt-BR"].irForms).toContain("vou");
  });

  it("language fields are filled where the rules need them", () => {
    expect(LEXICON["pt-BR"].estarForms).toContain("estar");
    expect(LEXICON.en.gerundExceptions).toEqual([]);
    expect(LEXICON.en.startedForms).toContain("began");
    expect(LEXICON["pt-BR"].startedForms).toEqual([]);
  });
});

describe("pt -mentar subjunctives", () => {
  it("are exceptions to the adverb rule", () => {
    for (const w of ["cumprimente", "movimente", "fundamente", "fragmente", "segmente", "pavimente", "fermente", "alimente"]) {
      expect(LEXICON["pt-BR"].adverbExceptions, w).toContain(w);
    }
  });
});
