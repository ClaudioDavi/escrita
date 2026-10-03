import { describe, expect, it } from "vitest";
import { segment } from "../src/core/markdown";
import { sentences } from "../src/core/sentences";
import type { StemLang } from "../src/core/stem";
import { readerMask } from "../src/core/wordcount";


function split(text: string, lang: StemLang | null): string[] {
  const md = segment(text);
  return sentences(readerMask(md), md, lang).map((s) => text.slice(s.from, s.to));
}

type Case = [string, string[]];

function run(lang: StemLang | null, cases: Case[]) {
  for (const [input, expected] of cases) {
    it(JSON.stringify(input), () => expect(split(input, lang)).toEqual(expected));
  }
}

describe("sentences: basics", () => {
  run("en", [
    ["", []],
    ["   \n\n ", []],
    ["Hello.", ["Hello."]],
    ["One. Two. Three.", ["One.", "Two.", "Three."]],
    ["No end", ["No end"]],
    ["What? Really! Yes.", ["What?", "Really!", "Yes."]],
    ["Wait?! No way.", ["Wait?!", "No way."]],
    ["First.\n\nSecond.", ["First.", "Second."]],
    ["# Title\nText here.", ["Title", "Text here."]],
    ["Before.\n\n---\n\nAfter.", ["Before.", "After."]],
    ["no capital. next word", ["no capital. next word"]],
  ]);
  run("pt", [
    ["Olá. Tudo bem? Sim!", ["Olá.", "Tudo bem?", "Sim!"]],
    ["Ele saiu. Ela ficou.", ["Ele saiu.", "Ela ficou."]],
    ["Primeiro.\n\nSegundo.", ["Primeiro.", "Segundo."]],
    ["Fim.\n\n***\n\nÉ outro.", ["Fim.", "É outro."]],
    ["Ação. Émile chegou.", ["Ação.", "Émile chegou."]],
    ["Ele disse não. Ótimo.", ["Ele disse não.", "Ótimo."]],
  ]);
});

describe("sentences: ellipsis", () => {
  run("en", [
    ["He waited... and left.", ["He waited... and left."]],
    ["He waited... And left.", ["He waited...", "And left."]],
    ["Well… maybe.", ["Well… maybe."]],
    ["Well… Maybe.", ["Well…", "Maybe."]],
    ["...and then it ended. Done.", ["...and then it ended.", "Done."]],
    ["He said...\nand left.", ["He said...\nand left."]],
  ]);
  run("pt", [
    ["Ele esperou... e saiu.", ["Ele esperou... e saiu."]],
    ["Ele esperou... E saiu.", ["Ele esperou...", "E saiu."]],
    ["Bem… talvez.", ["Bem… talvez."]],
    ["Bem… Talvez.", ["Bem…", "Talvez."]],
    ["Será?... não sei.", ["Será?... não sei."]],
    ["Será?... Não sei.", ["Será?...", "Não sei."]],
  ]);
});

describe("sentences: travessão and dash tags", () => {
  run("pt", [
    ["— Vamos? — perguntou ela.", ["— Vamos? — perguntou ela."]],
    ["— Vamos. — disse ela.", ["— Vamos. — disse ela."]],
    ["— Vamos! — gritou ele. — Agora.", ["— Vamos! — gritou ele.", "— Agora."]],
    ["— Vem? — disse ele. — Vou.", ["— Vem? — disse ele.", "— Vou."]],
    ["— Vem?\n— Vou.", ["— Vem?", "— Vou."]],
    ["— Vem?\n— disse ele.", ["— Vem?\n— disse ele."]],
    ["— Vamos? — Perguntou ela.", ["— Vamos?", "— Perguntou ela."]],
    ["— Sim... — murmurou. — Talvez.", ["— Sim... — murmurou.", "— Talvez."]],
    ["– Vamos? – perguntou ela.", ["– Vamos? – perguntou ela."]],
    ["– Vamos. – Ele saiu.", ["– Vamos.", "– Ele saiu."]],
    ["-- Vamos? -- perguntou ela.", ["-- Vamos? -- perguntou ela."]],
    ["-- Vamos. -- Ele saiu.", ["-- Vamos.", "-- Ele saiu."]],
    ["— Quem? — Eu.", ["— Quem?", "— Eu."]],
  ]);
  run("en", [
    ["— Go? — she asked.", ["— Go? — she asked."]],
    ["— Go. — She left.", ["— Go.", "— She left."]],
    ["– Go? – she asked.", ["– Go? – she asked."]],
    ["— Stop!\n— No.", ["— Stop!", "— No."]],
  ]);
});

describe("sentences: unspaced em dash", () => {
  run("en", [
    ["He stopped—she waited—and left.", ["He stopped—she waited—and left."]],
    ["\"I was—\" He stopped.", ["\"I was—\"", "He stopped."]],
    ["\"I was—\" he said.", ["\"I was—\" he said."]],
    ["She said—no. Then left.", ["She said—no.", "Then left."]],
  ]);
  run("pt", [
    ["Ele parou—esperou—e saiu.", ["Ele parou—esperou—e saiu."]],
    ["“Eu estava—” Ele parou.", ["“Eu estava—”", "Ele parou."]],
    ["“Eu estava—” disse ele.", ["“Eu estava—” disse ele."]],
    ["Ela disse—não. Depois saiu.", ["Ela disse—não.", "Depois saiu."]],
  ]);
});

describe("sentences: quotes", () => {
  run("en", [
    ["\"Ready?\" she asked.", ["\"Ready?\" she asked."]],
    ["\"Ready?\" She asked.", ["\"Ready?\"", "She asked."]],
    ["“Ready?” she asked. “Yes.”", ["“Ready?” she asked.", "“Yes.”"]],
    ["He left. \"Go away,\" she said.", ["He left.", "\"Go away,\" she said."]],
    ["“Stop.” “No.”", ["“Stop.”", "“No.”"]],
    ["She said, “Go.” Then she left.", ["She said, “Go.”", "Then she left."]],
    ["‘Ready?’ she asked.", ["‘Ready?’ she asked."]],
    ["It's fine. Isn't it?", ["It's fine.", "Isn't it?"]],
  ]);
  run("pt", [
    ["“Pronto?” perguntou ela.", ["“Pronto?” perguntou ela."]],
    ["“Pronto?” Perguntou ela.", ["“Pronto?”", "Perguntou ela."]],
    ["«Vamos.» Ela foi.", ["«Vamos.»", "Ela foi."]],
    ["Saiu. “Vai embora”, disse ela.", ["Saiu.", "“Vai embora”, disse ela."]],
    ["Ela disse: “Venha.” Ele veio.", ["Ela disse: “Venha.”", "Ele veio."]],
    ["(Ele saiu.) Ela ficou.", ["(Ele saiu.)", "Ela ficou."]],
  ]);
});

describe("sentences: abbreviations", () => {
  run("pt", [
    ["O Sr. Silva chegou.", ["O Sr. Silva chegou."]],
    ["A Sra. Costa e a Dra. Lima.", ["A Sra. Costa e a Dra. Lima."]],
    ["O Dr. Souza falou com a Profa. Ana.", ["O Dr. Souza falou com a Profa. Ana."]],
    ["Veja a pág. 12 do cap. 3.", ["Veja a pág. 12 do cap. 3."]],
    ["Leia pp. 3 a 5. Depois descanse.", ["Leia pp. 3 a 5.", "Depois descanse."]],
    ["Na Av. Paulista.", ["Na Av. Paulista."]],
    ["Chegou o Sto. Antônio.", ["Chegou o Sto. Antônio."]],
    ["Casa nº 5. Rua B.", ["Casa nº 5.", "Rua B."]],
    ["Comprou pão, leite etc. Depois saiu.", ["Comprou pão, leite etc.", "Depois saiu."]],
    ["Comprou pão, leite etc. e saiu.", ["Comprou pão, leite etc. e saiu."]],
    ["Vol. 2 saiu.", ["Vol. 2 saiu."]],
  ]);
  run("en", [
    ["Mr. Smith arrived.", ["Mr. Smith arrived."]],
    ["Mrs. Jones and Ms. Lee met Dr. Who.", ["Mrs. Jones and Ms. Lee met Dr. Who."]],
    ["Prof. Higgins spoke.", ["Prof. Higgins spoke."]],
    ["He lives on Main St. Near the park.", ["He lives on Main St. Near the park."]],
    ["John Smith Jr. arrived.", ["John Smith Jr. arrived."]],
    ["Cats vs. dogs is old.", ["Cats vs. dogs is old."]],
    ["Fruit, e.g. apples, is good.", ["Fruit, e.g. apples, is good."]],
    ["That is, i.e. the end.", ["That is, i.e. the end."]],
    ["We met at 5 p.m. and left.", ["We met at 5 p.m. and left."]],
    ["We met at 5 p.m. Then we left.", ["We met at 5 p.m.", "Then we left."]],
    ["Bread, milk, etc. Then he left.", ["Bread, milk, etc.", "Then he left."]],
    ["Bread, milk, etc. and eggs.", ["Bread, milk, etc. and eggs."]],
  ]);
  it("pt abbreviations are not applied to en", () => {
    expect(split("Leia o Sr. Silva. Fim.", "en")).toEqual(["Leia o Sr. Silva.", "Fim."]);
    expect(split("Chegou o Dra. Fim.", "en")).toEqual(["Chegou o Dra.", "Fim."]);
  });
});

describe("sentences: initials", () => {
  run("en", [
    ["J. R. R. Tolkien wrote it.", ["J. R. R. Tolkien wrote it."]],
    ["Then J.R.R. Tolkien wrote it.", ["Then J.R.R. Tolkien wrote it."]],
    ["So did I. He left.", ["So did I.", "He left."]],
    ["T. S. Eliot came. He read.", ["T. S. Eliot came.", "He read."]],
  ]);
  run("pt", [
    ["D. Pedro chegou.", ["D. Pedro chegou."]],
    ["Foi D. Pedro II. Depois saiu.", ["Foi D. Pedro II.", "Depois saiu."]],
    ["J. R. R. Tolkien escreveu.", ["J. R. R. Tolkien escreveu."]],
    ["Maria e J. Silva saíram.", ["Maria e J. Silva saíram."]],
  ]);
  run(null, [
    ["J. R. R. Tolkien wrote it. He left.", ["J. R. R. Tolkien wrote it.", "He left."]],
    ["D. Pedro chegou. Saiu.", ["D. Pedro chegou.", "Saiu."]],
  ]);
});

describe("sentences: numbers", () => {
  run("pt", [
    ["Custa 3.5 reais. Pague.", ["Custa 3.5 reais.", "Pague."]],
    ["Eram 1.000 pessoas. Todas saíram.", ["Eram 1.000 pessoas.", "Todas saíram."]],
    ["Em 1.5 horas. Fim.", ["Em 1.5 horas.", "Fim."]],
  ]);
  run("en", [
    ["It costs 3.5 dollars. Pay.", ["It costs 3.5 dollars.", "Pay."]],
    ["There were 1.000 of them. All left.", ["There were 1.000 of them.", "All left."]],
    ["Version 2.0 is out. Update.", ["Version 2.0 is out.", "Update."]],
  ]);
});

describe("sentences: emphasis and footnotes around the closing mark", () => {
  run("en", [
    ["*Go away.* She left.", ["*Go away.*", "She left."]],
    ["**Go away.** She left.", ["**Go away.**", "She left."]],
    ["_Go away!_ She left.", ["_Go away!_", "She left."]],
    ["He left. *She* stayed.", ["He left.", "*She* stayed."]],
    ["*Was it?* she asked.", ["*Was it?* she asked."]],
    ["It ended.[^1] Then more.", ["It ended.[^1]", "Then more."]],
    ["It ended.[1] Then more.", ["It ended.[1]", "Then more."]],
    ["It ended.[^note] it said.", ["It ended.[^note] it said."]],
  ]);
  run("pt", [
    ["*Vá embora.* Ela saiu.", ["*Vá embora.*", "Ela saiu."]],
    ["_Acabou?_ Ninguém sabe.", ["_Acabou?_", "Ninguém sabe."]],
    ["Acabou.[^1] Depois veio mais.", ["Acabou.[^1]", "Depois veio mais."]],
    ["Ele saiu. _Ela_ ficou.", ["Ele saiu.", "_Ela_ ficou."]],
  ]);
});

describe("sentences: soft-wrapped lines and CRLF", () => {
  run("en", [
    ["He walked to\nthe door and left.", ["He walked to\nthe door and left."]],
    ["He walked.\nShe stayed.", ["He walked.", "She stayed."]],
    ["He walked to\nThe Door and left.", ["He walked to", "The Door and left."]],
    ["Roses are red\nViolets are blue", ["Roses are red", "Violets are blue"]],
    ["one\ntwo\nthree four.", ["one\ntwo\nthree four."]],
    ["Mr.\nSmith left.", ["Mr.\nSmith left."]],
  ]);
  run("pt", [
    ["Ele caminhou até\na porta e saiu.", ["Ele caminhou até\na porta e saiu."]],
    ["Ele caminhou.\nEla ficou.", ["Ele caminhou.", "Ela ficou."]],
    ["Ele foi para\nSão Paulo.", ["Ele foi para", "São Paulo."]],
    ["Uma linha\nsem fim\ne outra.", ["Uma linha\nsem fim\ne outra."]],
  ]);
  it("CRLF", () => {
    expect(split("One. Two.\r\n\r\nThree.\r\nFour.", "en")).toEqual(["One.", "Two.", "Three.", "Four."]);
    expect(split("He walked to\r\nthe door.\r\nShe left.", "en")).toEqual(["He walked to\r\nthe door.", "She left."]);
    expect(split("Ele foi\r\nembora.\r\n\r\nFim.", "pt")).toEqual(["Ele foi\r\nembora.", "Fim."]);
  });
});

describe("sentences: hard breaks", () => {
  run("en", [
    ["## Chapter one\nIt began.", ["Chapter one", "It began."]],
    ["It began.\n## Next\nmore text", ["It began.", "Next", "more text"]],
    ["no mark\n\nnext paragraph", ["no mark", "next paragraph"]],
    ["It began\n***\nand ended", ["It began", "and ended"]],
    ["It began\n---\nand ended", ["It began", "and ended"]],
    ["---\ntitle: x\n---\nBody text. More.", ["Body text.", "More."]],
    ["Text.\n```\ncode. here.\n```\nMore.", ["Text.", "More."]],
  ]);
});

describe("sentences: no language", () => {
  run(null, [
    ["One. Two.", ["One.", "Two."]],
    ["Sr. Silva chegou. Saiu.", ["Sr.", "Silva chegou.", "Saiu."]],
    ["Mr. Smith arrived.", ["Mr.", "Smith arrived."]],
    ["Custa 3.5 reais. Pague.", ["Custa 3.5 reais.", "Pague."]],
    ["— Vamos? — perguntou ela.", ["— Vamos? — perguntou ela."]],
    ["Wait... and then. Go.", ["Wait... and then.", "Go."]],
  ]);
});

describe("sentences: ranges", () => {
  const samples = [
    "One. Two? Three!\n\n# H\nA b. C d.\n\n---\n\n— Vem? — disse. — Vou.\r\nTail",
    "*Go.* “Now.” Mr. Smith… and J. R. R. Tolkien. etc. Next.[^1] Done",
    "",
    "...\n...\n. . .\n— —\n",
  ];
  for (const t of samples) {
    it(`never overlap and stay inside: ${JSON.stringify(t).slice(0, 30)}`, () => {
      for (const lang of ["pt", "en", null] as const) {
        const md = segment(t);
        const ss = sentences(readerMask(md), md, lang);
        let prev = 0;
        for (const s of ss) {
          expect(s.from).toBeGreaterThanOrEqual(prev);
          expect(s.to).toBeGreaterThan(s.from);
          expect(s.to).toBeLessThanOrEqual(t.length);
          expect(/\S/.test(t.slice(s.from, s.to))).toBe(true);
          expect(t[s.from]).not.toMatch(/\s/);
          expect(t[s.to - 1]).not.toMatch(/\s/);
          prev = s.to;
        }
      }
    });
  }

  it("from and to return the whole sentences they touch", () => {
    const t = "One two. Three four. Five six.";
    const md = segment(t);
    const r = sentences(md.masked(), md, "en", 10, 12);
    expect(r.map((s) => t.slice(s.from, s.to))).toEqual(["Three four."]);
    const r2 = sentences(md.masked(), md, "en", 5, 12);
    expect(r2.map((s) => t.slice(s.from, s.to))).toEqual(["One two.", "Three four."]);
  });

  it("text hidden by the mask is never part of a sentence", () => {
    const t = "Keep this. %% secret. thing. %% Also keep.";
    const md = segment(t);
    const text = sentences(md.masked(), md, "en").map((s) => t.slice(s.from, s.to));
    expect(text.join(" ")).not.toContain("secret");
    expect(text[0]).toBe("Keep this.");
    expect(text[text.length - 1]).toBe("Also keep.");
  });
});
