import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { closeToName, echoes, editDistance, nameVariants } from "../src/lens/rules-stem";
import { tokens } from "../src/core/tokens";
import { normalizeWord, stem } from "../src/core/stem";
import { isStopWord } from "../src/core/stem/stopwords";
import type { LensLang, RuleOptions } from "../src/lens/types";

function opts(lang: LensLang | null, over: Partial<RuleOptions["lists"]> = {}, win = 40): RuleOptions {
  return {
    lang, rules: new Set(["echo", "name"] as const), echoWindow: win, longSentence: 45,
    lists: { crutch: [], names: [], ignore: [], ...over },
  };
}
const filler = (n: number) => Array.from({ length: n }, () => "xx").join(" ");

describe("echoes", () => {
  it("skips capitalized words the note shows to be names", () => {
    const text = "Fernando chegou cedo. Fernando trouxe pão.";
    expect(echoes(tokens(text), [], opts("pt-BR"))).toHaveLength(1);
    expect(echoes(tokens(text), [], opts("pt-BR"), new Set(["fernando"]))).toHaveLength(0);
  });
  it("flags olhou ... olhando within the window, with related", () => {
    const text = `Ele olhou ${filler(10)} e ficou olhando.`;
    const m = echoes(tokens(text), [], opts("pt-BR"));
    expect(m).toHaveLength(1);
    expect(m[0].rule).toBe("echo");
    expect(text.slice(m[0].from, m[0].to)).toBe("olhando");
    expect(text.slice(m[0].related!.from, m[0].related!.to)).toBe("olhou");
  });
  it("honours the window edge", () => {
    const at = (n: number) => echoes(tokens(`olhou ${filler(n)} olhando`), [], opts("pt-BR")).length;
    expect(at(39)).toBe(1);
    expect(at(40)).toBe(0);
    expect(echoes(tokens(`olhou ${filler(10)} olhando`), [], opts("pt-BR", {}, 5))).toHaveLength(0);
  });
  it("resets at a break", () => {
    const text = "Ele olhou.\n\n---\n\nEla olhando.";
    expect(echoes(tokens(text), [], opts("pt-BR"))).toHaveLength(1);
    expect(echoes(tokens(text), [text.indexOf("---")], opts("pt-BR"))).toHaveLength(0);
  });
  it("ignores stop words, short words, names and Ignorar", () => {
    expect(echoes(tokens("disse alguma coisa e disse outra"), [], opts("pt-BR"))).toHaveLength(0);
    expect(echoes(tokens("casa e casa"), [], opts("pt-BR"))).toHaveLength(1);
    expect(echoes(tokens("sol e sol"), [], opts("pt-BR"))).toHaveLength(0);
    expect(echoes(tokens("Mariana viu Mariana"), [], opts("pt-BR", { names: ["Mariana"] }))).toHaveLength(0);
    expect(echoes(tokens("olhou e olhando"), [], opts("pt-BR", { ignore: ["olhar"] }))).toHaveLength(0);
    expect(echoes(tokens("olhou e olhou"), [], opts("pt-BR", { ignore: ["olhou"] }))).toHaveLength(0);
    expect(echoes(tokens("1234 e 1234"), [], opts("pt-BR"))).toHaveLength(0);
  });
  it("gives two matches for three occurrences, each related to the previous", () => {
    const text = "olhou olhando olhava";
    const m = echoes(tokens(text), [], opts("pt-BR"));
    expect(m).toHaveLength(2);
    expect(text.slice(m[1].related!.from, m[1].related!.to)).toBe("olhando");
  });
  it("works in English and is off with no language", () => {
    expect(echoes(tokens("She walked and kept walking"), [], opts("en"))).toHaveLength(1);
    expect(echoes(tokens("olhou olhando"), [], opts(null))).toEqual([]);
  });
});

describe("closeToName", () => {
  it("does not flag short-name look-alikes", () => {
    expect(closeToName("Asa", "Ana")).toBe(false);
    expect(closeToName("Leo", "Teo")).toBe(false);
    expect(closeToName("Ama", "Ana")).toBe(false);
    expect(closeToName("Teu", "Teo")).toBe(false);
  });
  it("flags doubled letters and transpositions of short names", () => {
    expect(closeToName("Anna", "Ana")).toBe(true);
    expect(closeToName("Aan", "Ana")).toBe(true);
    expect(closeToName("Teeo", "Teo")).toBe(true);
    expect(closeToName("Ana", "Ana")).toBe(false);
  });
  it("uses distance 1 for 4-5 letters and 2 for 6 or more", () => {
    expect(closeToName("Marta", "Marla")).toBe(true);
    expect(closeToName("Marta", "Marlo")).toBe(false);
    expect(closeToName("Marianna", "Mariana")).toBe(true);
    expect(closeToName("Mariaxxa", "Mariana")).toBe(true);
    expect(closeToName("Maxxaxxa", "Mariana")).toBe(false);
  });
});

describe("editDistance", () => {
  it("counts edits and transpositions", () => {
    expect(editDistance("abc", "abc", 2)).toBe(0);
    expect(editDistance("abc", "abd", 2)).toBe(1);
    expect(editDistance("abcd", "abdc", 2)).toBe(1);
    expect(editDistance("", "ab", 3)).toBe(2);
    expect(editDistance("kitten", "sitting", 5)).toBe(3);
  });
  it("exits past max", () => {
    expect(editDistance("abc", "xyz", 1)).toBeGreaterThan(1);
    expect(editDistance("a", "abcdef", 2)).toBeGreaterThan(2);
  });
});

describe("nameVariants", () => {
  const run = (text: string, names: string[], lang: LensLang | null = "pt-BR", ignore: string[] = []) =>
    nameVariants(tokens(text), new Set(), opts(lang, { names, ignore })).map((m) => m.text);
  it("flags Marianna against Mariana", () => {
    expect(run("Marianna entrou. Mariana saiu.", ["Mariana"])).toEqual(["Marianna"]);
  });
  it("leaves inflections and the names themselves alone", () => {
    expect(run("Mariazinha e Teozinho riram. Mariana e Teo.", ["Maria", "Teo"])).toEqual([]);
  });
  it("skips a word that appears lowercased elsewhere", () => {
    expect(run("Teu nome. Eu disse teu nome.", ["Teo"])).toEqual([]);
    expect(run("Teeo chegou.", ["Teo"])).toEqual(["Teeo"]);
  });
  it("respects Ignorar, an empty list and no language", () => {
    expect(run("Marianna entrou.", ["Mariana"], "pt-BR", ["Marianna"])).toEqual([]);
    expect(run("Marianna entrou.", [])).toEqual([]);
    expect(run("Marianna entrou.", ["Mariana"], null)).toEqual(["Marianna"]);
    expect(run("Jamess left.", ["James"], "en")).toEqual(["Jamess"]);
  });
});

describe("stop words in the word merge fixtures", () => {
  // Known conflicts, frozen fixture rows (clitic rows for the said-verb *dizer*, also in the
  // stop list); reported to the author (gate G3). Anything else in this list is a bug.
  const KNOWN = new Set(["pt-merge:disse", "pt-merge:dizendo"]);
  it("no must-match member is a stop word", () => {
    for (const [file, lang] of [["pt-merge", "pt"], ["en-merge", "en"]] as const) {
      const rows = readFileSync(`tests/fixtures/stem/${file}.tsv`, "utf8").split("\n")
        .filter((l) => l.trim() && !l.startsWith("#"));
      for (const row of rows) {
        for (const w of row.split("\t")) {
          if (KNOWN.has(`${file}:${w}`)) continue;
          expect(isStopWord(normalizeWord(w), lang), `${file}: ${w}`).toBe(false);
        }
      }
    }
    expect(stem("olhou", "pt")).toBe(stem("olhando", "pt"));
  });
});
