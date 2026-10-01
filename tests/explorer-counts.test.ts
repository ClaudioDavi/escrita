import { describe, it, expect } from "vitest";
import { abbreviate, countLabel, explorerTotals, stateClass, type BookShape, type NumFmt } from "../src/explorer/counts";
import { progressOf } from "../src/core/measure";

const fmt = (l: string): NumFmt => (n, d) => n.toLocaleString(l, { maximumFractionDigits: d });
const EN = { k: "{n}k", m: "{n}M" };
const PT = { k: "{n} mil", m: "{n} mi" };
const en = (n: number) => abbreviate(n, fmt("en"), EN);

describe("abbreviate", () => {
  it("keeps numbers under 10,000 whole", () => {
    expect(en(0)).toBe("0");
    expect(en(9_999)).toBe("9,999");
    expect(en(1234.6)).toBe("1,235");
  });

  it("abbreviates thousands and millions", () => {
    expect(en(10_000)).toBe("10k");
    expect(en(18_420)).toBe("18.4k");
    expect(en(99_960)).toBe("100k");
    expect(en(184_300)).toBe("184k");
    expect(en(999_600)).toBe("1M");
    expect(en(1_234_567)).toBe("1.2M");
  });

  it("shows 0 for nonsense", () => {
    expect(en(NaN)).toBe("0");
    expect(en(-5)).toBe("0");
    expect(en(Infinity)).toBe("0");
  });

  it("follows pt-BR", () => {
    const pt = (n: number) => abbreviate(n, fmt("pt-BR"), PT);
    expect(pt(9_999)).toBe("9.999");
    expect(pt(18_420)).toBe("18,4 mil");
    expect(pt(1_234_567)).toBe("1,2 mi");
  });
});

describe("countLabel", () => {
  const o = (showTarget: boolean) => ({ showTarget, fmt: fmt("en"), abbrev: EN });

  it("words without a target", () => {
    expect(countLabel(progressOf(18_420, null), o(true))).toEqual({ text: "18.4k", of: null, state: "none" });
  });

  it("shows the target when asked", () => {
    const p = progressOf(4_210, { unit: "characters", target: 5_000 });
    expect(countLabel(p, o(true))).toEqual({ text: "4,210 / 5,000", of: 5_000, state: "under" });
    expect(countLabel(p, o(false))).toEqual({ text: "4,210", of: null, state: "under" });
  });

  it("colours near and over a limit, and shows the limit as `of`", () => {
    expect(countLabel(progressOf(4_900, { limit: 5_000 }), o(false)).state).toBe("near");
    const over = countLabel(progressOf(5_100, { limit: 5_000 }), o(true));
    expect(over).toEqual({ text: "5,100 / 5,000", of: 5_000, state: "over" });
  });

  it("prefers the target to the limit", () => {
    expect(countLabel(progressOf(100, { target: 3_000, limit: 5_000 }), o(true)).of).toBe(3_000);
  });

  it("abbreviates both sides", () => {
    expect(countLabel(progressOf(12_345, { target: 80_000 }), o(true)).text).toBe("12.3k / 80k");
  });

  it("maps state to a class", () => {
    expect(stateClass("near")).toBe("is-near");
    expect(stateClass("over")).toBe("is-over");
    expect(stateClass("under")).toBe("");
    expect(stateClass("none")).toBe("");
  });
});

describe("explorerTotals", () => {
  const book: BookShape = { note: "N.md", folder: "N", chaptersFolder: "N/Chapters", chapters: ["N/Chapters/1.md", "N/Chapters/2.md"] };
  const chapterWords = new Map([["N/Chapters/1.md", 100], ["N/Chapters/2.md", 50]]);

  it("gives the book note, folder and chapters folder the chapters' sum", () => {
    const words = new Map([...chapterWords, ["N/Chapters/Old/x.md", 999], ["N.md", 7]]);
    const t = explorerTotals({ words, books: [book], chapterWords, folderTotals: false });
    expect(t.books.get("N.md")).toEqual({ words: 150, role: "book" });
    expect(t.books.get("N")).toEqual({ words: 150, role: "book" });
    expect(t.books.get("N/Chapters")).toEqual({ words: 150, role: "chapters" });
    expect(t.books.size).toBe(3);
    expect(t.folders.size).toBe(0);
  });

  it("uses one key when the chapters folder is the book folder", () => {
    const flat: BookShape = { note: "F.md", folder: "F", chaptersFolder: "F", chapters: ["F/a.md"] };
    const t = explorerTotals({ words: new Map(), books: [flat], chapterWords: new Map([["F/a.md", 3]]), folderTotals: false });
    expect([...t.books.keys()].sort()).toEqual(["F", "F.md"]);
    expect(t.books.get("F")!.role).toBe("book");
  });

  it("shows no book total while a chapter is uncounted", () => {
    const t = explorerTotals({ words: new Map(), books: [book], chapterWords: new Map([["N/Chapters/1.md", 100]]), folderTotals: false });
    expect(t.books.size).toBe(0);
  });

  it("a book with no chapters totals 0", () => {
    const empty = { ...book, chapters: [] };
    expect(explorerTotals({ words: new Map(), books: [empty], chapterWords: new Map(), folderTotals: false }).books.get("N")!.words).toBe(0);
  });

  it("sums folders over tracked files, never the root", () => {
    const words = new Map([["A/B/c.md", 10], ["A/d.md", 5], ["top.md", 1]]);
    const t = explorerTotals({ words, books: [], chapterWords: new Map(), folderTotals: true });
    expect(t.folders.get("A")).toBe(15);
    expect(t.folders.get("A/B")).toBe(10);
    expect(t.folders.has("")).toBe(false);
    expect(t.folders.has("/")).toBe(false);
    expect(t.folders.size).toBe(2);
  });

  it("book keys win over the generic sum; outer folders include nested books", () => {
    const b: BookShape = { note: "Lib/N.md", folder: "Lib/N", chaptersFolder: "Lib/N/Chapters", chapters: ["Lib/N/Chapters/1.md"] };
    const words = new Map([["Lib/N/Chapters/1.md", 100], ["Lib/N/Personagens/Teo.md", 40], ["Lib/N.md", 2]]);
    const t = explorerTotals({ words, books: [b], chapterWords: new Map([["Lib/N/Chapters/1.md", 100]]), folderTotals: true });
    expect(t.books.get("Lib/N")!.words).toBe(100);
    expect(t.folders.has("Lib/N")).toBe(false);
    expect(t.folders.has("Lib/N/Chapters")).toBe(false);
    expect(t.folders.get("Lib/N/Personagens")).toBe(40);
    expect(t.folders.get("Lib")).toBe(142);
  });

  it("each nested book has its own total", () => {
    const outer: BookShape = { note: "O.md", folder: "O", chaptersFolder: "O/Chapters", chapters: ["O/Chapters/1.md"] };
    const inner: BookShape = { note: "O/I.md", folder: "O/I", chaptersFolder: "O/I/Chapters", chapters: ["O/I/Chapters/1.md"] };
    const cw = new Map([["O/Chapters/1.md", 10], ["O/I/Chapters/1.md", 20]]);
    const t = explorerTotals({ words: cw, books: [outer, inner], chapterWords: cw, folderTotals: true });
    expect(t.books.get("O")!.words).toBe(10);
    expect(t.books.get("O/I")!.words).toBe(20);
  });
});
