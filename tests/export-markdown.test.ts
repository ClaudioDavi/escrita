import { describe, expect, it } from "vitest";
import {
  aboutCount, chapterHeadings, droppedIn, exportDocOf, fillTemplate, type ExportDoc,
} from "../src/core/export-pipeline";
import { PRESETS, PTBR, SHUNN, presetById } from "../src/export/presets";
import { markdownWriter } from "../src/export/writers/markdown";
import { segment as segmentOf } from "../src/core/markdown";
import { bookSource, contoSource, read } from "./support/export-fixture";

const O = { placeholderMarker: "XXX" };
const FILES: [string, typeof SHUNN][] = [["shunn-en", SHUNN], ["ptbr", PTBR]];

describe("markdown writer: fixtures, whole file", () => {
  for (const [name, preset] of FILES) {
    it(`conto (${name})`, () => {
      const doc = exportDocOf(contoSource(), O);
      expect(markdownWriter.write(doc, preset)).toBe(read(`expected/conto.${name}.md`));
    });
    it(`book (${name})`, () => {
      const doc = exportDocOf(bookSource(preset), O);
      expect(markdownWriter.write(doc, preset)).toBe(read(`expected/book.${name}.md`));
    });
  }

  it("is pure: same model and preset, same output", () => {
    const doc = exportDocOf(contoSource(), O);
    expect(markdownWriter.write(doc, SHUNN)).toBe(markdownWriter.write(doc, SHUNN));
  });

  it("reports id and extension", () => {
    expect([markdownWriter.id, markdownWriter.ext]).toEqual(["markdown", "md"]);
  });
});

const docOf = (blocks: ExportDoc["parts"][0]["manuscript"]["blocks"], author = "Ana Souza"): ExportDoc => ({
  title: "T",
  author: { name: author, surname: "Souza", contact: [] },
  count: { amount: 0, unit: "words" },
  parts: [{ role: "body", heading: null, manuscript: { blocks, dropped: [] } }],
});

describe("markdown writer: details", () => {
  it("no author name leaves the byline out", () => {
    expect(markdownWriter.write(docOf([{ kind: "paragraph", runs: [{ text: "x" }] }], ""), SHUNN)).toBe("# T\n\nx\n");
  });

  it("a hard break is a backslash and newline; quotes stay one quotation", () => {
    const out = markdownWriter.write(
      docOf([
        { kind: "paragraph", runs: [{ text: "a\nb" }] },
        { kind: "quote", runs: [{ text: "q1\nq2" }] },
        { kind: "quote", runs: [{ text: "q3" }] },
      ]),
      SHUNN,
    ) as string;
    expect(out).toContain("a\\\nb\n");
    expect(out).toContain("> q1\\\n> q2\n>\n> q3\n");
  });

  it("escapes marks that would change the prose, and block starts", () => {
    const out = markdownWriter.write(
      docOf([
        { kind: "paragraph", runs: [{ text: "2 * 3 and snake_case <b>" }] },
        { kind: "paragraph", runs: [{ text: "1986. Era uma vez" }] },
        { kind: "paragraph", runs: [{ text: "# not a heading" }] },
      ]),
      SHUNN,
    ) as string;
    expect(out).toContain("2 \\* 3 and snake\\_case \\<b>");
    expect(out).toContain("1986\\. Era uma vez");
    expect(out).toContain("\\# not a heading");
  });

  it("keeps edge whitespace outside emphasis marks and nests bold in italic", () => {
    const out = markdownWriter.write(
      docOf([{ kind: "paragraph", runs: [{ text: "a ", italic: true }, { text: "b", italic: true, bold: true }, { text: " c", italic: true }, { text: " d" }] }]),
      SHUNN,
    ) as string;
    expect(out).toContain("*a **b** c* d");
  });

  it("scene break text follows the preset and is escaped", () => {
    const sb = [{ kind: "paragraph" as const, runs: [{ text: "a" }] }, { kind: "sceneBreak" as const }, { kind: "paragraph" as const, runs: [{ text: "b" }] }];
    expect(markdownWriter.write(docOf(sb), { ...SHUNN, sceneBreak: "* * *" })).toContain("a\n\n* * *\n\nb");
    expect(markdownWriter.write(docOf(sb), { ...SHUNN, sceneBreak: "#" })).toContain("a\n\n\\#\n\nb");
    expect(markdownWriter.write(docOf(sb), { ...SHUNN, sceneBreak: "" })).toContain("a\n\n&nbsp;\n\nb");
  });

  it("an empty chapter keeps its heading", () => {
    const doc: ExportDoc = {
      ...docOf([]),
      parts: [{ role: "body", heading: "Capítulo 1", manuscript: { blocks: [], dropped: [] } }],
    };
    expect(markdownWriter.write(doc, PTBR)).toBe("# T\n\npor Ana Souza\n\n---\n\n## Capítulo 1\n");
  });
});

describe("export pipeline helpers", () => {
  it("exportDocOf drops the title heading of a single note, not of a chapter", () => {
    const src = contoSource();
    const doc = exportDocOf({ ...src, parts: [{ ...src.parts[0], md: segmentOf("# A visita\n\nTexto.") }] }, O);
    expect(doc.parts[0].manuscript.blocks).toEqual([{ kind: "paragraph", runs: [{ text: "Texto." }] }]);
    const book = exportDocOf({ ...src, parts: [{ role: "body", heading: "Capítulo 1", md: segmentOf("# Capítulo 1\n\nTexto.") }] }, O);
    expect(book.parts[0].manuscript.blocks).toHaveLength(1);
    expect(book.parts[0].heading).toBe("Capítulo 1");
  });

  it("exportDocOf drops a chapter's leading H1 that repeats its own title", () => {
    const src = contoSource();
    const part = { role: "body" as const, heading: "Chapter 1: A chegada", title: "A chegada", md: segmentOf("# A chegada\n\nTexto.") };
    const doc = exportDocOf({ ...src, parts: [part] }, O);
    expect(doc.parts[0].manuscript.blocks).toEqual([{ kind: "paragraph", runs: [{ text: "Texto." }] }]);
    expect(markdownWriter.write(doc, SHUNN)).not.toContain("### A chegada");
    // a different first heading stays; so does the work's title under a chapter heading
    const other = exportDocOf({ ...src, parts: [{ ...part, md: segmentOf(`# ${src.title}\n\nTexto.`) }] }, O);
    expect(other.parts[0].manuscript.blocks).toHaveLength(2);
    // front matter keeps every heading
    const ded = exportDocOf({ ...src, parts: [{ role: "dedication", heading: null, title: null, md: segmentOf(`# ${src.title}\n\nPara A.`) }] }, O);
    expect(ded.parts[0].manuscript.blocks).toHaveLength(2);
  });

  it("droppedIn lists every drop with its part index", () => {
    const doc = exportDocOf(bookSource(SHUNN), O);
    const d = droppedIn(doc);
    expect(d.map((x) => x.dropped.kind)).toContain("placeholder");
    expect(d.map((x) => x.dropped.kind)).toContain("embed");
    const ph = d.find((x) => x.dropped.kind === "placeholder")!;
    expect(ph.part).toBe(3); // 01 A chegada: dedication, epigraph, Prólogo, then it
    expect(ph.dropped.text).toBe("nome da rua");
    expect(droppedIn(exportDocOf(contoSource(), O)).filter((x) => x.dropped.kind === "embed")[0].dropped.text).toBe("foto.png");
  });

  it("aboutCount rounds to 100 below 10,000 and 500 from there", () => {
    expect([0, 1, 49, 50, 612, 9949, 9950].map(aboutCount)).toEqual([0, 100, 100, 100, 600, 9900, 10000]);
    expect([10000, 10249, 10250, 12400, 87612].map(aboutCount)).toEqual([10000, 10000, 10500, 12500, 87500]);
    expect(aboutCount(-5)).toBe(0);
    expect(aboutCount(NaN)).toBe(0);
  });

  it("chapterHeadings numbers only numbered chapters", () => {
    const list = [
      { number: null, title: "Prólogo" },
      { number: 1, title: "A chegada" },
      { number: 3, title: "A casa" },
      { number: 4, title: "" },
      { number: null, title: "Epílogo" },
    ];
    expect(chapterHeadings(list, PTBR.chapterHeading)).toEqual([
      "Prólogo", "Capítulo 1 — A chegada", "Capítulo 2 — A casa", "Capítulo 3", "Epílogo",
    ]);
    expect(chapterHeadings(list, SHUNN.chapterHeading)[3]).toBe("Chapter 3");
    expect(chapterHeadings(list, "{title} ({n})")[3]).toBe("(3)");
    expect(chapterHeadings([], "{n}")).toEqual([]);
  });

  it("fillTemplate fills known slots and leaves unknown ones", () => {
    expect(fillTemplate("{a} / {b} / {c}", { a: "x", b: 2 })).toBe("x / 2 / {c}");
    expect(fillTemplate("no slots", { a: 1 })).toBe("no slots");
    expect(fillTemplate("{toString}", {})).toBe("{toString}");
  });

  it("presets are plain data with unique ids", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(SHUNN.page).toEqual({ width: 612, height: 792, margin: 72 });
    expect(PTBR.page.width).toBeCloseTo(595.3);
    expect(presetById("ptbr")).toBe(PTBR);
    expect(presetById("nope")).toBe(PRESETS[0]);
  });
});
