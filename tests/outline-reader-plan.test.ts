import { describe, expect, it } from "vitest";
import {
  blockForLine, dropPositions, movePositions, readerChapters, readerHeadingFormat, readerSource, readerStatePath,
  readingPoint, restoreTarget, sameSource, type SectionBox,
} from "../src/outline/reader-plan";
import type { ChapterRef } from "../src/core/book-source";
import type { ReadPosition } from "../src/data";

const ref = (path: string, number: number | null, title: string, include = true): ChapterRef => ({ path, number, title, include });

describe("readerHeadingFormat (D7)", () => {
  it("uses the export's setting, else the language's preset", () => {
    expect(readerHeadingFormat(" Cap. {n} ", "en")).toBe("Cap. {n}");
    expect(readerHeadingFormat("", "pt-BR")).toBe("Capítulo {n} — {title}");
    expect(readerHeadingFormat("  ", "en")).toBe("Chapter {n}: {title}");
  });
});

describe("readerChapters", () => {
  const all = [
    ref("b/00 Prólogo.md", 0, "Prólogo"),
    ref("b/01 A chegada.md", 1, "A chegada"),
    ref("b/02 Fora.md", 2, "Fora", false),
    ref("b/03 A volta.md", 3, "A volta"),
    ref("b/Epílogo.md", null, "Epílogo"),
  ];
  it("lists included chapters in order, numbered as the export numbers them", () => {
    expect(readerChapters(all, "Capítulo {n} — {title}")).toEqual([
      { path: "b/00 Prólogo.md", heading: "Prólogo" },
      { path: "b/01 A chegada.md", heading: "Capítulo 1 — A chegada" },
      { path: "b/03 A volta.md", heading: "Capítulo 2 — A volta" },
      { path: "b/Epílogo.md", heading: "Epílogo" },
    ]);
  });
  it("is empty for a book with no included chapter", () => {
    expect(readerChapters([ref("b/01.md", 1, "x", false)], "{n}")).toEqual([]);
  });
});

describe("restoreTarget and blockForLine", () => {
  const chapters = [{ path: "a", heading: "" }, { path: "b", heading: "" }];
  it("lands on the saved chapter, or the top when it is gone", () => {
    expect(restoreTarget({ chapter: "b", line: 9 }, chapters)).toEqual({ index: 1, line: 9 });
    expect(restoreTarget({ chapter: "zz", line: 9 }, chapters)).toEqual({ index: 0, line: 0 });
    expect(restoreTarget(undefined, chapters)).toEqual({ index: 0, line: 0 });
  });
  it("picks the last block at or before the line", () => {
    expect(blockForLine([3, 5, 9], 9)).toBe(2);
    expect(blockForLine([3, 5, 9], 7)).toBe(1);
    expect(blockForLine([3, 5, 9], 1)).toBe(0);
    expect(blockForLine([], 4)).toBe(-1);
  });
});

describe("readingPoint", () => {
  const box = (path: string, bottom: number, blocks: { line: number; bottom: number }[] | null): SectionBox =>
    ({ path, bottom: () => bottom, blocks: () => blocks });
  const sections = [
    box("a", 100, [{ line: 2, bottom: 40 }, { line: 4, bottom: 100 }]),
    box("b", 400, null),
  ];
  it("is the first block whose bottom is below the edge", () => {
    expect(readingPoint(sections, 50)).toEqual({ chapter: "a", line: 4 });
    expect(readingPoint(sections, 10)).toEqual({ chapter: "a", line: 2 });
  });
  it("counts a chapter not drawn yet as its line 0", () => {
    expect(readingPoint(sections, 150)).toEqual({ chapter: "b", line: 0 });
  });
  it("is the end of the last chapter past everything, and null for none", () => {
    expect(readingPoint([sections[0]], 500)).toEqual({ chapter: "a", line: 4 });
    expect(readingPoint([], 0)).toBeNull();
  });
  it("measures no section past the one picked, and only that one's blocks", () => {
    const read: string[] = [];
    const spy = (path: string, bottom: number): SectionBox => ({
      path,
      bottom: () => { read.push(`${path}.bottom`); return bottom; },
      blocks: () => { read.push(`${path}.blocks`); return []; },
    });
    readingPoint([spy("a", 10), spy("b", 100), spy("c", 300)], 50);
    expect(read).toEqual(["a.bottom", "b.bottom", "b.blocks"]);
  });
});

describe("following the vault", () => {
  const make = (): Record<string, ReadPosition> => ({
    "Livro.md": { chapter: "Livro/Cap/01 A.md", line: 3 },
    "Outro.md": { chapter: "Outro/Cap/01.md", line: 0 },
  });
  it("a renamed chapter, folder or book note moves the entry", () => {
    const s = make();
    expect(movePositions(s, "Livro/Cap/01 A.md", "Livro/Cap/01 B.md")).toBe(true);
    expect(s["Livro.md"].chapter).toBe("Livro/Cap/01 B.md");
    expect(movePositions(s, "Livro", "Romance")).toBe(true);
    expect(s["Livro.md"].chapter).toBe("Romance/Cap/01 B.md");
    expect(movePositions(s, "Livro.md", "Romance.md")).toBe(true);
    expect(Object.keys(s).sort()).toEqual(["Outro.md", "Romance.md"]);
    expect(movePositions(s, "nada", "x")).toBe(false);
  });
  it("a deleted chapter or book drops the entry; others stay", () => {
    const a = make();
    expect(dropPositions(a, "Livro/Cap/01 A.md")).toBe(true);
    expect(Object.keys(a)).toEqual(["Outro.md"]);
    const b = make();
    expect(dropPositions(b, "Outro.md")).toBe(true);
    expect(Object.keys(b)).toEqual(["Livro.md"]);
    expect(dropPositions(b, "nada")).toBe(false);
  });
});

describe("readerSource (SF 15, Q13-Q15)", () => {
  const fmt = "Capítulo {n} — {title}";
  const chapters = [ref("L/C/01 A.md", 1, "A"), ref("L/C/02 B.md", 2, "B", false)];

  it("a book keeps its title and its included chapters with the export's headings", () => {
    const s = readerSource("L.md", { book: { title: "Livro", chapters }, collection: null, headingFormat: fmt });
    expect(s).toEqual({ kind: "book", title: "Livro", sections: [{ path: "L/C/01 A.md", heading: "Capítulo 1 — A" }] });
  });
  it("a book wins over a collection, as the export decides", () => {
    const s = readerSource("L.md", { book: { title: "Livro", chapters }, collection: { stories: ["x.md"], missing: [] }, headingFormat: fmt });
    expect(s.kind).toBe("book");
  });
  it("a collection lists its contos in order, each headed by its title alone, skipping the missing", () => {
    const s = readerSource("Contos/Coletânea.md", {
      book: null, collection: { stories: ["Contos/A visita.md", "Contos/1984.md"], missing: ["Fantasma"] }, headingFormat: fmt,
    });
    expect(s.kind).toBe("collection");
    expect(s.title).toBe("Coletânea");
    expect(s.sections).toEqual([
      { path: "Contos/A visita.md", heading: "A visita" },
      { path: "Contos/1984.md", heading: "1984" },
    ]);
  });
  it("an empty collection has no sections", () => {
    const s = readerSource("C.md", { book: null, collection: { stories: [], missing: [] }, headingFormat: fmt });
    expect(s).toEqual({ kind: "collection", title: "C", sections: [] });
  });
  it("a note is one section with no heading, titled by its name", () => {
    const s = readerSource("Contos/A visita.md", { book: null, collection: null, headingFormat: fmt });
    expect(s).toEqual({ kind: "note", title: "A visita", sections: [{ path: "Contos/A visita.md", heading: "" }] });
  });
});

describe("sameSource", () => {
  const a = readerSource("L.md", { book: { title: "L", chapters: [ref("c/1.md", 1, "A")] }, collection: null, headingFormat: "{title}" });
  it("is true for the same list, false when a chapter leaves or the title changes", () => {
    const b = readerSource("L.md", { book: { title: "L", chapters: [ref("c/1.md", 1, "A")] }, collection: null, headingFormat: "{title}" });
    expect(sameSource(a, b)).toBe(true);
    const left = readerSource("L.md", { book: { title: "L", chapters: [ref("c/1.md", 1, "A", false)] }, collection: null, headingFormat: "{title}" });
    expect(sameSource(a, left)).toBe(false);
    const renamed = readerSource("L.md", { book: { title: "M", chapters: [ref("c/1.md", 1, "A")] }, collection: null, headingFormat: "{title}" });
    expect(sameSource(a, renamed)).toBe(false);
  });
});

describe("readerStatePath (Q15)", () => {
  it("reads { source } and an old { book } as the same", () => {
    expect(readerStatePath({ source: "N.md" })).toBe("N.md");
    expect(readerStatePath({ book: "Livro.md" })).toBe("Livro.md");
    expect(readerStatePath({ source: "N.md", book: "Livro.md" })).toBe("N.md");
  });
  it("is null when it names nothing", () => {
    expect(readerStatePath(null)).toBeNull();
    expect(readerStatePath({})).toBeNull();
    expect(readerStatePath({ source: "", book: 3 })).toBeNull();
  });
});
