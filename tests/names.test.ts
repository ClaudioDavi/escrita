import { describe, expect, it } from "vitest";
import {
  EMPTY_TABLE, capitalizedTerms, compileTerms, findNames, matchLang, pickEntry, type NameSource, type TermTable,
} from "../src/core/names";

const src = (id: string, name: string, o: Partial<NameSource> = {}): NameSource => ({
  id, name, aliases: [], person: true, firstName: true, caseSensitive: false, ignore: [], ...o,
});
const pt = (s: NameSource[], extraTitles: string[] = []): TermTable => compileTerms(s, { lang: "pt", extraTitles });
const hits = (text: string, t: TermTable, scope: (id: string) => boolean = () => true) =>
  findNames(text, t).map((o) => [o.text, pickEntry(o, scope)] as const);

describe("matchLang", () => {
  it("maps settings and locales", () => {
    expect(matchLang("pt-BR", "en")).toBe("pt");
    expect(matchLang("en", "pt")).toBe("en");
    expect(matchLang("auto", "pt-BR")).toBe("pt");
    expect(matchLang("auto", "en-GB")).toBe("en");
    expect(matchLang("auto", "fr")).toBeNull();
    expect(matchLang("auto", "")).toBeNull();
  });
});

describe("terms", () => {
  it("derives the first name after titles, and the full name minus titles", () => {
    const t = pt([src("a", "Dona Benta Encerrabodes")]);
    expect(t.terms.map((x) => `${x.text}:${x.origin}`).sort()).toEqual(
      ["Benta Encerrabodes:first", "Benta:first", "Dona Benta Encerrabodes:name"].sort(),
    );
  });
  it("derives the name minus its titles even when one word remains (G3)", () => {
    expect(compileTerms([src("a", "Mr Brown")], { lang: "en", extraTitles: [] }).terms.map((x) => x.text).sort()).toEqual(["Brown", "Mr Brown"]);
    expect(pt([src("a", "Senhor Antunes")]).terms.map((x) => x.text).sort()).toEqual(["Antunes", "Senhor Antunes"]);
    expect(pt([src("a", "Maria")]).terms.map((x) => x.text)).toEqual(["Maria"]);
  });
  it("derives no first name with firstName false or for a non-person", () => {
    expect(pt([src("a", "Maria José", { firstName: false })]).terms).toHaveLength(1);
    expect(pt([src("a", "Rosa dos ventos", { person: false })]).terms).toHaveLength(1);
  });
  it("compares titles with accents kept (Irma is a name, Irmã a title) and nameTitles extends the table", () => {
    expect(pt([src("a", "Irma Luísa Prado")]).terms.map((x) => x.text)).toContain("Irma");
    expect(pt([src("a", "Irmã Luísa Prado")]).terms.map((x) => x.text)).toContain("Luísa");
    for (const t of ["Coronel", "Capitão", "Professor", "Professora"]) expect(pt([src("a", `${t} Rui Costa`)]).terms.map((x) => x.text), t).toContain("Rui");
    expect(pt([src("a", "Comendador Rui Costa")]).terms.map((x) => x.text)).toContain("Comendador");
    expect(pt([src("a", "Comendador Rui Costa")], ["Comendador."]).terms.map((x) => x.text)).toContain("Rui");
  });
  it("drops one-letter and stop-word terms", () => {
    const t = pt([src("a", "Ana", { aliases: ["A", "o", "não", "Zé"] })]);
    expect(t.terms.map((x) => x.text).sort()).toEqual(["Ana", "Zé"]);
  });
  it("uses both title tables with no language", () => {
    const t = compileTerms([src("a", "Mr Rui Costa"), src("b", "Dona Ana Lima")], { lang: null, extraTitles: [] });
    expect(t.terms.map((x) => x.text)).toEqual(expect.arrayContaining(["Rui", "Ana"]));
  });
});

describe("findNames", () => {
  it("returns nothing for an empty table", () => {
    expect(findNames("Maria", EMPTY_TABLE)).toEqual([]);
  });
  it("matches accent pairs with the same key, both exact", () => {
    for (const [a, b] of [["Inês", "Ines"], ["Tomás", "Tomas"], ["Thaís", "Thais"], ["Andrés", "Andres"], ["Mário", "Mario"]]) {
      const t = pt([src("x", a)]);
      const occ = findNames(`${a} e ${b}`, t);
      expect(occ.map((o) => o.text), a).toEqual([a, b]);
      expect(occ.every((o) => o.candidates[0].exact), a).toBe(true);
      const t2 = pt([src("x", b)]);
      expect(findNames(`${a} e ${b}`, t2)).toHaveLength(2);
    }
  });
  it("keeps articles exact inside a multi-word term (G3)", () => {
    const t = pt([src("t", "Teo", { aliases: ["o menino"] })]);
    expect(findNames("Os meninos e O menino e o menino", t).map((o) => o.text)).toEqual(["O menino", "o menino"]);
    expect(findNames("a menina", t)).toEqual([]);
    const r = pt([src("r", "Rosa dos ventos", { person: false })]);
    expect(findNames("a rosa do vento e a Rosa dos ventos", r).map((o) => o.text)).toEqual(["Rosa dos ventos"]);
  });
  it("needs a capital for a capitalized term, all caps included (G3)", () => {
    const t = pt([src("r", "Rosa"), src("l", "Luz"), src("o", "Rosa dos ventos", { person: false })]);
    expect(findNames("a blusa rosa, ROSA, Rosa e rosas; acendeu a luz", t).map((o) => o.text)).toEqual(["ROSA", "Rosa"]);
    expect(findNames("Rosa Dos Ventos", t).map((o) => o.text)).toEqual(["Rosa Dos Ventos"]);
    expect(findNames("## PORTO", pt([src("p", "Porto", { person: false })])).map((o) => o.text)).toEqual(["PORTO"]);
  });
  it("lets a lowercase term match any case", () => {
    const t = pt([src("t", "Teo", { aliases: ["o menino"] })]);
    expect(findNames("O menino e O MENINO", t).map((o) => o.text)).toEqual(["O menino", "O MENINO"]);
  });
  it("matches a hyphenated word inside a term (G3, review 2)", () => {
    const t = pt([src("s", "Santa-Rita do Sul", { person: false })]);
    expect(findNames("Em Santa-Rita do Sul chovia", t).map((o) => o.text)).toEqual(["Santa-Rita do Sul"]);
    const j = pt([src("j", "Jean-Luc Picard", { firstName: false })]);
    expect(findNames("Jean-Luc Picard riu", j).map((o) => o.text)).toEqual(["Jean-Luc Picard"]);
  });
  it("matches a hyphenated word inside an ignore phrase (G3, review 2)", () => {
    const t = pt([src("f", "Flor", { ignore: ["Beija-Flor"] })]);
    expect(findNames("A Flor viu o Beija-Flor", t).map((o) => o.text)).toEqual(["Flor"]);
  });
  it("matches a hyphenated name by its parts, and a full name by hyphen", () => {
    const t = pt([src("mj", "Maria José")]);
    expect(findNames("Maria-José ficou", t).map((o) => o.text)).toEqual(["Maria-José"]);
    const whole = pt([src("mj", "Maria-José")]);
    expect(findNames("Maria-José ficou", whole).map((o) => o.text)).toEqual(["Maria-José"]);
  });
  it("matches Maria Clara against Dona Maria Clara, and a bare Brown against Mr Brown", () => {
    const t = pt([src("c", "Dona Maria Clara")]);
    expect(findNames("Maria Clara sorriu", t).map((o) => o.text)).toEqual(["Maria Clara"]);
    const en = compileTerms([src("b", "Mr Brown")], { lang: "en", extraTitles: [] });
    expect(findNames("Brown paid", en).map((o) => o.text)).toEqual(["Brown"]);
    expect(findNames("Mr Brown paid", en).map((o) => o.text)).toEqual(["Mr Brown"]);
  });
  it("lets the longest match win and skips past it", () => {
    const t = pt([src("m", "Maria"), src("mc", "Maria Clara", { firstName: false })]);
    const occ = findNames("Maria Clara e Maria", t);
    expect(occ.map((o) => o.text)).toEqual(["Maria Clara", "Maria"]);
    expect(pickEntry(occ[0], () => true)).toBe("mc");
  });
  it("allows only spaces, one line break and emphasis marks between words", () => {
    const t = pt([src("mj", "Maria José", { firstName: false })]);
    expect(findNames("Maria\nJosé", t)).toHaveLength(1);
    expect(findNames("*Maria* *José*", t).map((o) => o.text)).toEqual(["Maria* *José"]);
    expect(findNames("Maria\n\nJosé", t)).toEqual([]);
    expect(findNames("Maria, José", t)).toEqual([]);
  });
  it("drops occurrences inside an ignore span only", () => {
    const t = pt([src("r", "Rosa", { ignore: ["rosa dos ventos"] })]);
    expect(findNames("Rosa viu a Rosa dos ventos e a Rosa.", t).map((o) => o.from)).toEqual([0, 31]);
    expect(findNames("a Rosa-dos-ventos", t)).toEqual([]);
  });
  it("honours case-sensitive terms, inflection included, accents ignored", () => {
    const t = pt([src("p", "Porto", { person: false, caseSensitive: true })]);
    expect(findNames("Porto PORTO porto Portos", t).map((o) => o.text)).toEqual(["Porto", "Portos"]);
    const i = pt([src("i", "Inês", { caseSensitive: true })]);
    expect(findNames("Ines Inês INES ines", i).map((o) => o.text)).toEqual(["Ines", "Inês"]);
  });
  it("matches by folded form with no language, no stemming", () => {
    const t = compileTerms([src("m", "Inês")], { lang: null, extraTitles: [] });
    expect(findNames("Ines Inês Inese", t).map((o) => o.text)).toEqual(["Ines", "Inês"]);
  });
  it("reads only the slice asked for, offsets absolute", () => {
    const t = pt([src("m", "Maria")]);
    const text = "Maria foi. Maria voltou.";
    expect(findNames(text, t, 10, text.length).map((o) => o.from)).toEqual([11]);
  });
});

describe("pickEntry", () => {
  it("filters to scope, prefers exact then explicit, and gives up when ambiguous", () => {
    const t = pt([src("a", "Marcos"), src("b", "Marco"), src("c", "Maria Marcos")]);
    const [o] = findNames("Marcos", t);
    expect(pickEntry(o, () => true)).toBe("a");
    expect(pickEntry(o, (id) => id !== "a")).toBe("b");
    expect(pickEntry(o, () => false)).toBeNull();
    const amb = pt([src("x", "Luca"), src("y", "Luca")]);
    expect(pickEntry(findNames("Luca", amb)[0], () => true)).toBeNull();
  });
});

describe("capitalizedTerms", () => {
  it("lists capitalized terms only, once", () => {
    const t = pt([src("t", "Teo Souza", { aliases: ["o menino", "Teozinho"] })]);
    expect(capitalizedTerms(t).sort()).toEqual(["Teo", "Teo Souza", "Teozinho"]);
  });
});

describe("signature", () => {
  const base = [src("a", "Maria"), src("b", "Rosa")];
  const sig = (s: NameSource[], l: "pt" | "en" | null = "pt", x: string[] = []) => compileTerms(s, { lang: l, extraTitles: x }).signature;
  it("is stable under order and changes with matching inputs", () => {
    expect(sig(base)).toBe(sig([...base].reverse()));
    expect(sig(base)).not.toBe(sig([src("a", "Maria"), src("b", "Rosa", { aliases: ["Rosita"] })]));
    expect(sig(base)).not.toBe(sig([src("a", "Maria"), src("b", "Rosa", { caseSensitive: true })]));
    expect(sig(base)).not.toBe(sig([src("a", "Maria"), src("b", "Rosa", { ignore: ["rosa dos ventos"] })]));
    expect(sig(base)).not.toBe(sig(base, "en"));
    expect(sig(base)).not.toBe(sig(base, null));
    expect(sig([src("a", "Dona Ana Lima")])).not.toBe(sig([src("a", "Dona Ana Lima")], "pt", ["Dona"]) + "x");
    expect(sig([src("a", "Zeca Lima")])).not.toBe(sig([src("a", "Zeca Lima")], "pt", ["Zeca"]));
  });
  it("ignores inputs that do not change matching", () => {
    expect(sig(base)).toBe(sig(base, "pt", ["Comendador"]));
  });
});

describe("speed", () => {
  const words = ["o", "a", "casa", "rio", "vento", "dia", "noite", "disse", "foi", "viu", "mar", "terra", "ele", "ela"];
  const names = Array.from({ length: 300 }, (_, i) => src(`e${i}`, `Nome${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i / 26) | 0))} Sobrenome`));
  const table = pt(names);
  const note = Array.from({ length: 10000 }, (_, i) => (i % 97 === 0 ? "Nomeab" : words[i % words.length])).join(" ");
  it("300 entries over 10,000 words: under 100 ms (CI ceiling)", () => {
    findNames(note, table);
    const t0 = performance.now();
    findNames(note, table);
    expect(performance.now() - t0).toBeLessThan(100);
  });
  it.skipIf(!!process.env.CI)("local budget: under 20 ms (median of the fastest half, to ride out a loaded machine)", () => {
    const runs: number[] = [];
    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      findNames(note, table);
      runs.push(performance.now() - t0);
    }
    runs.sort((a, b) => a - b);
    expect(runs[3]).toBeLessThan(20); // median of the fastest 7
  });
});
