import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { sentences } from "../src/core/sentences";
import { tokens } from "../src/core/tokens";
import { measures, passExtras, sceneBounds } from "../src/lens/measures";
import type { LensLang, LensPass, ReadOptions } from "../src/lens/types";

type O = ReadOptions & { lang: LensLang | null };
const base: O = { skipQuotes: true, quoteStyle: "curly", paragraphStyle: "blank", lang: "pt-BR" };

function build(text: string, o: Partial<O> = {}) {
  const opts = { ...base, ...o };
  const md = segment(text);
  const mask = md.masked();
  const toks = tokens(mask);
  const sents = sentences(mask, md, opts.lang === "en" ? "en" : opts.lang ? "pt" : null);
  const pass: LensPass = { mask, tokens: toks, sentences: sents, ...passExtras(md, toks, opts) };
  return { md, pass, opts };
}
const share = (text: string, o: Partial<O> = {}) => {
  const { md, pass, opts } = build(text, o);
  const m = measures(md, pass, opts);
  return m.words === 0 ? 0 : (100 * m.speech) / m.words;
};

describe("dialogue share", () => {
  it("is 0 with no dialogue", () => {
    expect(share("Ela andou pela casa vazia.\n\nO sol caiu.")).toBe(0);
  });
  it("is 100 for only speech lines", () => {
    expect(share("— Vamos embora agora.\n\n— Sim, vamos logo.")).toBe(100);
  });
  it("counts dash dialogue with tags, tag words as narration", () => {
    const { md, pass, opts } = build("— Vamos embora — disse ela.");
    const m = measures(md, pass, opts);
    expect(m.words).toBe(4);
    expect(m.speech).toBe(2);
  });
  it("handles curly and off quote styles", () => {
    const t = "Ela disse “vamos embora agora” e saiu.";
    const curly = measures(...args(build(t, { quoteStyle: "curly" })));
    expect(curly.speech).toBe(3);
    const g = "Ela disse «vamos embora agora» e saiu.";
    expect(measures(...args(build(g, { quoteStyle: "guillemets" }))).speech).toBe(3);
    const off = measures(...args(build(g, { quoteStyle: "off" })));
    expect(off.speech).toBe(0);
  });
  it("handles single and blank paragraph styles", () => {
    const t = "— Vamos embora\nagora mesmo.\n\nNarração aqui.";
    const single = measures(...args(build(t, { paragraphStyle: "single" })));
    const blank = measures(...args(build(t, { paragraphStyle: "blank" })));
    expect(single.speech).toBeGreaterThan(0);
    expect(blank.speech).toBeGreaterThanOrEqual(single.speech);
    expect(blank.speech).toBeLessThanOrEqual(blank.words);
  });
  it("never goes above 100", () => {
    expect(share("— a b c d e f g\n\n“h i j” k")).toBeLessThanOrEqual(100);
  });
});

function args(b: ReturnType<typeof build>): [typeof b.md, typeof b.pass, typeof b.opts] {
  return [b.md, b.pass, b.opts];
}

describe("scenes", () => {
  const two = "— Um dois três.\n\nNarra aqui agora.\n\n---\n\nSó narração nesta cena aqui.";
  it("gives a share per scene when there are two", () => {
    const m = measures(...args(build(two)));
    expect(m.scenes).toHaveLength(2);
    expect(m.scenes[0].words).toBe(6);
    expect(m.scenes[0].speech).toBe(3);
    expect(m.scenes[1].speech).toBe(0);
    expect(m.scenes[1].words).toBe(5);
  });
  it("gives none with one scene", () => {
    expect(measures(...args(build("Uma cena só.\n\nOutra linha."))).scenes).toEqual([]);
  });
  it("splits at real breaks only and skips frontmatter", () => {
    const md = segment("---\ntitle: x\n---\nUm.\n\n---\n\nDois.\n\n```\n---\n```\n");
    const b = sceneBounds(md);
    expect(b).toHaveLength(2);
    expect(md.text.slice(b[0].from, b[0].to)).toBe("Um.\n");
    expect(md.text.slice(b[1].from, b[1].to).startsWith("\nDois.")).toBe(true);
  });
  it("leaves scenes empty for a range", () => {
    const b = build(two);
    expect(measures(b.md, b.pass, b.opts, { from: 0, to: 20 }).scenes).toEqual([]);
  });
});

describe("range", () => {
  const text = "Primeira frase aqui. Segunda frase vem.\n\n— Fala de alguém agora.\n\nTerceiro parágrafo curto.";
  it("agrees with a whole-note measure of that paragraph alone", () => {
    const b = build(text);
    const p2 = "— Fala de alguém agora.";
    const from = text.indexOf(p2);
    const sel = measures(b.md, b.pass, b.opts, { from, to: from + p2.length });
    const alone = build(p2);
    const whole = measures(...args(alone));
    expect(sel.words).toBe(whole.words);
    expect(sel.speech).toBe(whole.speech);
    expect(sel.sentences).toBe(whole.sentences);
    expect(sel.syllables).toBe(whole.syllables);
  });
  it("counts only tokens inside the range", () => {
    const b = build(text);
    const m = measures(b.md, b.pass, b.opts, { from: 0, to: text.indexOf("\n") });
    expect(m.words).toBe(6);
    expect(m.sentences).toBe(2);
  });
  it("an empty range is zero", () => {
    const b = build(text);
    const m = measures(b.md, b.pass, b.opts, { from: 5, to: 5 });
    expect(m.words).toBe(0);
    expect(m.readability).toBeNull();
  });
});

describe("readability and language", () => {
  const long = Array.from({ length: 30 }, () => "A casa era velha e o gato dormia.").join(" ");
  it("is null under the thresholds", () => {
    expect(measures(...args(build("Uma frase curta."))).readability).toBeNull();
  });
  it("is present for a long enough note", () => {
    const m = measures(...args(build(long)));
    expect(m.words).toBe(240);
    expect(m.sentences).toBe(30);
    expect(m.readability).not.toBeNull();
    expect(m.syllables).toBeGreaterThan(m.words);
  });
  it("is null with no language and syllables are 0", () => {
    const b = build(long, { lang: null });
    const m = measures(b.md, b.pass, b.opts);
    expect(m.readability).toBeNull();
    expect(m.syllables).toBe(0);
    expect(m.words).toBe(240);
  });
});
