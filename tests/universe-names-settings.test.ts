import { describe, it, expect } from "vitest";
import { builtinTitlesText } from "../src/universe/names-settings";
import { NAME_TITLES } from "../src/core/name-titles";

const also = (l: string) => `(+ ${l})`;

describe("builtinTitlesText", () => {
  it("names the Portuguese table, then the English one, for pt-BR", () => {
    const s = builtinTitlesText("pt-BR", "en", also);
    expect(s.startsWith("dona, dom, seu")).toBe(true);
    expect(s).toContain("(+ mr, mrs, ms");
  });
  it("names only the English table for en", () => {
    const s = builtinTitlesText("en", "pt-BR", also);
    expect(s).toBe(NAME_TITLES.en.map((x) => x.toLowerCase()).join(", "));
  });
  it("follows the Obsidian locale on auto, and names both when it is neither", () => {
    expect(builtinTitlesText("auto", "en-GB", also)).not.toContain("dona");
    expect(builtinTitlesText("auto", "pt_BR", also)).toContain("dona");
    expect(builtinTitlesText("auto", "fr", also)).toContain("dona");
  });
});
