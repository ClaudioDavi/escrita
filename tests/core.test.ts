import { describe, it, expect } from "vitest";
import { countWords, proseOnly } from "../src/core/wordcount";
import { parseBeats, parsePlaceholders, isBeatLine, isSceneBreakAt } from "../src/core/markers";
import { segment } from "../src/core/markdown";
import { planRenumber, chapterTitle, compareChapters } from "../src/core/book";
import { writingDay, daysBetween, lastDays } from "../src/core/dates";

describe("wordcount", () => {
  it("ignores frontmatter, comments, markup", () => {
    const md = "---\nstatus: rascunho\nsummary: um dois\n---\n# Título\n\nA chave estava — dentro do relógio. %% XXX: conferir %%\n\n---\n\n%% beat: cena b %%\n[[Maria|ela]] viu *tudo*.";
    expect(countWords(md)).toBe(10);
  });
  it("keeps contractions and hyphenated words whole", () => {
    expect(countWords("don't guarda-chuva d’água")).toBe(3);
  });
  it("keeps combining marks inside the word", () => {
    const decomposed = "ningue\u0301m sai\u0301da cora\u00e7a\u0303o";
    expect(countWords(decomposed)).toBe(3);
    expect(countWords(decomposed.normalize("NFC"))).toBe(3);
  });
  it("unclosed comment hides the rest", () => {
    expect(proseOnly("um %% dois três").trim()).toBe("um");
  });
});

describe("markers", () => {
  const text = "---\na: 1\n---\nprosa\n\n---\n\n%% beat: b %%\nescrito aqui\n\n---\n\n%% beat: c %%\n\n%% XXX: janela %%";
  it("parses beats and written state", () => {
    const b = parseBeats(text);
    expect(b.map((x) => [x.text, x.written])).toEqual([["b", true], ["c", false]]);
  });
  it("does not count a multi-line comment as written prose", () => {
    const t = "%% beat: a %%\n%% nota\nque continua\n%%\n\n%% beat: b %%\n%% nota\nlonga %% e escrito";
    expect(parseBeats(t).map((x) => [x.text, x.written])).toEqual([["a", false], ["b", true]]);
  });
  it("parses placeholders", () => {
    expect(parsePlaceholders(text, "XXX").map((p) => p.text)).toEqual(["janela"]);
  });
  it("gives placeholders the right line numbers", () => {
    const t = "a\n%% XXX: um %% e %% XXX: dois %%\n\nb\n%% XXX %%\r\n%% XXX: três %%";
    expect(parsePlaceholders(t, "XXX").map((p) => [p.line, p.text])).toEqual([[1, "um"], [1, "dois"], [4, ""], [5, "três"]]);
  });
  it("matches markers ending in non-ASCII letters", () => {
    expect(parsePlaceholders("%% AÇÃ: ver %%", "AÇÃ").map((p) => p.text)).toEqual(["ver"]);
    expect(parsePlaceholders("%% PENDÊNCIÁ %%", "PENDÊNCIÁ")).toHaveLength(1);
  });
  it("does not treat a longer word as the marker", () => {
    expect(parsePlaceholders("%% XXX-foo %% %% XXXY: a %% %% AÇÃO: b %%", "XXX")).toEqual([]);
    expect(parsePlaceholders("%% AÇÃO: b %%", "AÇÃ")).toEqual([]);
  });
});

describe("book", () => {
  it("orders and renumbers", () => {
    const names = ["10 B", "2 A", "C"].sort(compareChapters);
    expect(names).toEqual(["2 A", "10 B", "C"]);
    expect(planRenumber(names, 2)).toEqual([
      { from: "2 A", to: "01 A" }, { from: "10 B", to: "02 B" }, { from: "C", to: "03 C" },
    ]);
    expect(chapterTitle("03 O porão")).toBe("O porão");
  });
});

describe("dates", () => {
  it("rolls the writing day over late", () => {
    expect(writingDay(new Date(2026, 8, 30, 1, 30), 2)).toBe("2026-09-29");
    expect(writingDay(new Date(2026, 8, 30, 1, 30), 0)).toBe("2026-09-30");
    expect(daysBetween("2026-09-29", "2027-03-01")).toBe(153);
    expect(lastDays("2026-09-29", 3)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29"]);
  });
});

describe("marker line predicates", () => {
  it("isBeatLine: a lone beat comment", () => {
    const md = segment("a\n\n%% beat: cena %%\ntexto");
    expect(isBeatLine(md, 2)).toBe(true);
    expect(isBeatLine(md, 0)).toBe(false);
    expect(isBeatLine(md, 3)).toBe(false);
    expect(isBeatLine(md, 99)).toBe(false);
  });
  it("isBeatLine: two comments, code and frontmatter are no beat", () => {
    expect(isBeatLine(segment("%% beat: a %% %% beat: b %%"), 0)).toBe(false);
    expect(isBeatLine(segment("```\n%% beat: a %%\n```"), 1)).toBe(false);
    expect(isBeatLine(segment("---\n%% beat: a %%\n---\nx"), 1)).toBe(false);
  });
  it("isSceneBreakAt: needs a blank line before, or the body start", () => {
    const md = segment("um\n---\n\ndois\n\n---\n\ntres");
    expect(isSceneBreakAt(md, 1)).toBe(false); // setext underline
    expect(isSceneBreakAt(md, 5)).toBe(true);
    expect(isSceneBreakAt(md, 0)).toBe(false);
  });
  it("isSceneBreakAt: first body line, and lines before the body", () => {
    const md = segment("---\nstatus: x\n---\n---\n\ntexto");
    expect(md.bodyLine).toBe(3);
    expect(isSceneBreakAt(md, 3)).toBe(true);
    expect(isSceneBreakAt(md, 0)).toBe(false);
    expect(isSceneBreakAt(md, 2)).toBe(false);
    expect(isSceneBreakAt(md, 2, 0)).toBe(false); // line 2 is a frontmatter fence, not prose
  });
  it("isSceneBreakAt: not inside code", () => {
    expect(isSceneBreakAt(segment("```\n\n---\n```"), 2)).toBe(false);
  });
});
