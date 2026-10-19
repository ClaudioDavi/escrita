import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { analyze, type AnalyzeOptions } from "../src/lens/analyze";
import { rhythmAt } from "../src/lens/rhythm";
import { RULES, type LensPass, type RuleId } from "../src/lens/types";

const opts: AnalyzeOptions = {
  lang: "en", rules: new Set<RuleId>(RULES), echoWindow: 40, longSentence: 45,
  lists: { crutch: [], names: [], ignore: [] },
  skipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank",
};
const passOf = (text: string, o: Partial<AnalyzeOptions> = {}): LensPass => analyze(segment(text), { ...opts, ...o }).pass;

/** A sentence of `n` words. */
const sent = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? "Word" : "word")).join(" ") + ".";
const para = (...ns: number[]) => ns.map(sent).join(" ");
const widths = (text: string, o: Partial<AnalyzeOptions> = {}) => {
  const p = passOf(text, o);
  return Array.from(p.sentenceWords);
};

describe("pass: sentence words and paragraphs", () => {
  it("counts the words of each sentence", () => {
    expect(widths(para(3, 5, 1))).toEqual([3, 5, 1]);
  });
  it("numbers paragraphs by blank lines", () => {
    const p = passOf(`${para(2, 2)}\n\n${para(3)}\n\n\n${para(4, 4)}`);
    expect(Array.from(p.sentencePara)).toEqual([0, 0, 1, 2, 2]);
  });
  it("keeps a single line break inside a paragraph", () => {
    const p = passOf(`${sent(2)}\n${sent(3)}`);
    expect(Array.from(p.sentencePara)).toEqual([0, 0]);
  });
  it("is empty for an empty note", () => {
    const p = passOf("");
    expect(p.sentenceWords.length).toBe(0);
    expect(p.sentencePara.length).toBe(0);
  });
  it("the long-sentence rule still reads the same counts", () => {
    const r = analyze(segment(`${sent(5)} ${sent(12)}`), { ...opts, longSentence: 10 });
    expect(r.matches.filter((m) => m.rule === "long").map((m) => m.text.split(" ").length)).toEqual([12]);
  });
});

describe("rhythmAt: the paragraph at the cursor", () => {
  const text = `${para(8, 9, 10, 20)}\n\n${para(5, 30)}`;
  const pass = passOf(text);
  const second = text.indexOf("Word word word word word.");

  it("takes the sentences of the cursor's paragraph only", () => {
    const r = rhythmAt(pass, { from: 3, to: 3 }, 45)!;
    expect(r.scope).toBe("paragraph");
    expect(r.bars.map((b) => b.words)).toEqual([8, 9, 10, 20]);
    const r2 = rhythmAt(pass, { from: second + 2, to: second + 2 }, 45)!;
    expect(r2.bars.map((b) => b.words)).toEqual([5, 30]);
  });
  it("bars carry exact offsets", () => {
    const r = rhythmAt(pass, { from: 0, to: 0 }, 45)!;
    expect(r.bars[0].from).toBe(0);
    expect(text.slice(r.bars[0].from, r.bars[0].to)).toBe(sent(8));
  });
  it("the cursor at the very start and the very end of a paragraph count", () => {
    expect(rhythmAt(pass, { from: 0, to: 0 }, 45)).not.toBeNull();
    const end = text.indexOf("\n\n");
    expect(rhythmAt(pass, { from: end, to: end }, 45)).not.toBeNull();
  });
  it("the gap between two sentences of a paragraph belongs to it", () => {
    const gap = sent(8).length; // the space after the first sentence
    expect(rhythmAt(pass, { from: gap, to: gap }, 45)!.bars).toHaveLength(4);
  });
  it("is null on the blank line between paragraphs", () => {
    const blank = text.indexOf("\n\n") + 1;
    expect(rhythmAt(pass, { from: blank, to: blank }, 45)).toBeNull();
  });
  it("is null when the note has no sentences", () => {
    expect(rhythmAt(passOf(""), { from: 0, to: 0 }, 45)).toBeNull();
  });
  it("is null before the first sentence", () => {
    const p = passOf(`\n\n${para(3)}`);
    expect(rhythmAt(p, { from: 0, to: 0 }, 45)).toBeNull();
  });
});

describe("rhythmAt: a selection", () => {
  const text = `${para(4, 5, 6)}\n\n${para(7, 8)}`;
  const pass = passOf(text);
  it("takes the sentences it overlaps, across paragraphs", () => {
    const from = text.indexOf("Word", sent(4).length + 1) + 2;
    const to = text.indexOf("Word word word word word word word.") + 3;
    const r = rhythmAt(pass, { from, to }, 45)!;
    expect(r.scope).toBe("selection");
    expect(r.bars.map((b) => b.words)).toEqual([5, 6, 7]);
  });
  it("a selection ending exactly where a sentence starts does not include it", () => {
    const s2 = pass.sentences[1].from;
    expect(rhythmAt(pass, { from: 0, to: s2 }, 45)!.bars.map((b) => b.words)).toEqual([4]);
  });
  it("a selection starting exactly at a sentence's end does not include it", () => {
    const e0 = pass.sentences[0].to;
    expect(rhythmAt(pass, { from: e0, to: e0 + 1 }, 45)).toBeNull();
    expect(rhythmAt(pass, { from: e0, to: e0 + 2 }, 45)!.bars.map((b) => b.words)).toEqual([5]);
  });
  it("is null when it touches no sentence", () => {
    const blank = text.indexOf("\n\n");
    expect(rhythmAt(pass, { from: blank, to: blank + 2 }, 45)).toBeNull();
  });
});

describe("rhythmAt: runs", () => {
  const run = (...ns: number[]) => {
    const text = para(...ns);
    return rhythmAt(passOf(text), { from: 0, to: 0 }, 45)!;
  };
  const flags = (r: ReturnType<typeof run>) => r.bars.map((b) => (b.run ? 1 : 0)).join("");

  it("three sentences within 3 words are a run", () => {
    const r = run(8, 9, 10);
    expect(flags(r)).toBe("111");
    expect(r.runLength).toBe(3);
  });
  it("spread of exactly 3 is a run, 4 is not", () => {
    expect(flags(run(8, 9, 11))).toBe("111");
    expect(flags(run(8, 9, 12))).toBe("000");
  });
  it("two sentences are not a run", () => {
    const r = run(8, 8);
    expect(flags(r)).toBe("00");
    expect(r.runLength).toBe(0);
  });
  it("the spread is the window's max minus min, not between neighbours", () => {
    // 8, 10, 12: neighbours differ by 2, the window by 4
    expect(flags(run(8, 10, 12))).toBe("000");
  });
  it("a run is taken greedily from the left", () => {
    // 8 9 10 | 14 15 16: the second window starts after the first breaks
    const r = run(8, 9, 10, 14, 15, 16);
    expect(flags(r)).toBe("111111");
    expect(r.runLength).toBe(3);
  });
  it("runLength is the longest of several runs", () => {
    const r = run(5, 5, 5, 20, 9, 9, 10, 9);
    expect(flags(r)).toBe("11101111");
    expect(r.runLength).toBe(4);
  });
  it("a greedy window leaves the break sentence to start the next run", () => {
    // 10 10 10 14 14 14: 14 - 10 = 4 breaks the window at the fourth
    expect(flags(run(10, 10, 10, 14, 14, 14))).toBe("111111");
  });
  it("a short stretch before a run is not marked", () => {
    expect(flags(run(30, 10, 10, 10))).toBe("0111");
  });
  it("one sentence has no run", () => {
    expect(run(7).runLength).toBe(0);
  });
});

describe("rhythmAt: long sentences", () => {
  const at = (ns: number[], long: number) => rhythmAt(passOf(para(...ns)), { from: 0, to: 0 }, long)!;
  it("long is strictly over the setting, as the rule", () => {
    const r = at([20, 21], 20);
    expect(r.bars.map((b) => b.long)).toEqual([false, true]);
    expect(r.hasLong).toBe(true);
  });
  it("no long sentence", () => {
    expect(at([5, 30], 45).hasLong).toBe(false);
  });
  it("a long sentence can sit inside a run", () => {
    const r = at([20, 21, 22], 20);
    expect(r.runLength).toBe(3);
    expect(r.bars.map((b) => b.long)).toEqual([false, true, true]);
  });
  it("agrees with the long-sentences rule", () => {
    const text = para(5, 12, 30, 3);
    const res = analyze(segment(text), { ...opts, longSentence: 10 });
    const bars = rhythmAt(res.pass, { from: 0, to: 0 }, 10)!.bars.filter((b) => b.long);
    expect(bars.map((b) => [b.from, b.to])).toEqual(res.matches.filter((m) => m.rule === "long").map((m) => [m.from, m.to]));
  });
});
