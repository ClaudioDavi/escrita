import { describe, expect, it } from "vitest";
import { lensLang } from "../src/lens/lang";

// Q8: the raw Obsidian locale decides "auto". i18n's lang() falls back to "en" for a locale
// Escrita has no strings for, so passing it would turn Spanish or French into English.
describe("lensLang with the raw locale", () => {
  it("gives no language for a locale without lens support", () => {
    for (const l of ["es", "fr", "de", "ja", "zh-cn", "ru"]) {
      expect(lensLang("auto", l)).toBeNull();
    }
  });
  it("still maps pt and en variants", () => {
    expect(lensLang("auto", "pt-br")).toBe("pt-BR");
    expect(lensLang("auto", "en-gb")).toBe("en");
  });
  it("lets an explicit setting win over any locale", () => {
    expect(lensLang("en", "es")).toBe("en");
  });
});
