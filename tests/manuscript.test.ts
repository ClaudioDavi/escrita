import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { fixtureChapters } from "./support/export-fixture";
import { manuscriptOf, type Block } from "../src/core/manuscript";
import { MARKUP } from "../src/core/wordcount";
import { renderBlocks } from "./support/manuscript-md";

const FX = new URL("./fixtures/manuscript/", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, FX), "utf8");
const O = { placeholderMarker: "XXX" };
const md = (s: string, o: Partial<typeof O> & Record<string, unknown> = {}) => manuscriptOf(s, { ...O, ...o });
const body = (s: string, minHeading = 1) => renderBlocks(md(s).blocks, { minHeading });
const text = (b: Block) => (b.kind === "sceneBreak" ? "#" : b.runs.map((r) => r.text).join(""));

describe("manuscript fixtures", () => {
  for (const preset of ["shunn-en", "ptbr"]) {
    it(`conto body matches expected (${preset})`, () => {
      const exp = read(`expected/conto.${preset}.md`);
      const slice = exp.slice(exp.indexOf("\n\n", exp.indexOf("\n")+1) + 2);
      expect(body(read("conto.md"), 2)).toBe(slice);
    });

    it(`book parts match expected (${preset})`, () => {
      const exp = read(`expected/book.${preset}.md`);
      const chunks = exp.split(/^## (?=Prólogo|Chapter \d|Capítulo \d)/m);
      const front = chunks[0].split(/^---$/m).map((s) => s.trim());
      // [title block, dedication, epigraph, ""]
      const dir = "book/A Casa/";
      expect(body(read(dir + "Dedicatória.md")).trim()).toBe(front[1]);
      expect(body(read(dir + "Epígrafe.md")).trim()).toBe(front[2]);
      const files = fixtureChapters(fileURLToPath(new URL(dir + "Chapters", new URL("fixtures/manuscript/", import.meta.url)))).map((c) => c.file);
      files.forEach((f, i) => {
        const section = chunks[i + 1].split("\n").slice(1).join("\n").trim();
        expect(body(read(dir + "Chapters/" + f), 3).trim()).toBe(section);
      });
    });
  }

  it("a conto round-trips with no marker left", () => {
    const out = body(read("conto.md"), 2);
    for (const m of ["%%", "<!--", "![[", "[[", "]]", "XXX", "beat:"]) expect(out).not.toContain(m);
    expect(out).not.toMatch(/ {2}|[ \t]\n/);
  });

  it("reports placeholders and embeds with their file line", () => {
    const src = read("conto.md");
    const lines = src.split("\n");
    const r = md(src);
    expect(r.dropped).toEqual([
      { kind: "placeholder", line: lines.findIndex((l) => l.includes("XXX")), text: "conferir se a capa era amarela ou verde" },
      { kind: "embed", line: lines.findIndex((l) => l.includes("![[")), text: "foto.png" },
    ]);
  });
});

describe("manuscriptOf", () => {
  it("pins the MARKUP entries it reads", () => {
    expect(MARKUP[0].re.source).toContain("!\\[\\[");
    expect(MARKUP[1].re.source).toContain("!\\[");
    expect(MARKUP[2].keep).toBe(2);
    expect(MARKUP[3].keep).toBe(1);
  });

  it("is total on empty and comment-only notes", () => {
    expect(md("")).toEqual({ blocks: [], dropped: [] });
    expect(md("%% beat: x %%\n").blocks).toEqual([]);
    expect(md("---\na: 1\n---\n").blocks).toEqual([]);
  });

  it("reads emphasis into run flags", () => {
    expect(md("a *b* **c** ***d*** _e_ __f__").blocks).toEqual([
      { kind: "paragraph", runs: [
        { text: "a " }, { text: "b", italic: true }, { text: " " }, { text: "c", bold: true }, { text: " " },
        { text: "d", italic: true, bold: true }, { text: " " }, { text: "e", italic: true }, { text: " " }, { text: "f", bold: true },
      ] },
    ]);
  });

  it("keeps unmatched marks and intraword underscores literal", () => {
    expect(text(md("2 * 3 e snake_case_name e *aberto").blocks[0])).toBe("2 * 3 e snake_case_name e *aberto");
    expect(text(md("\\*não\\*").blocks[0])).toBe("*não*");
  });

  it("turns links into text, drops embeds and images, keeps bare urls", () => {
    const r = md("[[A|B]] [[C]] [x](http://u) ![i](p.png) ![[e.png]] http://site.com");
    expect(text(r.blocks[0])).toBe("B C x http://site.com");
    expect(r.dropped.map((d) => d.text)).toEqual(["p.png", "e.png"]);
  });

  it("keeps a line break as \\n, or a space with strictLineBreaks", () => {
    expect(text(md("um\ndois").blocks[0])).toBe("um\ndois");
    expect(text(md("um\ndois", { strictLineBreaks: true }).blocks[0])).toBe("um dois");
  });

  it("removes inline comments with the space before them", () => {
    expect(text(md("a %% x %% b <!-- y -->\n").blocks[0])).toBe("a b");
    expect(md("um\n%% beat %%\n\ndois").blocks.map(text)).toEqual(["um", "dois"]);
  });

  it("drops scene breaks at the edges and doubled ones", () => {
    expect(md("\n---\n\na\n\n---\n\n---\n\nb\n\n---\n").blocks.map(text)).toEqual(["a", "#", "b"]);
    expect(md("a\n\n* * *\n\nb").blocks.map((b) => b.kind)).toEqual(["paragraph", "sceneBreak", "paragraph"]);
  });

  it("reads quotes, callouts and headings", () => {
    const r = md("> [!note] Título\n> um\n> dois\n>\n> três\n\n## H *x*\n\nsetext\n---\n");
    expect(r.blocks.map((b) => b.kind)).toEqual(["quote", "quote", "heading", "heading"]);
    expect(r.blocks.map(text)).toEqual(["um\ndois", "três", "H x", "setext"]);
    expect((r.blocks[3] as { level: number }).level).toBe(2);
  });

  it("keeps list marks as text, code plain, math as text", () => {
    const r = md("- um\n- dois\n\n**a `b*c` d**\n\n$$x*y$$");
    expect(r.blocks.map(text)).toEqual(["- um", "- dois", "a b*c d", "$$x*y$$"]);
    expect(r.blocks[2]).toEqual({ kind: "paragraph", runs: [{ text: "a ", bold: true }, { text: "b*c" }, { text: " d", bold: true }] });
  });

  it("hides what follows an unclosed comment and reports it once", () => {
    const r = md("a\n\nb %% nunca fecha\n\n<!-- x");
    expect(r.blocks.map(text)).toEqual(["a", "b"]);
    expect(r.dropped).toEqual([{ kind: "unclosedComment", line: 2, text: "" }]);
    const h = md("a\n\nb\n<!-- sem fim\n\nc");
    expect(h.blocks.map(text)).toEqual(["a", "b"]);
    expect(h.dropped).toEqual([{ kind: "unclosedComment", line: 3, text: "" }]);
  });

  it("keeps a mid-line <!-- as literal text (D11)", () => {
    const r = md("a <!-- x\n\nb");
    expect(r.blocks.map(text)).toEqual(["a <!-- x", "b"]);
    expect(r.dropped.some((d) => d.kind === "unclosedComment")).toBe(false);
  });

  it("drops the title heading only when it is first and equal", () => {
    expect(md("# A Visita\n\nx", { dropTitleHeading: " a visita " }).blocks.map(text)).toEqual(["x"]);
    expect(md("x\n\n# A Visita", { dropTitleHeading: "a visita" }).blocks.map(text)).toEqual(["x", "A Visita"]);
    expect(md("# A chegada\n\nx", { dropTitleHeading: ["Chapter 1: A chegada", " a CHEGADA"] }).blocks.map(text)).toEqual(["x"]);
    expect(md("# Outro\n\nx", { dropTitleHeading: ["Chapter 1", "A chegada"] }).blocks.map(text)).toEqual(["Outro", "x"]);
    expect(md("# A Visita\n\nx").blocks.map(text)).toEqual(["A Visita", "x"]);
  });

  it("accepts an existing segmentation and CRLF text", () => {
    expect(md("a\r\n\r\nb\r\n").blocks.map(text)).toEqual(["a", "b"]);
  });
});

describe("embed positions", () => {
  it("an image after a long wiki embed reports its own line", () => {
    const m = md("![[a-very-long-image-name.png]]\n![](b.png)");
    const embeds = m.dropped.filter((d) => d.kind === "embed");
    expect(embeds.map((d) => [d.line, d.text])).toEqual([[0, "a-very-long-image-name.png"], [1, "b.png"]]);
  });
});
