import { describe, it, expect } from "vitest";
import { coreStrings } from "../src/strings";
import { lensStrings } from "../src/lens/strings";
import { RULES } from "../src/lens/types";

const KEYS = [
  "settings.lens", "settings.lens.desc", "settings.lens.language", "settings.lens.language.desc",
  "settings.lens.language.auto", "settings.lens.language.pt", "settings.lens.language.en",
  "settings.lens.lists", "settings.lens.lists.desc", "settings.lens.lists.create",
  "settings.lens.echoWindow", "settings.lens.echoWindow.desc", "settings.lens.longSentence",
  "settings.lens.longSentence.desc", "settings.lens.words", "settings.lens.skipQuotes",
  "settings.lens.skipQuotes.desc", "settings.lens.rules", "settings.lens.measures",
  "settings.lens.showDialogue", "settings.lens.showReadability", "settings.lens.showReadability.desc",
  ...RULES.filter((r) => r !== "adverb").map((r) => `settings.lens.rule.${r}.desc`),
  "settings.lens.rule.adverb.pt-BR.desc", "settings.lens.rule.adverb.en.desc", "settings.lens.rule.adverb.none.desc",
  "settings.lens.rule.gerund.en.desc",
];

describe("lens settings strings", () => {
  for (const lang of ["en", "pt-BR"]) {
    it(`${lang} has every key, and a name for every rule`, () => {
      for (const k of KEYS) expect([k, coreStrings[lang][k]]).toEqual([k, expect.any(String)]);
      for (const r of RULES) expect(lensStrings[lang][`lens.rule.${r}`]).toEqual(expect.any(String));
    });
  }
});
