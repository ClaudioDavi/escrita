import { describe, it, expect } from "vitest";
import { coreStrings } from "../src/strings";

const KEYS = [
  "settings.stages",
  "settings.stages.desc",
  "settings.stages.duplicate",
  "settings.stages.words",
  "settings.stages.color",
  "settings.stages.noColor",
  "settings.stages.clear",
  "settings.otherStatusColors",
  "settings.otherStatusColors.desc",
  "settings.homeNoteHeading",
  "settings.homeNote",
  "settings.homeNote.desc",
  "settings.openHomeOnStartup",
  "settings.openHomeOnStartup.desc",
];

describe("stages settings strings", () => {
  for (const lang of ["en", "pt-BR"]) {
    it(`${lang} has every key`, () => {
      for (const k of KEYS) expect([k, coreStrings[lang][k]]).toEqual([k, expect.any(String)]);
    });
  }
  it("the duplicate warning names the word, the stages and the winner", () => {
    for (const lang of ["en", "pt-BR"]) {
      const s = coreStrings[lang]["settings.stages.duplicate"];
      for (const v of ["{word}", "{stages}", "{first}"]) expect(s).toContain(v);
    }
  });
  it("the home note description says it replaces the restored tab", () => {
    expect(coreStrings.en["settings.openHomeOnStartup.desc"]).toMatch(/restored/);
    expect(coreStrings["pt-BR"]["settings.openHomeOnStartup.desc"]).toMatch(/restaurada/);
  });
});
