import { describe, expect, it } from "vitest";
import { screenplayPdf } from "../src/core/screenplay-pdf";
import { screenplayPreset } from "../src/core/screenplay-presets";
import { action, cue, dialogue, scene, script, transition } from "./screenplay-helpers";

const labels = { screenplayMore: "(MORE)", screenplayContinued: "(CONT'D)", screenplaySceneNumbers: false };
const LETTER = screenplayPreset("letter", labels);
const latin1 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return s;
};

describe("screenplayPdf", () => {
  const title = { title: "Café com Leite", author: "Ana Souza", credit: "Written by", draftDate: "Draft 2", contact: ["ana@example.com"] };

  it("counts the title page and the body pages", () => {
    const body = Array.from({ length: 60 }, (_, i) => action(`line ${i}`)); // 119 rows: 3 pages
    const r = screenplayPdf(script(...body), title, LETTER);
    expect(r.pages).toBe(4);
    expect(latin1(r.bytes)).toContain("/Count 4");
    expect(r.unsupported).toEqual([]);
  });

  it("numbers the body pages from the second one, top right, and leaves the title page bare", () => {
    const body = Array.from({ length: 60 }, (_, i) => action(`line ${i}`));
    const s = latin1(screenplayPdf(script(...body), title, LETTER).bytes);
    expect(s).not.toContain("(1.)");
    expect(s).toContain("(2.)");
    expect(s).toContain("(3.)");
    // right edge of the action column: 75 - 2 characters = column 73 = 525.6 points; 36pt down + baseline
    expect(s).toContain("525.6 747 Td (2.) Tj");
  });

  it("puts the title page first, in capitals and underlined, with the author and contact", () => {
    const s = latin1(screenplayPdf(script(action("x")), title, LETTER).bytes);
    expect(s.indexOf("(CAF\\311 COM LEITE)")).toBeGreaterThan(-1);
    expect(s.indexOf("(Ana Souza)")).toBeGreaterThan(s.indexOf("(Written by)"));
    expect(s).toContain("(ana@example.com)");
    expect(s.indexOf("CAF")).toBeLessThan(s.indexOf("(x)"));
  });

  it("prints a page with the body at the left margin and 12-point baselines", () => {
    const s = latin1(screenplayPdf(script(scene("int. casa - dia"), action("Ela entra.")), title, LETTER).bytes);
    // column 15 = 108 points; row 0 baseline = 72 + 9 from the top = 711 up from the bottom
    expect(s).toContain("108 711 Td (INT. CASA - DIA) Tj");
    expect(s).toContain("108 687 Td (Ela entra.) Tj");
  });

  it("encodes Portuguese and reports what cannot be printed with its note line", () => {
    const els = [cue("JOÃO"), dialogue("Não é “nada” — ou 😀?")];
    const r = screenplayPdf(script(...els), title, LETTER);
    const s = latin1(r.bytes);
    expect(s).toContain("(JO\\303O)");
    expect(s).toContain("(N\\343o \\351 \\223nada\\224 \\227 ou ??)");
    // the emoji is one code point; it is reported once with the dialogue's line
    expect(r.unsupported).toEqual([{ char: "😀", line: els[1].line }]);
  });

  it("draws bold, italic and underline runs with their faces", () => {
    const s = latin1(
      screenplayPdf(script(action([{ text: "a ", bold: true }, { text: "b ", italic: true }, { text: "c", underline: true }])), { title: "T" }, LETTER).bytes,
    );
    expect(s).toMatch(/\/F2 12 Tf [\d.]+ [\d.]+ Td \(a \) Tj/);
    expect(s).toMatch(/\/F3 12 Tf [\d.]+ [\d.]+ Td \(b \) Tj/);
    expect(s).toMatch(/q 0.6 w [\d.]+ [\d.]+ m [\d.]+ [\d.]+ l S Q/);
  });

  it("prints scene numbers in both margins when asked", () => {
    const on = screenplayPreset("letter", { ...labels, screenplaySceneNumbers: true });
    const s = latin1(screenplayPdf(script(scene("int. a - dia", "12"), transition("CORTA PARA:")), { title: "T" }, on).bytes);
    // left: ends one column before 15 -> column 12 = 86.4; right: column 76 = 547.2
    expect(s).toContain("86.4 711 Td (12) Tj");
    expect(s).toContain("547.2 711 Td (12) Tj");
  });

  it("makes one page for an empty script with a title, and one blank page without a title", () => {
    expect(screenplayPdf(script(), title, LETTER).pages).toBe(1);
    expect(screenplayPdf(script(), { title: "" }, LETTER).pages).toBe(1);
    expect(screenplayPdf(script(action("x")), { title: "" }, LETTER).pages).toBe(1);
  });
});
