import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { segment } from "../../src/core/markdown";
import { analyze, measuresFor, visible, type AnalyzeOptions } from "../../src/lens/analyze";
import { parseLists } from "../../src/lens/lists";
import { RULES, type Lists, type LensLang, type RuleId } from "../../src/lens/types";

const conto = readFileSync(new URL("../fixtures/lens/conto.pt.md", import.meta.url), "utf8");

const PT_LISTS = parseLists("## Vícios\nde repente\ncomeçou a\nmeio que\nviu\nouviu\nsentiu\npercebeu\n\n## Nomes\nTeo\nMariana\n\n## Ignorar\n");

function opts(lang: LensLang | null, over: Partial<AnalyzeOptions> = {}): AnalyzeOptions {
  const lists: Lists = PT_LISTS;
  return {
    lang, rules: new Set<RuleId>(RULES), echoWindow: 40, longSentence: 45, lists,
    skipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank", ...over,
  };
}

describe("lens analyze: performance", () => {
  const big = (() => {
    const body = conto.replace(/^---[\s\S]*?---\n/, "");
    const words = body.split(/\s+/).length;
    return Array.from({ length: Math.ceil(10000 / words) }, () => body).join("\n\n");
  })();
  const o = opts("pt-BR");
  const md = segment(big);
  const time = <T>(f: () => T): [T, number] => {
    const t = performance.now();
    const v = f();
    return [v, performance.now() - t];
  };

  it("CI ceiling: analyze under 300 ms, visible under 1 ms, measuresFor under 5 ms", () => {
    analyze(md, o);
    const [r, ms] = time(() => analyze(md, o));
    expect(r.words).toBeGreaterThanOrEqual(9000);
    expect(ms).toBeLessThan(300);
    const mid = Math.floor(big.length / 2);
    expect(time(() => visible(r.matches, mid, mid + 3000))[1]).toBeLessThan(1);
    expect(time(() => measuresFor(r.pass, md, o, { from: mid, to: mid + 600 }))[1]).toBeLessThan(5);
  });

  // Timing under a parallel suite is noisy; run alone with ESCRITA_PERF=1 to check it.
  it.runIf(!!process.env.ESCRITA_PERF)("local budget: median of 5 analyze runs under 60 ms", () => {
    analyze(md, o);
    const ts = Array.from({ length: 5 }, () => time(() => analyze(md, o))[1]).sort((a, b) => a - b);
    expect(ts[2]).toBeLessThan(60);
  });
});
