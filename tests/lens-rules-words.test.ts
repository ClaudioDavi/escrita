import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { sentences } from "../src/core/sentences";
import { readerMask } from "../src/core/wordcount";
import { tokens } from "../src/core/tokens";
import { LEXICON } from "../src/lens/lexicon";
import { adverbs, crutches, gerunds, longSentences } from "../src/lens/rules-words";
import type { LensLang, Lists, Match, RuleOptions } from "../src/lens/types";

function opts(lang: LensLang | null, lists: Partial<Lists> = {}, extra: Partial<RuleOptions> = {}): RuleOptions {
  return {
    lang,
    rules: new Set(["echo", "adverb", "gerund", "crutch", "name", "long"]),
    echoWindow: 40,
    longSentence: 45,
    lists: { crutch: [], names: [], ignore: [], ...lists },
    ...extra,
  };
}

function setup(text: string, lang: LensLang | null) {
  const md = segment(text);
  const mask = md.masked();
  const stem = lang === "pt-BR" ? "pt" : lang === "en" ? "en" : null;
  return { toks: tokens(mask), sents: sentences(mask, md, stem) };
}

const lex = (lang: LensLang) => LEXICON[lang];

function run(
  fn: "adverbs" | "gerunds",
  text: string,
  lang: LensLang | null,
  lists: Partial<Lists> = {},
): Match[] {
  const { toks, sents } = setup(text, lang);
  const o = opts(lang, lists);
  const f = fn === "adverbs" ? adverbs : gerunds;
  return f(toks, sents, o, lex(lang ?? "en"));
}

const slice = (text: string, ms: Match[]) => ms.map((m) => text.slice(m.from, m.to));

describe("adverbs", () => {
  it("pt: -mente, with ranges", () => {
    const t = "Ela falou lentamente e saiu rapidamente.";
    const ms = run("adverbs", t, "pt-BR");
    expect(slice(t, ms)).toEqual(["lentamente", "rapidamente"]);
    expect(ms.every((m) => m.rule === "adverb" && m.kind === "base")).toBe(true);
  });
  it("pt: exceptions and the 3-letter rule", () => {
    const t = "A gente clemente e veemente tem semente, mente e demente no dormente.";
    expect(run("adverbs", t, "pt-BR")).toEqual([]);
  });
  it("pt: subjunctive -mentar forms are exceptions", () => {
    expect(run("adverbs", "Que ele alimente e experimente o documente.", "pt-BR")).toEqual([]);
  });
  it("pt: enclitic base is tested and the match spans the token", () => {
    const t = "Disse calmamente-lhe isso.";
    // "calmamente-lhe": base after the clitic split is calmamente
    expect(slice(t, run("adverbs", t, "pt-BR"))).toEqual(["calmamente-lhe"]);
  });
  it("pt: Ignorar removes, accents are not folded", () => {
    const t = "Falou lentamente e rapidamente.";
    expect(slice(t, run("adverbs", t, "pt-BR", { ignore: ["Lentamente"] }))).toEqual(["rapidamente"]);
  });
  it("skips capitalized non-initial tokens, keeps sentence-initial ones", () => {
    const t = "Realmente, Clementemente chegou. Depois Lentamente voltou.";
    expect(slice(t, run("adverbs", t, "pt-BR"))).toEqual(["Realmente"]);
  });
  it("en: -ly, length 5, exceptions", () => {
    const t = "She slowly replied. The family was friendly. Only fly early. Quickly now.";
    expect(slice(t, run("adverbs", t, "en"))).toEqual(["slowly", "Quickly"]);
  });
  it("en: capitalized mid-sentence skipped (names)", () => {
    const t = "He met Holly and Bradly there.";
    expect(run("adverbs", t, "en")).toEqual([]);
  });
  it("en: Ignore removes", () => {
    expect(run("adverbs", "She spoke softly.", "en", { ignore: ["softly"] })).toEqual([]);
  });
  it("no language gives nothing", () => {
    expect(run("adverbs", "Falou lentamente. She spoke slowly.", null)).toEqual([]);
  });
});

describe("gerunds, pt", () => {
  it("base gerunds with ranges, exceptions out", () => {
    const t = "Ele ficou olhando o mundo quando viu o menino correndo, comendo e rindo.";
    expect(slice(t, run("gerunds", t, "pt-BR").filter((m) => m.kind === "base"))).toEqual([
      "olhando", "correndo", "comendo", "rindo",
    ]);
  });
  it("first-person present forms in -endo/-ando are not gerunds", () => {
    const t = "Não entendo. Eu mando aqui. Eu aprendo devagar. Te recomendo o bolo.";
    expect(run("gerunds", t, "pt-BR")).toEqual([]);
  });
  it("a sentence-initial name the note capitalizes elsewhere is not a gerund", () => {
    const t = "Fernando é aquele do bar? Vi o Fernando ontem. Andando, ela pensou.";
    expect(slice(t, run("gerunds", t, "pt-BR").filter((m) => m.kind === "base"))).toEqual(["Andando"]);
  });
  it("enclitic gerunds span the whole token", () => {
    const t = "Foi dizendo-lhe tudo, olhando-a e fazendo-o.";
    const ms = run("gerunds", t, "pt-BR").filter((m) => m.kind === "base");
    expect(slice(t, ms)).toEqual(["dizendo-lhe", "olhando-a", "fazendo-o"]);
  });
  it("gerundismo with no word and with one word between", () => {
    const a = "Amanhã vou estar enviando o arquivo.";
    const ga = run("gerunds", a, "pt-BR");
    expect(ga.filter((m) => m.kind === "gerundismo").map((m) => a.slice(m.from, m.to))).toEqual(["vou estar enviando"]);
    expect(ga.filter((m) => m.kind === "base").map((m) => a.slice(m.from, m.to))).toEqual(["enviando"]);
    const b = "Vamos logo estar de volta chegando.";
    expect(run("gerunds", b, "pt-BR").filter((m) => m.kind === "gerundismo")).toEqual([]);
    const c = "Vamos estar sempre chegando.";
    expect(run("gerunds", c, "pt-BR").filter((m) => m.kind === "gerundismo").map((m) => c.slice(m.from, m.to))).toEqual([
      "Vamos estar sempre chegando",
    ]);
  });
  it("deve estar chegando and pode estar dormindo give only the base gerund", () => {
    const t = "Ele deve estar chegando. Ela pode estar dormindo.";
    const ms = run("gerunds", t, "pt-BR");
    expect(ms.filter((m) => m.kind === "gerundismo")).toEqual([]);
    expect(slice(t, ms)).toEqual(["chegando", "dormindo"]);
  });
  it("gerundismo does not cross a sentence", () => {
    const t = "Eu vou. Estar enviando é difícil.";
    expect(run("gerunds", t, "pt-BR").filter((m) => m.kind === "gerundismo")).toEqual([]);
  });
  it("a chain gives one sentence match plus the base ones", () => {
    const t = "Ela saiu correndo, gritando e chorando pela rua.";
    const ms = run("gerunds", t, "pt-BR");
    expect(ms.filter((m) => m.kind === "base")).toHaveLength(3);
    const chain = ms.filter((m) => m.kind === "chain");
    expect(chain).toHaveLength(1);
    expect(t.slice(chain[0].from, chain[0].to)).toBe(t);
  });
  it("two gerunds make no chain", () => {
    expect(run("gerunds", "Ela saiu correndo e chorando.", "pt-BR").filter((m) => m.kind === "chain")).toEqual([]);
  });
  it("capitalized non-initial tokens, listed names and Ignorar are skipped", () => {
    const t = "Ontem Fernando viu Armando andando. Fernando riu.";
    const ms = run("gerunds", t, "pt-BR", { names: ["Fernando"] });
    expect(slice(t, ms)).toEqual(["andando"]);
    expect(run("gerunds", "Foi andando.", "pt-BR", { ignore: ["andando"] })).toEqual([]);
  });
});

describe("gerunds, en", () => {
  it("began / started to + word spans the construction", () => {
    const t = "She started to run. He begins to sing and had begun to cry. They were running.";
    const ms = run("gerunds", t, "en");
    expect(slice(t, ms)).toEqual(["started to run", "begins to sing", "begun to cry"]);
    expect(ms.every((m) => m.kind === "started")).toBe(true);
  });
  it("needs a word after to, in the same sentence", () => {
    expect(run("gerunds", "She started to.", "en")).toEqual([]);
    expect(run("gerunds", "She started. To run was hard.", "en")).toEqual([]);
  });
  it("begin without to is not matched", () => {
    expect(run("gerunds", "The begin of it. Starting over.", "en")).toEqual([]);
  });
  it("no language gives nothing", () => {
    expect(run("gerunds", "Foi correndo. She started to run.", null)).toEqual([]);
  });
});

describe("crutches", () => {
  const go = (t: string, crutch: string[], ignore: string[] = []) => {
    const mask = readerMask(segment(t));
    return crutches(tokens(mask), mask, opts("pt-BR", { crutch, ignore }));
  };
  it("does not match across punctuation or a sentence end", () => {
    expect(go("Tudo começou. A chuva veio logo.", ["começou a"])).toEqual([]);
    expect(go("Ficou no meio, que era o lugar dela.", ["meio que"])).toEqual([]);
    expect(go("Tudo *começou* a chover.", ["começou a"])).toHaveLength(1);
  });
  it("matches phrases whole-word, case-insensitive, with ranges", () => {
    const t = "De repente ele viu o mar. Sentiu medo, de repente.";
    const ms = go(t, ["de repente", "viu"]);
    expect(ms.map((m) => t.slice(m.from, m.to))).toEqual(["De repente", "viu", "de repente"]);
    expect(ms.every((m) => m.rule === "crutch")).toBe(true);
  });
  it("whole words only", () => {
    expect(go("Ele viuvou e reviu tudo.", ["viu"])).toEqual([]);
  });
  it("crosses a line break and runs of spaces", () => {
    const t = "Ele começou\na   falar.";
    const ms = go(t, ["começou a"]);
    expect(ms).toHaveLength(1);
    expect(t.slice(ms[0].from, ms[0].to)).toBe("começou\na");
  });
  it("is exact: no stemming", () => {
    expect(go("Eles começaram a rir.", ["começou a"])).toEqual([]);
  });
  it("empty lists give nothing", () => {
    expect(go("De repente ele viu.", [])).toEqual([]);
  });
  it("Ignorar does not apply", () => {
    expect(go("Ele viu o mar.", ["viu"], ["viu"])).toHaveLength(1);
  });
});

describe("longSentences", () => {
  const words = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? "Word" : `w${i}`)).join(" ");
  const go = (t: string, n = 45) => {
    const { toks, sents } = setup(t, "en");
    return longSentences(toks, sents, opts("en", {}, { longSentence: n }));
  };
  it("more than N words gives one match spanning the sentence", () => {
    const t = `Short one. ${words(46)}. Another short.`;
    const ms = go(t);
    expect(ms).toHaveLength(1);
    expect(t.slice(ms[0].from, ms[0].to)).toBe(`${words(46)}.`);
    expect(ms[0].rule).toBe("long");
  });
  it("exactly N words is fine", () => {
    expect(go(`${words(45)}.`)).toEqual([]);
  });
  it("dialogue counts, and the limit is an option", () => {
    const t = `— ${words(8)}, disse ele.`;
    expect(go(t, 5)).toHaveLength(1);
  });
  it("no sentences gives nothing", () => {
    expect(go("")).toEqual([]);
  });
});
