import { describe, expect, it } from "vitest";
import { countedNumbers, isUnnumberedTitle, parseTitleList } from "../src/core/book";
import { chapterHeadings, exportDocOf, type ExportPart } from "../src/core/export-pipeline";
import { planChapters } from "../src/export/logic";
import { PTBR, SHUNN } from "../src/export/presets";
import { markdownWriter } from "../src/export/writers/markdown";
import { chapterNumber, chapterTitle } from "../src/core/book";
import { normalizeSettings, DEFAULT_SETTINGS } from "../src/settings";

const NAMES = ["01 Prefácio", "02 Prólogo", "03 A chegada", "04 Interlúdio", "05 O porão", "06 Epílogo"];
const chapters = NAMES.map((b) => ({ number: chapterNumber(b), title: chapterTitle(b) }));
const LIST = "Prefácio, Prólogo\nInterlúdio, Epílogo";

describe("unnumbered titles: matching", () => {
  it("parses commas and newlines", () => {
    expect(parseTitleList(" a, b\nc ,, \r\n d ")).toEqual(["a", "b", "c", "d"]);
    expect(parseTitleList("")).toEqual([]);
  });
  it("ignores case and accents", () => {
    expect(isUnnumberedTitle("INTERLUDIO", "Interlúdio")).toBe(true);
    expect(isUnnumberedTitle("prólogo", ["Prologo"])).toBe(true);
  });
  it("matches a prefix followed by a space or punctuation", () => {
    expect(isUnnumberedTitle("Interlúdio — a carta", "Interlúdio")).toBe(true);
    expect(isUnnumberedTitle("Interlúdio: a carta", "Interlúdio")).toBe(true);
    expect(isUnnumberedTitle("Interlúdio, de novo", "Interlúdio")).toBe(true);
    expect(isUnnumberedTitle("Interlúdios", "Interlúdio")).toBe(false);
    expect(isUnnumberedTitle("O interlúdio", "Interlúdio")).toBe(false);
  });
  it("an empty list or empty entries match nothing", () => {
    expect(isUnnumberedTitle("Prólogo", "")).toBe(false);
    expect(isUnnumberedTitle("Prólogo", " , ,\n")).toBe(false);
    expect(isUnnumberedTitle("", "Prólogo")).toBe(false);
  });
  it("counts what export numbers", () => {
    expect(countedNumbers(chapters, LIST)).toEqual([null, null, 1, null, 2, null]);
    expect(countedNumbers(chapters)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("unnumbered titles: headings", () => {
  it("six chapters, both presets", () => {
    expect(chapterHeadings(chapters, PTBR.chapterHeading, LIST)).toEqual([
      "Prefácio", "Prólogo", "Capítulo 1 — A chegada", "Interlúdio", "Capítulo 2 — O porão", "Epílogo",
    ]);
    expect(chapterHeadings(chapters, SHUNN.chapterHeading, LIST)).toEqual([
      "Prefácio", "Prólogo", "Chapter 1: A chegada", "Interlúdio", "Chapter 2: O porão", "Epílogo",
    ]);
  });
  it("00 and files without a number still work next to the list", () => {
    const list = [{ number: 0, title: "Nota" }, { number: 1, title: "Prólogo" }, { number: 2, title: "Um" }, { number: null, title: "Fim" }];
    expect(chapterHeadings(list, PTBR.chapterHeading, "Prólogo")).toEqual(["Nota", "Prólogo", "Capítulo 1 — Um", "Fim"]);
  });
  it("the Markdown writer prints them", () => {
    for (const preset of [PTBR, SHUNN]) {
      const heads = chapterHeadings(chapters, preset.chapterHeading, LIST);
      const parts: ExportPart[] = heads.map((heading, i) => ({ role: "body", heading, title: chapters[i].title, md: "Texto.\n" as never }));
      const out = markdownWriter.write(exportDocOf({
        title: "A Casa", author: { name: "", surname: "", contact: [] }, count: { amount: 1, unit: "words" }, parts,
      }, { placeholderMarker: "XXX" }), preset) as string;
      const found = [...out.matchAll(/^#+ (.*)$/gm)].map((m) => m[1]).filter((h) => heads.includes(h));
      expect(found).toEqual(heads);
    }
  });
  it("the picker plan shows the same headings, kept over a selection", () => {
    const all = NAMES.map((b, i) => ({ path: `${i}.md`, title: chapterTitle(b), number: chapterNumber(b), include: true }));
    const plan = planChapters(all, { mode: "range", from: 4, to: 5 }, PTBR.chapterHeading, LIST);
    expect(plan.chosen.map((c) => c.heading)).toEqual(["Interlúdio", "Capítulo 2 — O porão"]);
    expect(plan.included.map((c) => c.heading)[2]).toBe("Capítulo 1 — A chegada");
  });
});

describe("unnumbered titles: setting", () => {
  it("has English defaults, keeps an empty list, and restores a bad value", () => {
    expect(DEFAULT_SETTINGS.unnumberedTitles).toBe("Prologue, Preface, Foreword, Introduction, Interlude, Epilogue, Afterword");
    expect(normalizeSettings({ unnumberedTitles: "  Prólogo  " } as never).unnumberedTitles).toBe("Prólogo");
    expect(normalizeSettings({ unnumberedTitles: "" } as never).unnumberedTitles).toBe("");
    expect(normalizeSettings({ unnumberedTitles: 5 } as never).unnumberedTitles).toBe(DEFAULT_SETTINGS.unnumberedTitles);
  });
});
