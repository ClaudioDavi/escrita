import { describe, it, expect } from "vitest";
import { segment } from "../src/core/markdown";
import { countWords, readerMask } from "../src/core/wordcount";
import { tokens } from "../src/core/tokens";

// Texts copied from the rows of markdown-consumers.test.ts, plus markup-heavy ones.
const TEXTS: string[] = [
  "",
  "Ela abriu a porta.\n\nE saiu.",
  "---\na: 1\nprosa aqui",
  "---\na: 1\n...\nprosa",
  "---\r\na: 1\r\n---\r\nprosa\r\n%% XXX: x %%\r\n",
  "a\n  ```\n%% XXX: in %%\n  ```\nb",
  "~~~\nx %% y\n~~~\nz",
  "a %% one\ntwo %% b\n\nc",
  "use `%%` here\nand more",
  "A %% XXX: um %% e %% XXX %%.\n",
  "# Título\n\n- um item\n- [ ] tarefa\n1. primeiro\n\n> citação aqui\n> [!note] Nota\n> corpo\n",
  "Veja [[Maria|a moça]] e [[Contos/O porão]] e ![[img.png]] e ![alt](x.png).\n",
  "Um [link](https://example.com/a) e https://example.com/b solto #tag fim.\n",
  "a\n\n---\n\nb\n\n* * *\n\nc\r\n",
];

describe("readerMask", () => {
  for (const nl of ["\n", "\r\n"]) {
    for (const [i, t0] of TEXTS.entries()) {
      const t = nl === "\n" ? t0 : t0.replace(/\r?\n/g, "\r\n");
      it(`keeps length and line breaks (${nl === "\n" ? "LF" : "CRLF"} #${i})`, () => {
        const mask = readerMask(segment(t));
        expect(mask.length).toBe(t.length);
        for (let k = 0; k < t.length; k++) {
          if (t[k] === "\n" || t[k] === "\r") expect(mask[k]).toBe(t[k]);
        }
      });
    }
  }

  it("matches the word count", () => {
    for (const t of TEXTS) {
      expect(tokens(readerMask(segment(t))).length, JSON.stringify(t)).toBe(countWords(t));
    }
  });

  it("keeps the alias of a wikilink and blanks the target", () => {
    const t = "[[Maria|a moça]] entrou";
    const m = readerMask(segment(t));
    expect(tokens(m).map((x) => x.text)).toEqual(["a", "moça", "entrou"]);
    expect(tokens(m)[0].from).toBe(t.indexOf("a moça"));
  });

  it("keeps a bare wikilink target as words", () => {
    expect(tokens(readerMask(segment("[[Contos/O porão]]"))).map((x) => x.text)).toEqual(["Contos", "O", "porão"]);
  });

  it("blanks embeds, images, urls, tags and md link targets", () => {
    const m = readerMask(segment("![[a.png]] ![x](y.png) https://e.com/z #tag [texto](u) fim"));
    expect(tokens(m).map((x) => x.text)).toEqual(["texto", "fim"]);
  });

  it("blanks scene breaks and marks but keeps heading text", () => {
    const t = "# Título\n\n- item\n\n> citação\n\n---\n\n1. um\n";
    const m = readerMask(segment(t));
    expect(tokens(m).map((x) => x.text)).toEqual(["Título", "item", "citação", "um"]);
    expect(m).not.toContain("#");
    expect(m).not.toContain("---");
  });

  it("blanks code, comments and frontmatter", () => {
    const m = readerMask(segment("---\na: 1\n---\nprosa %% nota %% `código` fim"));
    expect(tokens(m).map((x) => x.text)).toEqual(["prosa", "fim"]);
  });
});
