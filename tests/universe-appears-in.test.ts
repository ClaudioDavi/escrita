import { beforeAll, describe, expect, it } from "vitest";
import { registerStrings } from "../src/i18n";
import { compileTerms, type NameSource } from "../src/core/names";
import { universeViewStrings } from "../src/universe/view-strings";
import {
  baseName, chapterParts, chapterRef, countLabel, countTip, firstLastLine, mentionStillThere, summaryLine,
} from "../src/universe/appears-in-model";
import type { AppearsIn } from "../src/universe/mentions";

beforeAll(() => registerStrings(universeViewStrings));

const ai = (workCount: number, total: number): AppearsIn => ({
  works: [], other: [], total, workCount,
});

describe("summary and count", () => {
  it("the collapsed line joins works and mentions", () => {
    expect(summaryLine(ai(4, 41))).toBe("4 works · 41 mentions");
    expect(summaryLine(ai(1, 1))).toBe("1 work · 1 mention");
  });
  it("says so when there is nothing", () => {
    expect(summaryLine(ai(0, 0))).toBe("no works yet");
  });
  it("mentions outside any work give just the mentions", () => {
    expect(summaryLine(ai(0, 2))).toBe("2 mentions");
  });
  it("the count beside the name is the works, nothing at zero", () => {
    expect(countLabel(ai(4, 41))).toBe("4 works");
    expect(countLabel(ai(1, 3))).toBe("1 work");
    expect(countLabel(ai(0, 0))).toBeNull();
    expect(countLabel(ai(0, 2))).toBe("2 mentions");
  });
  it("the tooltip gives mentions and works", () => {
    expect(countTip(ai(4, 41))).toBe("41 mentions in 4 works");
    expect(countTip(ai(0, 2))).toBe("2 mentions");
  });
});

describe("chapter labels", () => {
  it("splits a number prefix from the title", () => {
    expect(chapterParts("03 O porão")).toEqual({ n: 3, title: "O porão" });
    expect(chapterParts("4 - Teo")).toEqual({ n: 4, title: "Teo" });
    expect(chapterParts("Epílogo")).toEqual({ n: null, title: "Epílogo" });
    expect(chapterParts("07")).toEqual({ n: 7, title: "07" });
  });
  it("makes the reference and the first/last line", () => {
    expect(baseName("A Casa/Capítulos/01 Chegada.md")).toBe("01 Chegada");
    expect(chapterRef("01 Chegada")).toBe("1, Chegada");
    expect(firstLastLine("A Casa/c/01 Chegada.md", "A Casa/c/04 Teo.md")).toBe("first in ch. 1, Chegada · last in ch. 4, Teo");
    expect(firstLastLine("a/01 X.md", "a/01 X.md")).toBe("");
  });
});

describe("mentionStillThere", () => {
  const src: NameSource = { id: "Mariana.md", name: "Mariana", aliases: [], person: true, firstName: true, caseSensitive: false, ignore: [] };
  const table = compileTerms([src], { lang: null, extraTitles: [] });
  const text = "Ontem a Mariana voltou. Veja [[Mariana]] e [a Mari](Mariana.md).";
  const at = (s: string) => ({ from: text.indexOf(s), to: text.indexOf(s) + s.length });

  it("accepts a name at the stored range for this entry", () => {
    expect(mentionStillThere(text, { from: text.indexOf("Mariana"), to: text.indexOf("Mariana") + 7 }, table, "Mariana.md")).toBe(true);
  });
  it("accepts a wikilink and a Markdown link over their exact range", () => {
    expect(mentionStillThere(text, at("[[Mariana]]"), table, "Mariana.md")).toBe(true);
    expect(mentionStillThere(text, at("[a Mari](Mariana.md)"), table, "Mariana.md")).toBe(true);
  });
  it("refuses when the text moved (an edit before the range)", () => {
    const stale = { from: text.indexOf("Mariana"), to: text.indexOf("Mariana") + 7 };
    expect(mentionStillThere("xx" + text, stale, table, "Mariana.md")).toBe(false);
  });
  it("refuses a range for another entry, a part of a word, or outside the text", () => {
    const r = { from: text.indexOf("Mariana"), to: text.indexOf("Mariana") + 7 };
    expect(mentionStillThere(text, r, table, "Outra.md")).toBe(false);
    expect(mentionStillThere(text, { from: r.from, to: r.from + 4 }, table, "Mariana.md")).toBe(false);
    expect(mentionStillThere(text, { from: 0, to: 10_000 }, table, "Mariana.md")).toBe(false);
    expect(mentionStillThere(text, { from: 5, to: 5 }, table, "Mariana.md")).toBe(false);
  });
  it("refuses a name that has since moved into a code span", () => {
    const edited = "Ontem a `Mariana` voltou.";
    const r = { from: edited.indexOf("Mariana"), to: edited.indexOf("Mariana") + 7 };
    expect(mentionStillThere(edited, r, table, "Mariana.md")).toBe(false);
  });
});
