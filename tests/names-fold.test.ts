import { describe, expect, it } from "vitest";
import { foldName } from "../src/core/names";

describe("foldName (Q23)", () => {
  it("folds accents, so accented and plain names are one form", () => {
    for (const [a, b] of [
      ["Inês", "Ines"], ["Tomás", "Tomas"], ["Thaís", "Thais"], ["Andrés", "Andres"], ["Mário", "Mario"],
    ]) expect(foldName(a)).toBe(foldName(b));
    expect(foldName("Inês")).toBe("ines");
  });

  it("lowercases, trims and maps the curly apostrophe", () => {
    expect(foldName("  Teo’s ")).toBe("teo's");
    expect(foldName("JOÃO")).toBe("joao");
  });

  it("gives the same result for composed and decomposed input", () => {
    expect(foldName("Inês")).toBe(foldName("Inês"));
    expect(foldName("Inês")).toBe("ines");
  });

  it("folds titles too", () => {
    expect(foldName("Irmã")).toBe("irma");
    expect(foldName("Vó")).toBe(foldName("Vô"));
  });

  it("keeps letters that are not accented forms", () => {
    expect(foldName("Maria-José")).toBe("maria-jose");
    expect(foldName("")).toBe("");
  });
});
