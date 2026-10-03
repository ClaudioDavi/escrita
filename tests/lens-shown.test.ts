import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { analyze } from "../src/lens/analyze";
import { dismissalOf } from "../src/lens/dismiss";
import { listsTarget, selectionRange, shownResult } from "../src/lens/shown";
import type { AnalyzeOptions } from "../src/lens/analyze";
import type { RuleId } from "../src/lens/types";

const OPTS: AnalyzeOptions = {
  lang: "en", rules: new Set<RuleId>(["crutch"]), echoWindow: 40, longSentence: 45,
  lists: { crutch: ["suddenly"], names: [], ignore: [] },
  skipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank",
};
const TEXT = "Suddenly the door opened. He waited. Suddenly the lamp went out.";

describe("shownResult", () => {
  const r = analyze(segment(TEXT), OPTS, 3);
  it("is the same object with no dismissals", () => {
    expect(shownResult(r, TEXT, undefined)).toBe(r);
    expect(shownResult(r, TEXT, [])).toBe(r);
  });
  it("hides only the dismissed occurrence and recounts", () => {
    expect(r.counts.crutch).toBe(2);
    const second = r.matches[1];
    const shown = shownResult(r, TEXT, [dismissalOf(TEXT, second)]);
    expect(shown.matches).toEqual([r.matches[0]]);
    expect(shown.counts.crutch).toBe(1);
    expect(shown.version).toBe(3);
    expect(shown.pass).toBe(r.pass);
  });
});

describe("listsTarget", () => {
  it("uses the setting when set", () => expect(listsTarget("Modelos/Lista", "en")).toBe("Modelos/Lista.md"));
  it("falls back by language, pt-BR when none", () => {
    expect(listsTarget("", "en")).toBe("Word lists.md");
    expect(listsTarget("", "pt-BR")).toBe("Listas de palavras.md");
    expect(listsTarget("  ", null)).toBe("Word lists.md");
  });
});

describe("selectionRange", () => {
  it("ignores carets and the stepped match", () => {
    expect(selectionRange([{ from: 3, to: 3 }], null)).toBeNull();
    expect(selectionRange([{ from: 3, to: 9 }], { from: 3, to: 9 })).toBeNull();
  });
  it("takes the first non-empty range", () => {
    expect(selectionRange([{ from: 1, to: 1 }, { from: 3, to: 9 }], { from: 0, to: 2 })).toEqual({ from: 3, to: 9 });
  });
});

describe("listsTarget with no lens language", () => {
  it("defaults to English, and follows the language when known", async () => {
    const { listsTarget } = await import("../src/lens/shown");
    expect(listsTarget("", null)).toBe("Word lists.md");
    expect(listsTarget("", "en")).toBe("Word lists.md");
    expect(listsTarget("", "pt-BR")).toBe("Listas de palavras.md");
    expect(listsTarget("Notas/Minhas", null)).toBe("Notas/Minhas.md");
  });
});
