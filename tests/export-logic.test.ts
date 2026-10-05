import { describe, expect, it } from "vitest";
import type { ChapterRef } from "../src/core/book-source";
import { cleanExportChoices, type ExportChoice } from "../src/data";
import {
  authorOf, choiceOfLast, dropChoices, exportFileName, fileTitle, inFolder, keepBothName, linkTarget, planChapters,
  presetLabel, renameChoices, stamp, whenText, dayMonthText,
} from "../src/export/logic";

const ch = (path: string, title: string, number: number | null, include = true): ChapterRef => ({ path, title, number, include });
const BOOK = [
  ch("A/Chapters/Prólogo.md", "Prólogo", null),
  ch("A/Chapters/01 A chegada.md", "A chegada", 1),
  ch("A/Chapters/02 Rascunho.md", "Rascunho", 2, false),
  ch("A/Chapters/03 A casa.md", "A casa", 3),
  ch("A/Chapters/04 O porão.md", "O porão", 4),
  ch("A/Chapters/Epílogo.md", "Epílogo", null),
];
const FORMAT = "Capítulo {n} — {title}";

describe("planChapters (Q4, Q5)", () => {
  it("takes every included chapter, numbering by ordinal and leaving compile: false out", () => {
    const p = planChapters(BOOK, { mode: "all" }, FORMAT);
    expect(p.chosen.map((c) => c.heading)).toEqual(["Prólogo", "Capítulo 1 — A chegada", "Capítulo 2 — A casa", "Capítulo 3 — O porão", "Epílogo"]);
    expect(p.left.map((c) => c.title)).toEqual(["Rascunho"]);
    expect(p.included).toHaveLength(5);
  });
  it("keeps the numbers when a range or a pick narrows the list", () => {
    const range = planChapters(BOOK, { mode: "range", from: 4, to: 4 }, FORMAT);
    expect(range.chosen.map((c) => c.heading)).toEqual(["Capítulo 3 — O porão"]);
    const pick = planChapters(BOOK, { mode: "pick", paths: ["A/Chapters/04 O porão.md", "A/Chapters/Prólogo.md", "gone.md"] }, FORMAT);
    expect(pick.chosen.map((c) => c.heading)).toEqual(["Prólogo", "Capítulo 3 — O porão"]);
  });
  it("clamps and swaps a range, and never picks a left-out chapter", () => {
    expect(planChapters(BOOK, { mode: "range", from: 0, to: 2 }, FORMAT).chosen).toHaveLength(2);
    expect(planChapters(BOOK, { mode: "range", from: 4, to: 2 }, FORMAT).chosen.map((c) => c.ref.title)).toEqual(["A chegada", "A casa", "O porão"]);
    expect(planChapters(BOOK, { mode: "range", from: 4, to: 99 }, FORMAT).chosen.map((c) => c.ref.title)).toEqual(["O porão", "Epílogo"]);
    expect(planChapters(BOOK, { mode: "range", from: 9, to: 12 }, FORMAT).chosen).toEqual([]);
    expect(planChapters(BOOK, { mode: "pick", paths: ["A/Chapters/02 Rascunho.md"] }, FORMAT).chosen).toEqual([]);
  });
});

describe("planChapters with nothing to take", () => {
  const ALL_OUT = [ch("A/Chapters/01 Um.md", "Um", 1, false), ch("A/Chapters/Dois.md", "Dois", null, false)];
  const noNumbers = [ch("A/Chapters/Prólogo.md", "Prólogo", null), ch("A/Chapters/Epílogo.md", "Epílogo", null)];
  const selections = [
    { mode: "all" as const },
    { mode: "range" as const, from: 1, to: 1 },
    { mode: "pick" as const, paths: ["A/Chapters/01 Um.md"] },
  ];
  it("gives an empty plan for an empty book in every mode", () => {
    for (const sel of selections) {
      const p = planChapters([], sel, FORMAT);
      expect(p.chosen).toEqual([]);
      expect(p.included).toEqual([]);
      expect(p.left).toEqual([]);
    }
  });
  it("gives an empty plan when every chapter is compile: false, and leaves them all out", () => {
    for (const sel of selections) {
      const p = planChapters(ALL_OUT, sel, FORMAT);
      expect(p.chosen).toEqual([]);
      expect(p.included).toEqual([]);
      expect(p.left).toEqual(ALL_OUT);
    }
  });
  it("headings are the titles when no chapter has a number", () => {
    const p = planChapters(noNumbers, { mode: "all" }, FORMAT);
    expect(p.chosen.map((c) => c.heading)).toEqual(["Prólogo", "Epílogo"]);
    expect(planChapters(noNumbers, { mode: "range", from: 1, to: 1 }, FORMAT).chosen.map((c) => c.heading)).toEqual(["Prólogo"]);
  });
});

describe("file names (Q3, G1)", () => {
  it("names a Markdown export <title>.md and a DOCX <title> (<preset>).docx", () => {
    expect(exportFileName("O porão", "md", "shunn")).toBe("O porão.md");
    expect(exportFileName("O porão", "docx", "shunn")).toBe("O porão (Shunn).docx");
    expect(exportFileName("A Casa", "docx", "ptbr")).toBe("A Casa (pt-BR).docx");
    expect(presetLabel("custom")).toBe("custom");
  });
  it("keeps both with the export's date and time", () => {
    const at = new Date(2026, 9, 5, 14, 32);
    expect(stamp(at)).toBe("2026-10-05 14h32");
    expect(keepBothName("O porão", "docx", "shunn", at)).toBe("O porão (Shunn) 2026-10-05 14h32.docx");
    expect(keepBothName("O porão", "md", "shunn", at)).toBe("O porão 2026-10-05 14h32.md");
    expect(stamp(new Date(2026, 0, 3, 4, 5))).toBe("2026-01-03 04h05");
  });
  it("makes a safe title, never empty", () => {
    expect(fileTitle('A: "casa"? #1 [x]')).toBe("A casa 1 x");
    expect(fileTitle("Fim...")).toBe("Fim");
    expect(fileTitle("///")).toBe("Export");
  });
  it("joins the folder without doubled slashes", () => {
    expect(inFolder("Escrita/Exports", "a.md")).toBe("Escrita/Exports/a.md");
    expect(inFolder("/Escrita//Exports/", "a.md")).toBe("Escrita/Exports/a.md");
    expect(inFolder("", "a.md")).toBe("a.md");
  });
});

describe("author and links (Q2, Q7)", () => {
  const s = { authorProperty: "author", authorName: "Ana Souza", authorSurname: "", contactLines: "Rua A\n\n  ana@x.com \r\n" };
  it("reads the settings, with the last word as surname", () => {
    expect(authorOf(s, {})).toEqual({ name: "Ana Souza", surname: "Souza", contact: ["Rua A", "ana@x.com"] });
    expect(authorOf({ ...s, authorSurname: "de Souza" }, null).surname).toBe("de Souza");
  });
  it("lets an author property override the name, and its own last word the surname", () => {
    expect(authorOf({ ...s, authorSurname: "de Souza" }, { author: "Beto Lima" })).toMatchObject({ name: "Beto Lima", surname: "Lima" });
    expect(authorOf(s, { author: 3 }).name).toBe("Ana Souza");
  });
  it("reads the author from the property the setting names, and ignores `author` then", () => {
    expect(authorOf({ ...s, authorProperty: "autor" }, { autor: "Beto Lima", author: "Zed" }).name).toBe("Beto Lima");
    expect(authorOf({ ...s, authorProperty: "autor" }, { author: "Zed" }).name).toBe("Ana Souza");
    expect(authorOf({ ...s, authorProperty: " " }, { author: "Zed" }).name).toBe("Ana Souza");
  });
  it("has no name, no surname", () => {
    expect(authorOf({ authorProperty: "author", authorName: "", authorSurname: "", contactLines: "" }, {})).toEqual({ name: "", surname: "", contact: [] });
  });
  it("takes the target of a wikilink property", () => {
    expect(linkTarget("[[Dedicatória]]")).toBe("Dedicatória");
    expect(linkTarget(" [[Notas/Dedicatória#x|aliás]] ")).toBe("Notas/Dedicatória");
    expect(linkTarget("Dedicatória")).toBe("Dedicatória");
    expect(linkTarget("[[]]")).toBeNull();
    expect(linkTarget(["a"])).toBeNull();
    expect(linkTarget(undefined)).toBeNull();
  });
});

describe("last export (Q17)", () => {
  it("formats a time in a locale and survives a bad one", () => {
    expect(whenText("2026-10-03T14:32:00", "pt-BR")).toBe("3 out, 14:32");
    expect(whenText("2026-10-03T14:32:00", "en")).toBe("3 Oct, 14:32");
    expect(whenText("2026-10-03T09:05:00", "en")).toBe("3 Oct, 09:05");
    expect(dayMonthText(new Date(2026, 8, 28), "pt-BR")).toBe("28 set");
    expect(whenText("2026-10-03T14:32:00", "xx-invalid-tag-!!")).toBe("2026-10-03T14:32:00");
    expect(whenText("nonsense", "en")).toBe("nonsense");
  });
  const last = {
    format: "docx" as const, preset: "ptbr", whole: true, chapters: { mode: "pick" as const, paths: ["Books/A/Chapters/x.md"] },
    chapterCount: 14, at: "2026-10-03T14:32:00.000Z", path: "Escrita/Exports/A (pt-BR).docx",
  };
  it("is the choice to repeat", () => {
    expect(choiceOfLast(last)).toMatchObject({ format: "docx", preset: "ptbr", whole: true, chapters: last.chapters });
  });

  const make = (): Record<string, ExportChoice> => ({
    "Books/A.md": { format: "docx", preset: "ptbr", whole: true, chapters: { mode: "pick", paths: ["Books/A/Chapters/x.md", "Books/A/Chapters/y.md"] }, last: structuredClone(last) },
    "Notes/conto.md": { format: "md", preset: "shunn", whole: false },
  });
  it("follows a renamed note, its chapters and its last file", () => {
    const c = make();
    expect(renameChoices(c, "Books/A.md", "Books/B.md")).toBe(true);
    expect(Object.keys(c).sort()).toEqual(["Books/B.md", "Notes/conto.md"]);
    expect(renameChoices(c, "Books/A", "Books/B")).toBe(true);
    expect(c["Books/B.md"].chapters).toEqual({ mode: "pick", paths: ["Books/B/Chapters/x.md", "Books/B/Chapters/y.md"] });
    expect(renameChoices(c, "Escrita/Exports/A (pt-BR).docx", "Escrita/Exports/B (pt-BR).docx")).toBe(true);
    expect(c["Books/B.md"].last!.path).toBe("Escrita/Exports/B (pt-BR).docx");
    expect(renameChoices(c, "nothing", "else")).toBe(false);
  });
  it("drops a deleted work's choices and ticked chapters, and keeps a last file's record", () => {
    const c = make();
    expect(dropChoices(c, "Books/A/Chapters/x.md")).toBe(true);
    expect(c["Books/A.md"].chapters).toEqual({ mode: "pick", paths: ["Books/A/Chapters/y.md"] });
    expect(c["Books/A.md"].last!.chapters).toEqual({ mode: "pick", paths: [] });
    expect(dropChoices(c, "Escrita/Exports/A (pt-BR).docx")).toBe(false);
    expect(c["Books/A.md"].last).toBeDefined();
    expect(dropChoices(c, "Notes/conto.md")).toBe(true);
    expect(Object.keys(c)).toEqual(["Books/A.md"]);
    expect(dropChoices(c, "Books/A.md")).toBe(true);
    expect(c).toEqual({});
  });
});

describe("cleanExportChoices", () => {
  it("keeps old entries and drops what is not a choice", () => {
    const out = cleanExportChoices({
      "a.md": { format: "md", preset: "shunn", whole: false },
      "b.md": { format: "pdf", preset: "shunn", whole: false },
      "c.md": { format: "docx", preset: "ptbr", whole: true, chapters: { mode: "range", from: 2.7, to: 5 },
        last: { format: "docx", preset: "ptbr", whole: true, chapters: { mode: "bogus" }, at: "2026-10-05T10:00:00Z", path: "x.docx", chapterCount: 3 } },
      "d.md": { format: "docx", preset: "ptbr", whole: true, chapters: { mode: "pick", paths: ["x", 3] }, last: { format: "docx", preset: "ptbr", whole: true, at: "t", path: "" } },
    });
    expect(Object.keys(out)).toEqual(["a.md", "c.md", "d.md"]);
    expect(out["a.md"]).toEqual({ format: "md", preset: "shunn", whole: false });
    expect(out["c.md"].chapters).toEqual({ mode: "range", from: 2, to: 5 });
    expect(out["c.md"].last).toMatchObject({ chapters: { mode: "all" }, chapterCount: 3, path: "x.docx" });
    expect(out["d.md"].chapters).toEqual({ mode: "pick", paths: ["x"] });
    expect(out["d.md"].last).toBeUndefined();
    expect(cleanExportChoices(null)).toEqual({});
    expect(cleanExportChoices([1])).toEqual({});
  });
});
