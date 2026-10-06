import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readerBlocks } from "../src/outline/reader-model";
import { manuscriptOf } from "../src/core/manuscript";

const dir = "tests/fixtures/manuscript/";
const read = (p: string) => readFileSync(dir + p, "utf8");
const O = { placeholderMarker: "XXX" };
const chapter = (n: string) => read(`book/A Casa/Chapters/${n}.md`);

describe("readerBlocks (N 8, Q14, Q20)", () => {
  it("hides markers and frontmatter, keeps scene breaks, with source lines", () => {
    const text = chapter("01 A chegada");
    const lines = text.split("\n");
    const blocks = readerBlocks(text, O);
    expect(blocks.map((b) => b.text)).toEqual([
      "Helena desceu do ônibus com duas malas e a *certeza* de que voltaria. Maria esperava no portão.",
      "— Demorou — disse Maria.",
      "---",
      "À noite, a casa rangeu pela primeira vez.",
    ]);
    for (const b of blocks) expect(b.line).toBeGreaterThanOrEqual(0);
    expect(lines[blocks[0].line]).toMatch(/^Helena desceu/);
    expect(lines[blocks[1].line]).toMatch(/^— Demorou/);
    expect(lines[blocks[2].line]).toBe("---");
    expect(lines[blocks[3].line]).toMatch(/^À noite/);
  });

  it("matches the manuscript model block for block on every fixture chapter", () => {
    for (const n of ["00 Prólogo", "01 A chegada", "02 Rascunho", "03 A casa"]) {
      const text = chapter(n);
      const m = manuscriptOf(text, O).blocks;
      const r = readerBlocks(text, O);
      expect(r.length).toBe(m.length);
      expect(r.map((b) => b.line)).toEqual(m.map((b) => b.line));
      expect(r.map((b) => b.text === "---")).toEqual(m.map((b) => b.kind === "sceneBreak"));
    }
  });

  it("reads the conto: no beats, placeholders, comments or embeds; headings and quotes kept", () => {
    const text = read("conto.md");
    const lines = text.split("\n");
    const blocks = readerBlocks(text, O);
    const all = blocks.map((b) => b.text).join("\n\n");
    expect(all).not.toMatch(/%%|<!--|beat|XXX|foto\.png|\[\[|---\s*\n?status/);
    expect(all).toContain("## Interlúdio");
    expect(all).toContain("> A memória é uma casa onde os móveis mudam de lugar à noite.");
    expect(all).toContain("**inconfundível**");
    expect(all).toContain("pareceu *prender a respiração* junto com ela.");
    expect(all).toContain("Maria era o nome");
    expect(blocks.filter((b) => b.text === "---")).toHaveLength(2);
    expect(blocks[0].text.startsWith("Era uma quinta-feira")).toBe(true);
    expect(lines[blocks[0].line]).toMatch(/^Era uma quinta-feira/);
    const h = blocks.find((b) => b.text === "## Interlúdio")!;
    expect(lines[h.line]).toBe("## Interlúdio");
    // lines strictly increase
    for (let i = 1; i < blocks.length; i++) expect(blocks[i].line).toBeGreaterThan(blocks[i - 1].line);
  });

  it("an inline marker takes its leading space and leaves no stray space", () => {
    const text = chapter("01 A chegada");
    expect(readerBlocks(text, O).some((b) => /  | $/.test(b.text))).toBe(false);
    const conto = readerBlocks(read("conto.md"), O).map((b) => b.text);
    expect(conto.some((t) => t.includes("assoalho que Helena") || t.includes("no assoalho"))).toBe(true);
    expect(conto.some((t) => / {2}| $/.test(t))).toBe(false);
  });

  it("the marker word comes from settings", () => {
    const text = "Antes.\n\n%% TODO: fix %%\n\nDepois.\n\n%% XXX: kept visible? no, comment %%\n";
    expect(readerBlocks(text, { placeholderMarker: "TODO" }).map((b) => b.text)).toEqual(["Antes.", "Depois."]);
  });

  it("an unclosed comment hides everything after it", () => {
    const text = "Um.\n\n%% sem fim\n\nDois.\n";
    expect(readerBlocks(text, O).map((b) => b.text)).toEqual(["Um."]);
    const html = "Um.\n\n<!-- sem fim\n\nDois.\n";
    expect(readerBlocks(html, O).map((b) => b.text)).toEqual(["Um."]);
  });

  it("a scene break at the edge or doubled is not shown, like the export", () => {
    const text = "---\n\nUm.\n\n---\n\n---\n\nDois.\n\n---\n";
    expect(readerBlocks(text, O).map((b) => b.text)).toEqual(["Um.", "---", "Dois."]);
  });

  it("lines count the frontmatter", () => {
    const text = "---\ntitle: x\n---\n\nPrimeiro.\n\nSegundo.\n";
    expect(readerBlocks(text, O)).toEqual([
      { text: "Primeiro.", line: 4 },
      { text: "Segundo.", line: 6 },
    ]);
  });

  it("round-trips emphasis and escapes literal marks so the renderer shows the same text", () => {
    const text = "Um *a* e **b** e ***c*** e 2 * 3 e snake_case.\n\nVerso um\nverso dois\n\n> citação\n> segunda linha\n";
    const [p, v, q] = readerBlocks(text, O).map((b) => b.text);
    expect(p).toBe("Um *a* e **b** e ***c*** e 2 \\* 3 e snake\\_case.");
    expect(v).toBe("Verso um\nverso dois");
    expect(q).toBe("> citação\n> segunda linha");
  });

  it("empty and comment-only chapters give no blocks", () => {
    expect(readerBlocks("", O)).toEqual([]);
    expect(readerBlocks("---\nstatus: x\n---\n\n%% beat: só isto %%\n", O)).toEqual([]);
  });
});
