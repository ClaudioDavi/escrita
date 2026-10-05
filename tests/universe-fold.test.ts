import { describe, expect, it } from "vitest";
import { foldName } from "../src/core/names";
import { foldText } from "../src/universe/entries";

describe("one name fold (IMPROVEMENTS 10)", () => {
  it("foldText is foldName", () => {
    expect(foldText).toBe(foldName);
  });
  it("folds case and accents", () => {
    for (const [a, b] of [["Mãe", "mae"], ["Inês", "ines"], ["ÉLODIE", "elodie"], ["  Ana ", "ana"]]) expect(foldText(a)).toBe(b);
  });
});
