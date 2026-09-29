import { describe, it, expect } from "vitest";
import { countWords, proseOnly } from "../src/core/wordcount";
import { parseBeats, parsePlaceholders } from "../src/core/markers";
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
