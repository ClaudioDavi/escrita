import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { analyze, measuresFor, visible, type AnalyzeOptions } from "../src/lens/analyze";
import { readMask } from "../src/core/wordcount";
import { parseLists } from "../src/lens/lists";
import { ALL_RULES, RULES, type Lists, type LensLang, type RuleId } from "../src/lens/types";

const fixture = (n: string) => readFileSync(new URL(`./fixtures/lens/${n}`, import.meta.url), "utf8");
const conto = fixture("conto.pt.md");
const essay = fixture("essay.en.md");

const PT_LISTS = parseLists("## Vícios\nde repente\ncomeçou a\nmeio que\nviu\nouviu\nsentiu\npercebeu\n\n## Nomes\nTeo\nMariana\n\n## Ignorar\n");
const EN_LISTS = parseLists("## Crutch words\nall of a sudden\nstarted to\nsort of\nfelt\nnoticed\nsaw\n\n## Names\nJames\nAnna\n\n## Ignore\n");

function opts(lang: LensLang | null, over: Partial<AnalyzeOptions> = {}): AnalyzeOptions {
  const lists: Lists = lang === "en" ? EN_LISTS : PT_LISTS;
  return {
    lang, rules: new Set<RuleId>(RULES), echoWindow: 40, longSentence: 45, lists,
    skipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank", ...over,
  };
}
const run = (text: string, o: AnalyzeOptions) => analyze(segment(text), o);
const lineOf = (text: string, at: number) => text.slice(0, at).split("\n").length;
const summary = (text: string, o: AnalyzeOptions) =>
  run(text, o).matches.map((m) => `${lineOf(text, m.from)} ${m.rule}/${m.kind} ${JSON.stringify(m.text)}`);

describe("lens analyze: fixtures", () => {
  it("conto.pt.md matches", () => expect(summary(conto, opts("pt-BR"))).toMatchSnapshot());
  it("essay.en.md matches", () => expect(summary(essay, opts("en"))).toMatchSnapshot());

  it("measures and readability are pinned", () => {
    const pin = (text: string, lang: LensLang) => {
      const r = run(text, opts(lang));
      const m = r.measures;
      return {
        words: m.words, speech: m.speech, sentences: m.sentences, syllables: m.syllables, scenes: m.scenes.length,
        raw: m.readability ? Number(m.readability.raw.toFixed(2)) : null, band: m.readability?.band ?? null,
        counts: r.counts,
      };
    };
    expect({ pt: pin(conto, "pt-BR"), en: pin(essay, "en") }).toMatchSnapshot();
  });
});

describe("lens analyze: skipped text", () => {
  it("never reads frontmatter, comments, beats, code, math, headings or link targets", () => {
    const text = [
      "---", "title: palavrinha palavrinha", "---", "",
      "# Titulozinho titulozinho", "",
      "%% comentario comentario %%", "", "%% beat: cenazinha cenazinha %%", "",
      "```", "codigozinho codigozinho", "```", "",
      "$$", "matematica matematica", "$$", "",
      "Ver [[alvozinho|rotulo]] e [texto](http://exemplo.com/caminho) aqui.",
    ].join("\n");
    const r = run(text, opts("en"));
    const words = r.pass.tokens.map((t) => t.text);
    expect(words).toEqual(["Ver", "rotulo", "e", "texto", "aqui"]);
    expect(r.words).toBe(5);
  });

  it("keeps offsets", () => {
    const text = "# Head\n\nOne two.\n";
    expect(readMask(segment(text), opts("en")).length).toBe(text.length);
  });

  it("> lines: skipped with skipQuotes, read without", () => {
    const text = "> quoted words here\n\nplain words.";
    expect(run(text, opts("en", { skipQuotes: true })).pass.tokens.map((t) => t.text)).toEqual(["plain", "words"]);
    expect(run(text, opts("en", { skipQuotes: false })).pass.tokens.map((t) => t.text)).toEqual(["quoted", "words", "here", "plain", "words"]);
  });

  it("a heading's words give no matches and are not counted; echoes do not cross it", () => {
    const text = "# Window window window\n\nThe window opened.\n\n# Another heading\n\nThe window closed.";
    const r = run(text, opts("en"));
    expect(r.matches.filter((m) => m.rule === "echo")).toEqual([]);
    expect(r.words).toBe(6);
    expect(r.pass.tokens.some((t) => t.from < 22)).toBe(false);
  });
});

describe("lens analyze: rules switches", () => {
  it("disabled rules give no matches and a 0 count", () => {
    const r = run(conto, opts("pt-BR", { rules: new Set<RuleId>(["crutch"]) }));
    expect(r.matches.length).toBeGreaterThan(0);
    expect(r.matches.every((m) => m.rule === "crutch")).toBe(true);
    for (const id of RULES) if (id !== "crutch") expect(r.counts[id]).toBe(0);
  });

  it("lang null: no echo, adverb or gerund matches, null readability, other rules still run", () => {
    const r = run(conto, opts(null));
    for (const id of ["echo", "adverb", "gerund"] as const) expect(r.counts[id]).toBe(0);
    expect(r.measures.readability).toBeNull();
    expect(r.counts.crutch).toBeGreaterThan(0);
    expect(r.counts.name).toBeGreaterThan(0);
    expect(r.counts.long).toBeGreaterThan(0);
  });

  it("matches are sorted by from, then rule order, and counts agree", () => {
    const r = run(conto, opts("pt-BR"));
    for (let i = 1; i < r.matches.length; i++) {
      const a = r.matches[i - 1];
      const b = r.matches[i];
      expect(a.from < b.from || (a.from === b.from && ALL_RULES.indexOf(a.rule) <= ALL_RULES.indexOf(b.rule))).toBe(true);
    }
    expect(RULES.reduce((n, id) => n + r.counts[id], 0)).toBe(r.matches.length);
  });
});

describe("lens analyze: visible and measuresFor", () => {
  it("visible returns the matches overlapping a range, including a long one that starts before it", () => {
    const r = run(conto, opts("pt-BR"));
    const long = r.matches.find((m) => m.rule === "long")!;
    const mid = Math.floor((long.from + long.to) / 2);
    const v = visible(r.matches, mid, mid + 1);
    expect(v).toContain(long);
    const brute = r.matches.filter((m) => m.to > 100 && m.from < 900);
    expect(visible(r.matches, 100, 900)).toEqual(brute);
    expect(visible(r.matches, 0, 0)).toEqual([]);
  });

  it("measuresFor slices the pass", () => {
    const md = segment(conto);
    const r = analyze(md, opts("pt-BR"));
    const whole = measuresFor(r.pass, md, opts("pt-BR"), { from: 0, to: conto.length });
    expect(whole.words).toBe(r.measures.words);
    const half = measuresFor(r.pass, md, opts("pt-BR"), { from: 0, to: Math.floor(conto.length / 2) });
    expect(half.words).toBeGreaterThan(0);
    expect(half.words).toBeLessThan(r.measures.words);
    expect(half.scenes).toEqual([]);
  });
});
