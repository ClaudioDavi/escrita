import { describe, it, expect } from "vitest";
import { pluralKey, unitKey } from "../src/outline/units";
import { outlineStrings } from "../src/outline/strings";
import { goalsStrings } from "../src/goals/strings";
import type { PieceUnit } from "../src/core/piece";

const render = (lang: string, key: string, n: number) =>
  outlineStrings[lang][key].replace("{n}", String(n));

const units: PieceUnit[] = ["words", "characters", "characters-no-spaces"];

describe("outline unit amounts", () => {
  it("picks .one only for exactly one", () => {
    expect(pluralKey("outline.beats", 1)).toBe("outline.beats.one");
    expect(pluralKey("outline.beats", 0)).toBe("outline.beats.other");
    expect(pluralKey("outline.beats", 2)).toBe("outline.beats.other");
    expect(pluralKey("outline.beats", 1.2)).toBe("outline.beats.one");
  });

  it("has .one and .other strings for every unit in every language", () => {
    for (const lang of Object.keys(outlineStrings)) {
      for (const u of units) {
        for (const form of ["one", "other"]) {
          expect(outlineStrings[lang][`${unitKey(u)}.${form}`], `${lang} ${u} ${form}`).toBeTruthy();
        }
      }
    }
  });

  it("uses the singular for one", () => {
    const one = (lang: string, u: PieceUnit) => render(lang, pluralKey(unitKey(u), 1), 1);
    expect(one("en", "words")).toBe("1 word");
    expect(one("en", "characters")).toBe("1 character");
    expect(one("en", "characters-no-spaces")).toBe("1 character (no spaces)");
    expect(one("pt-BR", "words")).toBe("1 palavra");
    expect(one("pt-BR", "characters")).toBe("1 caractere");
    expect(one("pt-BR", "characters-no-spaces")).toBe("1 caractere sem espaços");
    expect(render("en", pluralKey(unitKey("characters"), 2), 2)).toBe("2 characters");
  });

  it("words the units the same way as goals (status bar, progress modal)", () => {
    const goalsBase: Record<PieceUnit, string> = {
      words: "goals.words",
      characters: "goals.chars",
      "characters-no-spaces": "goals.charsNoSpaces",
    };
    for (const lang of Object.keys(outlineStrings)) {
      for (const u of units) {
        for (const form of ["one", "other"]) {
          expect(outlineStrings[lang][`${unitKey(u)}.${form}`], `${lang} ${u} ${form}`)
            .toBe(goalsStrings[lang][`${goalsBase[u]}.${form}`]);
        }
      }
    }
  });
});
